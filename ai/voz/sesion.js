import { crearDetectorFinDeFrase, elegirVozVyta, FORMATOS_GRABACION, fragmentosParaVoz } from './audio.js';

const MAX_BYTES = 5 * 1024 * 1024;
const abortado = () => Object.assign(new Error('Turno cancelado'), { name: 'AbortError' });
const ERRORES_MICROFONO = {
  NotAllowedError: 'Permití el acceso al micrófono en el navegador para hablar.',
  NotFoundError: 'No se encontró un micrófono conectado.',
  NotReadableError: 'El micrófono está ocupado. Cerrá otras aplicaciones que lo estén usando.',
};

/** MediaRecorder → Gemini (como chatbot-con-voz) → voz del navegador, sin chat visible. */
export function crearSesionVoz({ entorno = globalThis, fetchFn = globalThis.fetch?.bind(globalThis), ahora = Date.now, cada = setInterval, limpiar = clearInterval } = {}) {
  let estado = { fase: 'inactivo', error: '' };
  let actual = null;
  let historial = [];
  const oyentes = new Set();
  const emitir = (cambios) => { estado = { ...estado, ...cambios }; oyentes.forEach((o) => o()); };
  const vigente = (turno) => actual === turno && !turno.controller.signal.aborted;
  const verificar = (turno) => { if (!vigente(turno)) throw abortado(); };

  function liberarCaptura(captura) {
    if (!captura || captura.liberada) return;
    captura.liberada = true;
    limpiar(captura.intervalo);
    captura.stream?.getTracks().forEach((track) => track.stop());
    try { captura.source?.disconnect(); } catch { /* ya desconectado */ }
    try { captura.contexto?.close()?.catch(() => {}); } catch { /* ya cerrado */ }
  }

  function cancelar() {
    const turno = actual;
    actual = null;
    if (turno) {
      turno.controller.abort();
      const captura = turno.captura;
      if (captura) {
        captura.rechazar?.(abortado());
        if (captura.recorder?.state === 'recording') captura.recorder.stop();
        liberarCaptura(captura);
      }
      if (turno.enunciado) {
        turno.terminarVoz?.(abortado());
        entorno.speechSynthesis?.cancel();
      }
    }
    emitir({ fase: 'inactivo', error: '' });
  }

  function terminarEscucha(enviar = true) {
    const captura = actual?.captura;
    if (captura?.recorder?.state !== 'recording') return;
    captura.enviar = enviar;
    limpiar(captura.intervalo);
    captura.recorder.stop();
    liberarCaptura(captura);
  }

  async function grabar(turno) {
    emitir({ fase: 'solicitando', error: '' });
    const stream = await entorno.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (!vigente(turno)) { stream.getTracks().forEach((t) => t.stop()); throw abortado(); }
    const captura = { stream, enviar: true, liberada: false };
    turno.captura = captura;
    try {
      const Contexto = entorno.AudioContext || entorno.webkitAudioContext;
      captura.contexto = new Contexto();
      await captura.contexto.resume();
      verificar(turno);
      const analizador = captura.contexto.createAnalyser();
      analizador.fftSize = 2048;
      captura.source = captura.contexto.createMediaStreamSource(stream);
      captura.source.connect(analizador);
      const mimeType = FORMATOS_GRABACION.find((tipo) => entorno.MediaRecorder.isTypeSupported(tipo));
      if (!mimeType) throw new Error('El navegador no permite grabar un formato compatible. Probá con Brave, Edge o Chrome.');
      const recorder = new entorno.MediaRecorder(stream, { mimeType });
      captura.recorder = recorder;
      const partes = [];
      let bytes = 0;
      const detector = crearDetectorFinDeFrase(ahora());
      const muestras = new Float32Array(analizador.fftSize);
      return await new Promise((resolve, reject) => {
        captura.rechazar = reject;
        recorder.ondataavailable = ({ data }) => {
          if (!vigente(turno) || !data?.size) return;
          bytes += data.size;
          if (bytes > MAX_BYTES) {
            captura.enviar = false;
            reject(new Error('La grabación es demasiado grande. Probá una frase más corta.'));
            terminarEscucha(false);
          } else partes.push(data);
        };
        recorder.onerror = () => {
          reject(new Error('No se pudo grabar el audio. Revisá el micrófono y volvé a intentar.'));
          liberarCaptura(captura);
        };
        recorder.onstop = () => {
          liberarCaptura(captura);
          if (!vigente(turno)) return reject(abortado());
          if (!captura.enviar) return reject(new Error('No se escuchó una frase. Tocá la card para volver a intentar.'));
          const audio = new Blob(partes, { type: recorder.mimeType });
          if (!audio.size) return reject(new Error('No llegó audio del micrófono. Volvé a intentar.'));
          resolve(audio);
        };
        recorder.start(250);
        emitir({ fase: 'escuchando' });
        captura.intervalo = cada(() => {
          if (!vigente(turno)) return;
          analizador.getFloatTimeDomainData(muestras);
          let cuadrados = 0;
          for (const muestra of muestras) cuadrados += muestra * muestra;
          const fin = detector(Math.sqrt(cuadrados / muestras.length), ahora());
          if (fin.terminar) terminarEscucha(fin.enviar);
        }, 50);
      });
    } catch (error) {
      if (captura.recorder?.state === 'recording') captura.recorder.stop();
      throw error;
    } finally { liberarCaptura(captura); }
  }

  async function solicitar(url, opciones, turno, maximoMs) {
    const timer = setTimeout(() => turno.controller.abort(), maximoMs);
    try {
      const respuesta = await fetchFn(url, { ...opciones, signal: turno.controller.signal });
      const datos = await respuesta.json();
      verificar(turno);
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la respuesta por voz.');
      return datos;
    } finally { clearTimeout(timer); }
  }

  async function hablar(texto, turno) {
    const fragmentos = fragmentosParaVoz(texto);
    if (!fragmentos.length) throw new Error('No llegó una respuesta para reproducir.');
    const voz = elegirVozVyta(entorno.speechSynthesis.getVoices());
    for (const fragmento of fragmentos) {
      verificar(turno);
      await new Promise((resolve, reject) => {
        const speech = new entorno.SpeechSynthesisUtterance(fragmento);
        turno.enunciado = speech;
        turno.terminarVoz = reject;
        speech.lang = voz?.lang || 'es-AR';
        speech.rate = 0.95;
        speech.pitch = 1;
        if (voz) speech.voice = voz;
        speech.onstart = () => { if (vigente(turno)) emitir({ fase: 'hablando' }); };
        speech.onend = () => {
          turno.enunciado = null;
          turno.terminarVoz = null;
          resolve();
        };
        speech.onerror = () => {
          turno.enunciado = null;
          turno.terminarVoz = null;
          reject(new Error('No se pudo reproducir la voz. Revisá el audio del navegador y volvé a intentar.'));
        };
        entorno.speechSynthesis.speak(speech);
      });
    }
  }

  async function iniciar() {
    cancelar();
    if (!entorno.isSecureContext || !entorno.navigator?.mediaDevices?.getUserMedia || !entorno.MediaRecorder || !(entorno.AudioContext || entorno.webkitAudioContext)) {
      emitir({ error: 'Para hablar necesitás un micrófono y abrir la app en HTTPS o localhost.' });
      return;
    }
    if (!entorno.speechSynthesis || !entorno.SpeechSynthesisUtterance) {
      emitir({ error: 'Este navegador no puede reproducir voz. Probá con Brave, Edge o Chrome.' });
      return;
    }
    const turno = { controller: new AbortController() };
    actual = turno;
    // Dispara la carga de voces durante el gesto de la persona.
    entorno.speechSynthesis.getVoices();
    try {
      const audio = await grabar(turno);
      verificar(turno);
      emitir({ fase: 'transcribiendo' });
      const transcripcion = await solicitar('/api/voz/transcribir', { method: 'POST', headers: { 'Content-Type': audio.type }, body: audio }, turno, 30000);
      if (typeof transcripcion.text !== 'string' || !transcripcion.text.trim()) throw new Error('No se reconoció una frase. Tocá la card para volver a intentar.');
      emitir({ fase: 'pensando' });
      const respuesta = await solicitar('/api/voz/responder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: transcripcion.text, history: historial.slice(-20) }),
      }, turno, 40000);
      if (typeof respuesta.reply !== 'string' || !respuesta.reply.trim()) throw new Error('No llegó una respuesta. Volvé a intentar.');
      historial = [...historial, { role: 'user', text: transcripcion.text }, { role: 'assistant', text: respuesta.reply }].slice(-20);
      await hablar(respuesta.reply, turno);
      verificar(turno);
      actual = null;
      emitir({ fase: 'inactivo' });
    } catch (error) {
      if (actual !== turno) return;
      actual = null;
      liberarCaptura(turno.captura);
      emitir({ fase: 'inactivo', error: ERRORES_MICROFONO[error.name] || (error.name === 'AbortError' ? 'La respuesta tardó demasiado. Tocá la card para volver a intentar.' : error.message || 'No se pudo usar la voz. Volvé a intentar.') });
    }
  }

  return {
    obtener: () => estado,
    suscribir: (oyente) => { oyentes.add(oyente); return () => oyentes.delete(oyente); },
    iniciar, cancelar,
    terminarEscucha: () => terminarEscucha(true),
    tocar() {
      if (estado.fase === 'escuchando') terminarEscucha(true);
      else if (['solicitando', 'transcribiendo', 'pensando'].includes(estado.fase)) cancelar();
      else return iniciar();
    },
  };
}
