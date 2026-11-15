// Voz unificada (VYTA / Vega):
//   - Principal (compatible con Safari, Chrome, Edge, Firefox): MediaRecorder + AudioContext → /api/voz/transcribir (Gemini).
//   - Respaldo: SpeechRecognition cuando el entorno no ofrece MediaRecorder + AudioContext.
//   - Síntesis: speechSynthesis con selección de voz es-AR y fragmentación segura de frases.
import {
  abrirCanalAudio,
  cerrarCanalAudio,
  elegirVozVyta,
  grabarAudio,
  iniciarMonitorBargeIn,
  reproducirFragmentosVoz,
  soportaGrabacionAudio,
  transcribirAudio,
} from '../voz/audio.js';

/** Elige la mejor voz en español disponible; null si no hay ninguna. */
export function elegirVoz(voces = []) {
  return elegirVozVyta(voces) ?? null;
}

export const ERRORES_DE_MICROFONO = {
  'not-allowed': 'No tengo permiso para usar el micrófono. Permitilo en el navegador o escribí la pregunta.',
  'service-not-allowed': 'El navegador no me deja usar el reconocimiento de voz. Escribí la pregunta.',
  'no-speech': 'No te escuché. Probá de nuevo, un poco más cerca del micrófono.',
  'audio-capture': 'No encuentro un micrófono conectado.',
  network: 'El reconocimiento de voz del navegador necesita internet. Escribí la pregunta.',
  aborted: '',
};

/**
 * @param {object} [opciones]
 * @param {object} [opciones.ventana=globalThis]  donde viven MediaRecorder/AudioContext, SpeechRecognition y speechSynthesis
 * @param {(estado:'inactivo'|'solicitando'|'escuchando'|'transcribiendo'|'hablando', datos?:object)=>void} [opciones.alCambiar]
 * @param {(texto:string)=>void} [opciones.alOirParcial]  texto parcial mientras se habla (si usa SpeechRecognition)
 * @param {number} [opciones.pausaSilencioMs=1800]  silencio tras la última palabra antes de enviar
 */
export function crearVoz({
  ventana = globalThis,
  alCambiar = () => {},
  alOirParcial = () => {},
  alNivel = () => {},
  alPulso = () => {},
  pausaSilencioMs = 1800,
  fetchFn = globalThis.fetch?.bind(globalThis),
  urlTranscribir = '/api/voz/transcribir',
  ahora = Date.now,
  cada = setInterval,
  limpiar = clearInterval,
} = {}) {
  const Reconocimiento = ventana.SpeechRecognition ?? ventana.webkitSpeechRecognition ?? null;
  const sintesis = ventana.speechSynthesis ?? null;
  const Enunciado = ventana.SpeechSynthesisUtterance ?? null;

  let escuchaActiva = null; // { cancelar, finalizar }
  let hablando = null; // { cancelado, terminarEnunciado, resolver }
  let canalPersistente = null;

  const soportaGrabacion = soportaGrabacionAudio(ventana);
  const soportaReconocimiento = Boolean(soportaGrabacion || Reconocimiento);
  const soportaSintesis = Boolean(sintesis && Enunciado);

  function escucharConGrabacion(opciones = {}) {
    const controller = new AbortController();
    let controlGrabacion = null;
    const sesionEscucha = {
      finalizar: () => controlGrabacion?.terminar?.(true),
      cancelar: () => {
        if (escuchaActiva !== sesionEscucha) return;
        escuchaActiva = null;
        controller.abort();
        controlGrabacion?.cancelar?.();
        alNivel(0);
        alCambiar('inactivo');
      },
    };
    escuchaActiva = sesionEscucha;

    return (async () => {
      try {
        const audio = await grabarAudio({
          entorno: ventana,
          canal: canalPersistente,
          signal: controller.signal,
          alEstado: (estado) => {
            if (escuchaActiva === sesionEscucha) alCambiar(estado);
          },
          registrarControl: (control) => {
            controlGrabacion = control;
          },
          onNivel: (nivel) => {
            if (escuchaActiva === sesionEscucha) alNivel(nivel);
          },
          ahora,
          cada,
          limpiar,
          detectorOpciones: {
            silencioMs: opciones.pausaSilencioMs ?? (canalPersistente ? 1500 : pausaSilencioMs),
            ...(opciones.esperaMs ? { esperaMs: opciones.esperaMs } : {}),
          },
        });
        if (controller.signal.aborted || escuchaActiva !== sesionEscucha) {
          throw { codigo: 'aborted', mensaje: '' };
        }
        alCambiar('transcribiendo');
        const texto = await transcribirAudio({
          audio,
          fetchFn,
          url: urlTranscribir,
          signal: controller.signal,
        });
        if (escuchaActiva === sesionEscucha) {
          escuchaActiva = null;
          alCambiar('inactivo');
        }
        return texto;
      } catch (error) {
        if (escuchaActiva === sesionEscucha) {
          escuchaActiva = null;
          alCambiar('inactivo');
        }
        if (error?.codigo === 'aborted' || error?.name === 'AbortError') {
          throw { codigo: 'aborted', mensaje: '' };
        }
        throw {
          codigo: error?.codigo || 'audio-capture',
          mensaje: error?.message || error?.mensaje || 'No pude usar el micrófono.',
        };
      }
    })();
  }

  function escucharConWebSpeech() {
    return new Promise((resolver, rechazar) => {
      const r = new Reconocimiento();
      r.lang = 'es-AR';
      r.interimResults = true;
      r.continuous = true;
      r.maxAlternatives = 3;

      const esContinuoReal = typeof r.stop === 'function';
      let prefijoAcumulado = '';
      const segmentos = [];
      let ultimoTexto = '';
      let error = null;
      let listoParaCerrar = false;
      let abortado = false;
      let temporizadorSilencio = null;

      function reconstruirTexto() {
        const actual = segmentos.map((s) => s?.texto).filter(Boolean).join(' ').trim();
        return [prefijoAcumulado, actual].filter(Boolean).join(' ').trim();
      }

      function programarCierrePorSilencio() {
        if (!esContinuoReal) return;
        clearTimeout(temporizadorSilencio);
        temporizadorSilencio = setTimeout(() => {
          if (escuchaActiva?.instancia !== r || abortado) return;
          listoParaCerrar = true;
          try {
            r.stop();
          } catch {
            r.onend?.();
          }
        }, pausaSilencioMs);
      }

      const sesionEscucha = {
        instancia: r,
        finalizar: () => {
          if (escuchaActiva?.instancia !== r || abortado) return;
          if (!ultimoTexto.trim()) {
            detenerEscucha();
            return;
          }
          listoParaCerrar = true;
          clearTimeout(temporizadorSilencio);
          try {
            if (typeof r.stop === 'function') r.stop();
            else r.onend?.();
          } catch {
            r.onend?.();
          }
        },
        cancelar: () => {
          abortado = true;
          clearTimeout(temporizadorSilencio);
          try {
            r.abort?.();
          } catch {
            /* ya estaba detenido */
          }
          if (escuchaActiva?.instancia === r) {
            escuchaActiva = null;
            alCambiar('inactivo');
          }
          rechazar({ codigo: 'aborted', mensaje: '' });
        },
      };
      escuchaActiva = sesionEscucha;

      r.onresult = (evento) => {
        for (let i = evento.resultIndex ?? 0; i < evento.results.length; i++) {
          const resultado = evento.results[i];
          const texto = (resultado?.[0]?.transcript ?? '').trim();
          if (texto) {
            segmentos[i] = { texto, esFinal: Boolean(resultado.isFinal) };
          }
        }
        const unido = reconstruirTexto();
        if (unido) {
          ultimoTexto = unido;
          alOirParcial(unido);
          programarCierrePorSilencio();
        }
      };
      r.onerror = (evento) => {
        error = evento.error;
        if (error === 'aborted') abortado = true;
      };
      r.onend = () => {
        if (!abortado && !listoParaCerrar && esContinuoReal && ultimoTexto.trim() && (!error || error === 'no-speech')) {
          prefijoAcumulado = ultimoTexto.trim();
          segmentos.length = 0;
          error = null;
          try {
            r.start();
            return;
          } catch {
            /* si no se puede reanudar, cerramos con lo capturado */
          }
        }

        clearTimeout(temporizadorSilencio);
        if (escuchaActiva?.instancia === r) {
          escuchaActiva = null;
          alCambiar('inactivo');
        }
        if (abortado || error === 'aborted') rechazar({ codigo: 'aborted', mensaje: '' });
        else if (ultimoTexto.trim() && (!error || error === 'no-speech')) resolver(ultimoTexto.trim());
        else if (error) rechazar({ codigo: error, mensaje: ERRORES_DE_MICROFONO[error] ?? 'No pude usar el micrófono.' });
        else rechazar({ codigo: 'no-speech', mensaje: ERRORES_DE_MICROFONO['no-speech'] });
      };
      alCambiar('escuchando');
      try {
        r.start();
      } catch {
        clearTimeout(temporizadorSilencio);
        escuchaActiva = null;
        alCambiar('inactivo');
        rechazar({ codigo: 'start', mensaje: 'No pude empezar a escuchar.' });
      }
    });
  }

  /** Escucha una frase. Resuelve con el texto final; rechaza con { codigo, mensaje }. */
  function escuchar(opciones = {}) {
    if (!soportaReconocimiento) {
      return Promise.reject({ codigo: 'no-soportado', mensaje: 'Este navegador no reconoce voz. Probá con Safari o Chrome, o escribí la pregunta.' });
    }
    callar();
    detenerEscucha();
    // Dispara la carga de voces durante el gesto del toque (clave en Safari).
    sintesis?.getVoices?.();
    return soportaGrabacion ? escucharConGrabacion(opciones) : escucharConWebSpeech();
  }

  async function abrirCanalContinuo() {
    if (!soportaGrabacion) return false;
    if (canalPersistente && !canalPersistente.cerrado) return true;
    alCambiar('solicitando');
    try {
      canalPersistente = await abrirCanalAudio({ entorno: ventana });
      return true;
    } catch (error) {
      alCambiar('inactivo');
      throw {
        codigo: error?.codigo || 'audio-capture',
        mensaje: error?.message || error?.mensaje || 'No pude usar el micrófono.',
      };
    }
  }

  function cerrarCanalContinuo() {
    if (!canalPersistente) return;
    cerrarCanalAudio(canalPersistente);
    canalPersistente = null;
    alNivel(0);
  }

  function vigilarInterrupcion(alInterrumpir, opciones = {}) {
    if (!canalPersistente || canalPersistente.cerrado) return () => {};
    return iniciarMonitorBargeIn({
      canal: canalPersistente,
      ahora,
      cada,
      limpiar,
      alInterrumpir,
      ...opciones,
    });
  }

  function detenerEscucha() {
    const actual = escuchaActiva;
    if (!actual) return;
    actual.cancelar();
  }

  /** Lee el texto en voz alta en fragmentos cortos. Resuelve cuando termina (o al cortarla). */
  function hablar(texto) {
    if (!soportaSintesis || !texto?.trim()) return Promise.resolve();
    callar();
    return new Promise((resolver) => {
      const actual = { cancelado: false, terminarEnunciado: null, resolver };
      hablando = actual;
      const finalizar = () => {
        alPulso(0);
        if (hablando === actual) {
          hablando = null;
          alCambiar('inactivo');
        }
        resolver();
      };
      reproducirFragmentosVoz({
        entorno: ventana,
        texto,
        rate: 0.95,
        alPreparar: () => {
          if (!actual.cancelado && hablando === actual) alCambiar('hablando');
        },
        alIniciar: () => {
          if (!actual.cancelado && hablando === actual) alCambiar('hablando');
        },
        alPulso: (nivel) => {
          if (!actual.cancelado && hablando === actual) alPulso(nivel);
        },
        verificarVigente: () => !actual.cancelado && hablando === actual,
        registrarEnunciado: (_speech, cancelar) => {
          actual.terminarEnunciado = cancelar;
        },
      }).then(finalizar, finalizar);
    });
  }

  /** Corta la lectura en curso. */
  function callar() {
    if (!hablando) return;
    const actual = hablando;
    actual.cancelado = true;
    hablando = null;
    alPulso(0);
    sintesis?.cancel?.();
    actual.terminarEnunciado?.(new Error('Voz detenida'));
    alCambiar('inactivo');
    actual.resolver();
  }

  return {
    soportaReconocimiento,
    soportaSintesis,
    escuchar,
    finalizarEscucha: () => escuchaActiva?.finalizar?.(),
    pararDeEscuchar: detenerEscucha,
    abrirCanalContinuo,
    cerrarCanalContinuo,
    vigilarInterrupcion,
    hablar,
    callar,
  };
}
