// Al terminar una serie del entrenador (#18): manda métricas + fotos clave + estado de salud, lee el
// comentario en voz alta y devuelve el plan ajustado. Si la IA o la red fallan, igual comenta con
// las métricas y aplica el techo del estado de salud: la demo no depende de la red.
import { comentarioLocal, limitarPlan, PLAN_NORMAL, sugerirEjerciciosPlan } from './plan.js';

const TIEMPO_MAXIMO_MS = 30_000;

/**
 * @param {object} [opciones]
 * @param {object} [opciones.voz]  el crearVoz() de Vega (para leer el comentario en voz alta)
 */
export function crearComentarioDeSerie({ voz, fetchFn = globalThis.fetch?.bind(globalThis), url = '/api/claude' } = {}) {
  /**
   * @param {object} serie
   * @param {string} serie.ejercicio                 'sentadilla' | 'flexion' | 'zancada' | 'plancha'…
   * @param {object} serie.metricas                  { repeticiones, anguloRodillaMin, correccionesEnVivo… }
   * @param {{media_type:string, data:string}[]} [serie.fotos]  2–3 fotos clave en base64
   * @param {{nivelMotor:string, resumen?:string}} serie.estado  estado de salud de hoy (del motor de reglas)
   * @param {{minutos:number, intensidad:string}} [serie.planActual]
   * @returns {Promise<{comentario:string, correccion:string, plan:object, origen:'claude'|'guardada'|'local'}>}
   */
  async function comentar(serie, { hablar = true } = {}) {
    const planActual = serie.planActual ?? PLAN_NORMAL;
    const ctxSugerencia = {
      diaSemana: serie.diaSemana || 'jueves',
      nivelMotor: serie.estado?.nivelMotor || 'green',
      alertas: serie.estado?.alertas || [],
    };
    let resultado = null;
    try {
      const respuesta = await fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo: 'exercise', ...serie, planActual }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      const cuerpo = await respuesta.json();
      if (respuesta.ok && cuerpo.comentario && cuerpo.plan) {
        const ejerciciosSugeridos = sugerirEjerciciosPlan(cuerpo.plan.ejerciciosSugeridos, {
          ...ctxSugerencia,
          intensidad: cuerpo.plan.intensidad,
        });
        resultado = {
          comentario: cuerpo.comentario,
          correccion: cuerpo.correccion ?? '',
          plan: { ...cuerpo.plan, ejerciciosSugeridos },
          origen: cuerpo.comentarioDeIA ? cuerpo.origen : 'local',
        };
      }
    } catch {
      /* sin red o servidor caído: se usa el comentario local */
    }

    if (!resultado) {
      const planBase = limitarPlan(null, serie.estado.nivelMotor, planActual);
      const ejerciciosSugeridos = sugerirEjerciciosPlan(null, {
        ...ctxSugerencia,
        intensidad: planBase.intensidad,
      });
      const plan = { ...planBase, ejerciciosSugeridos };
      resultado = { comentario: comentarioLocal(serie, plan), correccion: '', plan, origen: 'local' };
    }
    if (hablar) await voz?.hablar?.(resultado.comentario);
    return resultado;
  }

  return { comentar };
}
