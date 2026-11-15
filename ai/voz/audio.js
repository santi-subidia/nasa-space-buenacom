import { textoParaVoz } from '../vega/texto.js';

export const FORMATOS_GRABACION = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

const MAX_BYTES = 5 * 1024 * 1024;
const ERRORES_MICROFONO = {
  NotAllowedError: { codigo: 'not-allowed', mensaje: 'Allow microphone access in your browser to speak.' },
  NotFoundError: { codigo: 'audio-capture', mensaje: 'No connected microphone was found.' },
  NotReadableError: { codigo: 'audio-capture', mensaje: 'Microphone is busy. Close other apps using it.' },
};

const errorConCodigo = (mensaje, codigo) => Object.assign(new Error(mensaje), { codigo });
const abortado = () => Object.assign(errorConCodigo('Turn canceled', 'aborted'), { name: 'AbortError' });

export function soportaGrabacionAudio(entorno = globalThis) {
  return Boolean(
    entorno?.isSecureContext !== false &&
      entorno?.navigator?.mediaDevices?.getUserMedia &&
      entorno?.MediaRecorder &&
      (entorno?.AudioContext || entorno?.webkitAudioContext),
  );
}

export function elegirVozVyta(voces = []) {
  const english = voces.filter((v) => /^en(?:[-_]|$)/i.test(v.lang));
  return english.find((v) => /Samantha|Jenny|Aria|Natural/i.test(v.name) && /^en[-_]US$/i.test(v.lang))
    || english.find((v) => /^en[-_]US$/i.test(v.lang))
    || english.find((v) => /Google|Natural|Online/i.test(v.name))
    || english[0];
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

function liberarCaptura(captura, limpiar, mantenerCanal = false) {
  if (!captura || captura.liberada) return;
  captura.liberada = true;
  limpiar(captura.intervalo);
  if (mantenerCanal) return;
  captura.stream?.getTracks?.().forEach((track) => track.stop());
  try { captura.source?.disconnect(); } catch { /* ya desconectado */ }
  try { captura.contexto?.close?.()?.catch?.(() => {}); } catch { /* ya cerrado */ }
}

/** Abre un canal de micrófono persistente para modo conversación continua (evita reabrir getUserMedia en Safari). */
export async function abrirCanalAudio({ entorno = globalThis } = {}) {
  let stream;
  try {
    stream = await entorno.navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (error) {
    const conocido = ERRORES_MICROFONO[error?.name];
    if (conocido) throw errorConCodigo(conocido.mensaje, conocido.codigo);
    throw errorConCodigo(error?.message || 'Could not access the microphone.', 'audio-capture');
  }
  try {
    const Contexto = entorno.AudioContext || entorno.webkitAudioContext;
    const contexto = new Contexto();
    await contexto.resume();
    const analizador = contexto.createAnalyser();
    analizador.fftSize = 2048;
    const source = contexto.createMediaStreamSource(stream);
    source.connect(analizador);
    return { stream, contexto, analizador, source, muestras: new Float32Array(analizador.fftSize), cerrado: false };
  } catch (error) {
    stream.getTracks?.().forEach((t) => t.stop());
    throw error;
  }
}

export function cerrarCanalAudio(canal) {
  if (!canal || canal.cerrado) return;
  canal.cerrado = true;
  canal.stream?.getTracks?.().forEach((track) => track.stop());
  try { canal.source?.disconnect(); } catch { /* ya desconectado */ }
  try { canal.contexto?.close?.()?.catch?.(() => {}); } catch { /* ya cerrado */ }
}

export function medirRmsCanal(canal) {
  if (!canal || canal.cerrado) return 0;
  canal.analizador.getFloatTimeDomainData(canal.muestras);
  let cuadrados = 0;
  for (const muestra of canal.muestras) cuadrados += muestra * muestra;
  return Math.sqrt(cuadrados / canal.muestras.length);
}

/** Vigila el micrófono mientras VYTA habla para detectar interrupción (barge-in) con eco cancelado. */
export function iniciarMonitorBargeIn({
  canal,
  umbral = 0.055,
  confirmacionMs = 220,
  graciaMs = 350,
  ahora = Date.now,
  cada = setInterval,
  limpiar = clearInterval,
  alInterrumpir = () => {},
  onNivel = () => {},
} = {}) {
  if (!canal || canal.cerrado) return () => {};
  const inicio = ahora();
  let anterior = inicio;
  let vozAcumulada = 0;
  let disparado = false;
  const id = cada(() => {
    if (disparado || canal.cerrado) return;
    const t = ahora();
    const paso = Math.min(100, Math.max(0, t - anterior));
    anterior = t;
    const rms = medirRmsCanal(canal);
    onNivel(Math.min(1, rms * 10));
    if (t - inicio < graciaMs) return;
    if (rms >= umbral) {
      vozAcumulada += paso;
      if (vozAcumulada >= confirmacionMs) {
        disparado = true;
        limpiar(id);
        alInterrumpir();
      }
    } else {
      vozAcumulada = Math.max(0, vozAcumulada - paso * 0.5);
    }
  }, 50);
  return () => {
    disparado = true;
    limpiar(id);
  };
}

/** Graba una frase con MediaRecorder + AudioContext (compatible con Safari/Chrome) y corta tras el silencio. */
export async function grabarAudio({
  entorno = globalThis,
  canal: canalExterno = null,
  signal,
  alEstado = () => {},
  registrarControl = () => {},
  onNivel = () => {},
  ahora = Date.now,
  cada = setInterval,
  limpiar = clearInterval,
  detectorOpciones = {},
} = {}) {
  if (signal?.aborted) throw abortado();
  const esPersistente = Boolean(canalExterno && !canalExterno.cerrado);
  let canal = esPersistente ? canalExterno : null;
  if (!canal) {
    alEstado('solicitando');
    canal = await abrirCanalAudio({ entorno });
  }
  if (signal?.aborted) {
    if (!esPersistente) cerrarCanalAudio(canal);
    throw abortado();
  }

  const captura = { ...canal, enviar: true, liberada: false };
  const terminar = (enviar = true) => {
    if (captura.recorder?.state !== 'recording') return;
    captura.enviar = enviar;
    limpiar(captura.intervalo);
    captura.recorder.stop();
    liberarCaptura(captura, limpiar, esPersistente);
  };
  const cancelar = () => {
    captura.enviar = false;
    captura.rechazar?.(abortado());
    if (captura.recorder?.state === 'recording') {
      try { captura.recorder.stop(); } catch { /* ya detenido */ }
    }
    liberarCaptura(captura, limpiar, esPersistente);
  };
  registrarControl({ terminar, cancelar });
  signal?.addEventListener?.('abort', cancelar, { once: true });

  try {
    await canal.contexto.resume?.();
    if (signal?.aborted) throw abortado();

    const mimeType = FORMATOS_GRABACION.find((tipo) => entorno.MediaRecorder.isTypeSupported(tipo));
    if (!mimeType) throw errorConCodigo('This browser cannot record a compatible format. Try Safari, Chrome, Edge, or Brave.', 'no-soportado');

    const recorder = new entorno.MediaRecorder(canal.stream, { mimeType });
    captura.recorder = recorder;
    const partes = [];
    let bytes = 0;
    const detector = crearDetectorFinDeFrase(ahora(), detectorOpciones);

    return await new Promise((resolve, reject) => {
      captura.rechazar = reject;
      recorder.ondataavailable = ({ data }) => {
        if (signal?.aborted || !data?.size) return;
        bytes += data.size;
        if (bytes > MAX_BYTES) {
          captura.enviar = false;
          reject(errorConCodigo('Recording is too large. Try a shorter phrase.', 'audio-limit'));
          terminar(false);
        } else {
          partes.push(data);
        }
      };
      recorder.onerror = () => {
        reject(errorConCodigo('Could not record audio. Check your microphone and try again.', 'audio-capture'));
        liberarCaptura(captura, limpiar, esPersistente);
      };
      recorder.onstop = () => {
        liberarCaptura(captura, limpiar, esPersistente);
        onNivel(0);
        if (signal?.aborted) return reject(abortado());
        if (!captura.enviar) return reject(errorConCodigo('No phrase heard. Tap to try again.', 'no-speech'));
        const audio = new Blob(partes, { type: recorder.mimeType || mimeType });
        if (!audio.size) return reject(errorConCodigo('No audio arrived from microphone. Try again.', 'no-speech'));
        resolve(audio);
      };
      recorder.start(250);
      alEstado('escuchando');
      captura.intervalo = cada(() => {
        if (signal?.aborted) return;
        const rms = medirRmsCanal(canal);
        onNivel(Math.min(1, rms * 11));
        const fin = detector(rms, ahora());
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
    liberarCaptura(captura, limpiar, esPersistente);
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
      throw errorConCodigo(datos.error || 'Could not transcribe speech.', codigo);
    }
    if (typeof datos.text !== 'string' || !datos.text.trim()) {
      throw errorConCodigo('No phrase recognized. Tap to try again.', 'no-speech');
    }
    return datos.text.trim();
  } catch (error) {
    if (error?.name === 'AbortError') throw signal?.aborted ? abortado() : errorConCodigo('Transcription took too long. Try again.', 'timeout');
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
  alPulso = () => {},
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
      speech.lang = voz?.lang || 'en-US';
      speech.rate = rate;
      speech.pitch = 1;
      if (voz) speech.voice = voz;
      speech.onstart = () => { if (verificarVigente()) alIniciar(); };
      speech.onboundary = () => { if (verificarVigente()) alPulso(0.72); };
      speech.onend = () => {
        registrarEnunciado(null, null);
        alPulso(0);
        resolve();
      };
      speech.onerror = () => {
        registrarEnunciado(null, null);
        alPulso(0);
        reject(errorConCodigo('Could not play voice audio. Check browser audio and try again.', 'tts'));
      };
      alPreparar();
      sintesis.speak(speech);
    });
  }
}
