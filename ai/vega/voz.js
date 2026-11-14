// Voz de Vega con la Web Speech API del navegador (gratis, no gasta tokens).
//   - SpeechRecognition (webkitSpeechRecognition en Chrome): oír al tripulante. En Chrome necesita internet.
//   - speechSynthesis: leer la respuesta en voz alta, con voz en español.
//
// Se escribe sin tocar `window` directamente (recibe `ventana`) para poder probarlo con simulaciones.

const IDIOMAS_PREFERIDOS = ['es-AR', 'es-419', 'es-MX', 'es-US', 'es-ES'];

/** Elige la mejor voz en español disponible; null si no hay ninguna. */
export function elegirVoz(voces = []) {
  const espanolas = voces.filter((v) => v.lang?.toLowerCase().startsWith('es'));
  if (!espanolas.length) return null;
  for (const idioma of IDIOMAS_PREFERIDOS) {
    const exacta = espanolas.find((v) => v.lang.replace('_', '-').toLowerCase() === idioma.toLowerCase());
    if (exacta) return exacta;
  }
  return espanolas[0];
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
 * @param {object} [opciones.ventana=globalThis]  donde viven SpeechRecognition y speechSynthesis
 * @param {(estado:'inactivo'|'escuchando'|'hablando', datos?:object)=>void} [opciones.alCambiar]
 * @param {(texto:string)=>void} [opciones.alOirParcial]  texto parcial mientras se habla (ondas / subtítulo)
 */
export function crearVoz({ ventana = globalThis, alCambiar = () => {}, alOirParcial = () => {} } = {}) {
  const Reconocimiento = ventana.SpeechRecognition ?? ventana.webkitSpeechRecognition ?? null;
  const sintesis = ventana.speechSynthesis ?? null;
  const Enunciado = ventana.SpeechSynthesisUtterance ?? null;

  let reconocimiento = null;
  let hablando = null; // { enunciado, resolver }

  const soportaReconocimiento = Boolean(Reconocimiento);
  const soportaSintesis = Boolean(sintesis && Enunciado);

  /** Escucha una frase. Resuelve con el texto final; rechaza con { codigo, mensaje }. */
  function escuchar() {
    if (!soportaReconocimiento) {
      return Promise.reject({ codigo: 'no-soportado', mensaje: 'Este navegador no reconoce voz. Usá Chrome o escribí la pregunta.' });
    }
    callar();
    detenerEscucha();
    return new Promise((resolver, rechazar) => {
      const r = new Reconocimiento();
      reconocimiento = r;
      r.lang = 'es-AR';
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;

      let final = '';
      let error = null;
      r.onresult = (evento) => {
        let parcial = '';
        for (let i = evento.resultIndex ?? 0; i < evento.results.length; i++) {
          const resultado = evento.results[i];
          const texto = resultado[0]?.transcript ?? '';
          if (resultado.isFinal) final += texto;
          else parcial += texto;
        }
        alOirParcial((final + parcial).trim());
      };
      r.onerror = (evento) => {
        error = evento.error;
      };
      r.onend = () => {
        // Un reconocimiento viejo (cortado con abort) no debe pisar el estado del nuevo.
        if (reconocimiento === r) {
          reconocimiento = null;
          alCambiar('inactivo');
        }
        if (error === 'aborted') rechazar({ codigo: 'aborted', mensaje: '' });
        else if (error) rechazar({ codigo: error, mensaje: ERRORES_DE_MICROFONO[error] ?? 'No pude usar el micrófono.' });
        else if (final.trim()) resolver(final.trim());
        else rechazar({ codigo: 'no-speech', mensaje: ERRORES_DE_MICROFONO['no-speech'] });
      };
      alCambiar('escuchando');
      try {
        r.start();
      } catch (e) {
        reconocimiento = null;
        alCambiar('inactivo');
        rechazar({ codigo: 'start', mensaje: 'No pude empezar a escuchar.' });
      }
    });
  }

  function detenerEscucha() {
    try {
      reconocimiento?.abort?.();
    } catch {
      /* ya estaba detenido */
    }
    reconocimiento = null;
  }

  /** Lee el texto en voz alta. Resuelve cuando termina (o al cortarla). Sin síntesis, resuelve al instante. */
  function hablar(texto) {
    if (!soportaSintesis || !texto?.trim()) return Promise.resolve();
    callar();
    return new Promise((resolver) => {
      const enunciado = new Enunciado(texto);
      enunciado.lang = 'es-AR';
      enunciado.rate = 1.02;
      const voz = elegirVoz(sintesis.getVoices?.() ?? []);
      if (voz) {
        enunciado.voice = voz;
        enunciado.lang = voz.lang;
      }
      const terminar = () => {
        // Un enunciado cancelado no debe pisar el estado del siguiente.
        if (hablando?.enunciado === enunciado) {
          hablando = null;
          alCambiar('inactivo');
        }
        resolver();
      };
      enunciado.onend = terminar;
      enunciado.onerror = terminar;
      hablando = { enunciado, resolver };
      alCambiar('hablando');
      sintesis.speak(enunciado);
    });
  }

  /** Corta la lectura en curso. */
  function callar() {
    if (!hablando) return;
    const { resolver } = hablando;
    hablando = null;
    sintesis?.cancel?.();
    alCambiar('inactivo');
    resolver();
  }

  return {
    soportaReconocimiento,
    soportaSintesis,
    escuchar,
    pararDeEscuchar: detenerEscucha,
    hablar,
    callar,
  };
}
