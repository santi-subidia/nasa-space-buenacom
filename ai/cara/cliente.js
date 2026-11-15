// "¿Cómo me ves hoy?" en el navegador: mide el parpadeo (muestras de MediaPipe), manda la foto base y la de
// hoy, y lee la observación en voz alta. Sin red o sin IA igual devuelve la lectura de fatiga del parpadeo.
// Las fotos solo se mandan con el consentimiento explícito de la persona; el servidor no las guarda.
import { AVISO_NO_DIAGNOSTICO } from './aviso.js';
import { analizarParpadeos, clasificarFatiga } from './parpadeo.js';

const TIEMPO_MAXIMO_MS = 40_000;

export function crearComoMeVes({ voz, fetchFn = globalThis.fetch?.bind(globalThis), url = '/api/claude' } = {}) {
  /**
   * @param {object} datos
   * @param {{media_type:string, data:string}} datos.fotoBase   foto del inicio de la misión
   * @param {{media_type:string, data:string}} datos.fotoHoy
   * @param {boolean} datos.consentimiento                      tiene que ser true
   * @param {{t:number, cierre:number}[]} [datos.muestrasParpadeo]  ≥ 10 s de blendshapes de MediaPipe
   */
  async function observar({ fotoBase, fotoHoy, consentimiento, muestrasParpadeo }, { hablar = true } = {}) {
    if (consentimiento !== true) {
      return { ok: false, error: 'Your consent is required to use the photos.', aviso: AVISO_NO_DIAGNOSTICO };
    }
    const parpadeo = muestrasParpadeo ? analizarParpadeos(muestrasParpadeo) : null;
    const fatiga = parpadeo ? clasificarFatiga(parpadeo) : null;

    let resultado = null;
    try {
      const respuesta = await fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo: 'face', fotoBase, fotoHoy, consentimiento: true, ...(parpadeo ? { parpadeo } : {}) }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      const cuerpo = await respuesta.json();
      if (respuesta.ok && cuerpo.comparacionDeIA) resultado = { ok: true, origen: cuerpo.origen, ...cuerpo };
    } catch {
      /* sin red o servidor caído */
    }

    if (!resultado) {
      resultado = {
        ok: true,
        origen: 'local',
        aviso: AVISO_NO_DIAGNOSTICO,
        resumen: fatiga ? fatiga.mensaje : "I can't compare the photos right now.",
        observaciones: [],
        accion: 'If anything worries you, measure your temperature or notify the medical officer.',
        zonas: fatiga && fatiga.nivel !== 'normal' ? ['brain'] : [],
        sugerirAvisoAlOficial: false,
        fatiga,
        comparacionDeIA: false,
      };
    }
    // El aviso se lee siempre.
    if (hablar) await voz?.hablar?.(`${resultado.resumen} ${resultado.accion} ${AVISO_NO_DIAGNOSTICO}`);
    return resultado;
  }

  return { observar };
}
