import { textoParaVoz } from '../vega/texto.js';

export const FORMATOS_GRABACION = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

const MAX_BYTES = 5 * 1024 * 1024;
const ERRORES_MICROFONO = {
  NotAllowedError: { codigo: 'not-allowed', mensaje: 'Permití el acceso al micrófono en el navegador para hablar.' },
  NotFoundError: { codigo: 'audio-capture', mensaje: 'No se encontró un micrófono conectado.' },
  NotReadableError: { codigo: 'audio-capture', mensaje: 'El micrófono está ocupado. Cerrá otras aplicaciones que lo estén usando.' },
};

const errorConCodigo = (mensaje, codigo) => Object.assign(new Error(mensaje), { codigo });
const abortado = () => Object.assign(errorConCodigo('Turno cancelado', 'aborted'), { name: 'AbortError' });

export function soportaGrabacionAudio(entorno = globalThis) {
  return Boolean(
    entorno?.isSecureContext !== false &&
      entorno?.navigator?.mediaDevices?.getUserMedia &&
      entorno?.MediaRecorder &&
      (entorno?.AudioContext || entorno?.webkitAudioContext),
  );
}

export function elegirVozVyta(voces = []) {
  const espanol = voces.filter((v) => /^es(?:[-_]|$)/i.test(v.lang));
  return espanol.find((v) => /Elena/i.test(v.name) && /^es[-_]AR$/i.test(v.lang))
    || espanol.find((v) => /^es[-_]AR$/i.test(v.lang))
    || espanol.find((v) => /Google|Natural|Online/i.test(v.name))
    || espanol[0];
}

export function fragmentosParaVoz(texto) {
  let pendiente = textoParaVoz(String(texto).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));
  const partes = [];
  while (pendiente.length > 180) {
    const tramo = pendiente.slice(0, 181);
    const frase = Math.max(tramo.lastIndexOf('. '), tramo.lastIndexOf('? '), tramo.lastIndexOf('! '));
    const espacio = tramo.lastIndexOf(' ');
    const corte = frase > 40 ? frase + 1 : espacio > 0 ? espacio : 180;
    partes.push(pendiente.slice(0, corte).trim());
    pendiente = pendiente.slice(corte).trim();
  }
  if (pendiente) partes.push(pendiente);
  return partes;
}

/** Detecta el fin de frase localmente; el silencio no se manda a transcribir. */
export function crearDetectorFinDeFrase(inicio, { silencioMs = 1800, esperaMs = 15000, maximoMs = 60000, umbral = 0.015 } = {}) {
  let anterior = inicio;
  let vozConsecutiva = 0;
  let huboVoz = false;
  let ultimaVoz = inicio;
  return (rms, ahora) => {
    const paso = Math.min(100, Math.max(0, ahora - anterior));
    anterior = ahora;
    if (rms >= umbral) {
      vozConsecutiva += paso;
      ultimaVoz = ahora;
      if (vozConsecutiva >= 150) huboVoz = true;
    } else vozConsecutiva = 0;
    if (ahora - inicio >= maximoMs) return { terminar: true, enviar: huboVoz };
    if (huboVoz && ahora - ultimaVoz >= silencioMs) return { terminar: true, enviar: true };
    if (!huboVoz && ahora - inicio >= esperaMs) return { terminar: true, enviar: false };
    return { terminar: false, enviar: false };
  };
}

function liberarCaptura(captura, limpiar) {
  if (!captura || captura.liberada) return;
  captura.liberada = true;
  limpiar(captura.intervalo);
  captura.stream?.getTracks?.().forEach((track) => track.stop());
  try { captura.source?.disconnect(); } catch { /* ya desconectado */ }
  try { captura.contexto?.close?.()?.catch?.(() => {}); } catch { /* ya cerrado */ }
}

/** Graba una frase con MediaRecorder + AudioContext (compatible con Safari/Chrome) y corta tras el silencio. */
export async function grabarAudio({
  entorno = globalThis,
  signal,
  alEstado = () => {},
  registrarControl = () => {},
  ahora = Date.now,
  cada = setInterval,
  limpiar = clearInterval,
  detectorOpciones = {},
} = {}) {
  if (signal?.aborted) throw abortado();
  alEstado('solicitando');
  let stream;
  try {
    stream = await entorno.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (error) {
    const conocido = ERRORES_MICROFONO[error?.name];
    if (conocido) throw errorConCodigo(conocido.mensaje, conocido.codigo);
    throw errorConCodigo(error?.message || 'No se pudo acceder al micrófono.', 'audio-capture');
  }
  if (signal?.aborted) {
    stream.getTracks?.().forEach((t) => t.stop());
    throw abortado();
  }

  const captura = { stream, enviar: true, liberada: false };
  const terminar = (enviar = true) => {
    if (captura.recorder?.state !== 'recording') return;
    captura.enviar = enviar;
    limpiar(captura.intervalo);
    captura.recorder.stop();
    liberarCaptura(captura, limpiar);
  };
  const cancelar = () => {
    captura.enviar = false;
    captura.rechazar?.(abortado());
    if (captura.recorder?.state === 'recording') {
      try { captura.recorder.stop(); } catch { /* ya detenido */ }
    }
    liberarCaptura(captura, limpiar);
  };
  registrarControl({ terminar, cancelar });
  signal?.addEventListener?.('abort', cancelar, { once: true });

  try {
    const Contexto = entorno.AudioContext || entorno.webkitAudioContext;
    captura.contexto = new Contexto();
    await captura.contexto.resume();
    if (signal?.aborted) throw abortado();

    const analizador = captura.contexto.createAnalyser();
    analizador.fftSize = 2048;
    captura.source = captura.contexto.createMediaStreamSource(stream);
    captura.source.connect(analizador);

    const mimeType = FORMATOS_GRABACION.find((tipo) => entorno.MediaRecorder.isTypeSupported(tipo));
    if (!mimeType) throw errorConCodigo('El navegador no permite grabar un formato compatible. Probá con Safari, Chrome, Edge o Brave.', 'no-soportado');

    const recorder = new entorno.MediaRecorder(stream, { mimeType });
    captura.recorder = recorder;
    const partes = [];
    let bytes = 0;
    const detector = crearDetectorFinDeFrase(ahora(), detectorOpciones);
    const muestras = new Float32Array(analizador.fftSize);

    return await new Promise((resolve, reject) => {
      captura.rechazar = reject;
      recorder.ondataavailable = ({ data }) => {
        if (signal?.aborted || !data?.size) return;
        bytes += data.size;
        if (bytes > MAX_BYTES) {
          captura.enviar = false;
          reject(errorConCodigo('La grabación es demasiado grande. Probá una frase más corta.', 'audio-limit'));
          terminar(false);
        } else {
          partes.push(data);
        }
      };
      recorder.onerror = () => {
        reject(errorConCodigo('No se pudo grabar el audio. Revisá el micrófono y volvé a intentar.', 'audio-capture'));
        liberarCaptura(captura, limpiar);
      };
      recorder.onstop = () => {
        liberarCaptura(captura, limpiar);
        if (signal?.aborted) return reject(abortado());
        if (!captura.enviar) return reject(errorConCodigo('No se escuchó una frase. Tocá para volver a intentar.', 'no-speech'));
        const audio = new Blob(partes, { type: recorder.mimeType || mimeType });
        if (!audio.size) return reject(errorConCodigo('No llegó audio del micrófono. Volvé a intentar.', 'no-speech'));
        resolve(audio);
      };
      recorder.start(250);
      alEstado('escuchando');
      captura.intervalo = cada(() => {
        if (signal?.aborted) return;
        analizador.getFloatTimeDomainData(muestras);
        let cuadrados = 0;
        for (const muestra of muestras) cuadrados += muestra * muestra;
        const fin = detector(Math.sqrt(cuadrados / muestras.length), ahora());
        if (fin.terminar) terminar(fin.enviar);
      }, 50);
    });
  } catch (error) {
    if (captura.recorder?.state === 'recording') {
      try { captura.recorder.stop(); } catch { /* ya detenido */ }
    }
    throw error;
  } finally {
    signal?.removeEventListener?.('abort', cancelar);
    registrarControl(null);
    liberarCaptura(captura, limpiar);
  }
}

/** Envía un Blob de audio a /api/voz/transcribir y devuelve el texto transcrito. */
export async function transcribirAudio({
  audio,
  fetchFn = globalThis.fetch?.bind(globalThis),
  url = '/api/voz/transcribir',
  signal,
  timeoutMs = 30000,
} = {}) {
  const controller = new AbortController();
  const abortar = () => controller.abort();
  signal?.addEventListener?.('abort', abortar, { once: true });
  const timer = setTimeout(abortar, timeoutMs);
  try {
    const respuesta = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': audio.type || 'audio/mp4' },
      body: audio,
      signal: controller.signal,
    });
    const datos = await respuesta.json();
    if (signal?.aborted) throw abortado();
    if (!respuesta.ok) {
      const codigo = respuesta.status === 422 ? 'no-speech' : respuesta.status === 503 ? 'service-unavailable' : 'network';
      throw errorConCodigo(datos.error || 'No se pudo transcribir la voz.', codigo);
    }
    if (typeof datos.text !== 'string' || !datos.text.trim()) {
      throw errorConCodigo('No se reconoció una frase. Tocá para volver a intentar.', 'no-speech');
    }
    return datos.text.trim();
  } catch (error) {
    if (error?.name === 'AbortError') throw signal?.aborted ? abortado() : errorConCodigo('La transcripción tardó demasiado. Volvé a intentar.', 'timeout');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', abortar);
  }
}

/** Lee `texto` en fragmentos cortos con la mejor voz en español disponible (compatible con Safari). */
export async function reproducirFragmentosVoz({
  entorno = globalThis,
  texto,
  rate = 0.95,
  alPreparar = () => {},
  alIniciar = () => {},
  verificarVigente = () => true,
  registrarEnunciado = () => {},
} = {}) {
  const fragmentos = fragmentosParaVoz(texto);
  if (!fragmentos.length) return;
  const sintesis = entorno.speechSynthesis;
  const Enunciado = entorno.SpeechSynthesisUtterance;
  if (!sintesis || !Enunciado) return;
  const voz = elegirVozVyta(sintesis.getVoices?.() ?? []);
  for (const fragmento of fragmentos) {
    if (!verificarVigente()) throw abortado();
    await new Promise((resolve, reject) => {
      const speech = new Enunciado(fragmento);
      const cancelar = (err) => {
        registrarEnunciado(null, null);
        reject(err);
      };
      registrarEnunciado(speech, cancelar);
      speech.lang = voz?.lang || 'es-AR';
      speech.rate = rate;
      speech.pitch = 1;
      if (voz) speech.voice = voz;
      speech.onstart = () => { if (verificarVigente()) alIniciar(); };
      speech.onend = () => {
        registrarEnunciado(null, null);
        resolve();
      };
      speech.onerror = () => {
        registrarEnunciado(null, null);
        reject(errorConCodigo('No se pudo reproducir la voz. Revisá el audio del navegador y volvé a intentar.', 'tts'));
      };
      alPreparar();
      sintesis.speak(speech);
    });
  }
}
