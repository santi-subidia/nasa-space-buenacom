// Plan de ejercicio según el estado de salud. Mismo principio que el semáforo: la IA puede BAJAR la
// carga (más descanso), nunca subirla por encima de lo que permite el nivel del motor de reglas.

import { EJERCICIO_IDS, filtrarEjerciciosSugeridos } from '../../lib/entrenador/planificacion.js';

export const INTENSIDADES = ['reposo', 'liviana', 'moderada', 'normal'];
export { EJERCICIO_IDS };

/** Techo por nivel del motor: lo máximo que se puede entrenar ese día. */
const TECHO = {
  green: { intensidad: 'normal', minutos: Infinity },
  yellow: { intensidad: 'moderada', minutos: 60 },
  orange: { intensidad: 'liviana', minutos: 30 },
  red: { intensidad: 'reposo', minutos: 0 },
};

const ORDEN = Object.fromEntries(INTENSIDADES.map((n, i) => [n, i]));
export const PLAN_NORMAL = { minutos: 90, intensidad: 'normal' };

/**
 * @param {{minutos:number, intensidad:string, motivo?:string}|null} propuesto  lo que dijo la IA (o null)
 * @param {'green'|'yellow'|'orange'|'red'} nivelMotor
 * @param {{minutos:number, intensidad:string}} [planActual]
 * @returns {{minutos:number, intensidad:string, motivo:string, limitadoPorMotor:boolean}}
 */
export function limitarPlan(propuesto, nivelMotor, planActual = PLAN_NORMAL) {
  const techo = TECHO[nivelMotor];
  if (!techo) throw new Error(`Unknown level "${nivelMotor}"`);

  const base = propuesto && INTENSIDADES.includes(propuesto.intensidad) ? propuesto : planActual;
  const intensidad = INTENSIDADES[Math.min(ORDEN[base.intensidad] ?? ORDEN.normal, ORDEN[techo.intensidad])];
  const minutos = intensidad === 'reposo' ? 0 : Math.max(0, Math.min(Math.round(Number(base.minutos) || 0), planActual.minutos ?? Infinity, techo.minutos));

  const limitadoPorMotor = intensidad !== base.intensidad || minutos !== Math.round(Number(base.minutos) || 0);
  const motivo = propuesto?.motivo || (limitadoPorMotor ? 'Adjusted to today’s health status.' : 'No changes: health status allows it.');
  return { minutos, intensidad, motivo, limitadoPorMotor };
}

/**
 * Ensures suggested exercises belong exclusively to the 4 registered ones
 * (`sentadilla`, `flexion`, `zancada`, `plancha`) and respect the day and clinical alerts.
 */
export function sugerirEjerciciosPlan(propuestos, { diaSemana = 'jueves', nivelMotor = 'green', intensidad = 'normal', alertas = [] } = {}) {
  const nivelEfectivo = intensidad === 'reposo' ? 'red' : nivelMotor;
  const evaluacion = {
    globalLevel: nivelEfectivo,
    alerts: Array.isArray(alertas) ? alertas.map((id) => (typeof id === 'string' ? { id } : id)).filter(Boolean) : [],
  };
  return filtrarEjerciciosSugeridos(propuestos, { diaSemana, evaluacion });
}

/** Fallback commentary without AI using set metrics: used if Claude is unavailable. */
export function comentarioLocal({ ejercicio, metricas = {} }, plan) {
  const reps = Number(metricas.repeticiones);
  const seg = Number(metricas.tiempoPlanchaSeg);
  const nombreEjercicio = {
    sentadilla: 'squats',
    flexion: 'push-ups',
    zancada: 'lunges',
    plancha: 'plank',
  }[ejercicio] || ejercicio;
  const logro = Number.isFinite(reps) && reps > 0
    ? `You finished ${reps} reps of ${nombreEjercicio}.`
    : Number.isFinite(seg) && seg > 0
      ? `You held ${seg} seconds of ${nombreEjercicio}.`
      : `You finished the ${nombreEjercicio} set.`;
  const etiquetaIntensidad = {
    normal: 'normal',
    moderada: 'moderate',
    liviana: 'light',
    reposo: 'rest',
  }[plan.intensidad] || plan.intensidad;
  const cola =
    plan.intensidad === 'reposo' ? ' Rest today.'
      : plan.limitadoPorMotor ? ` Based on your status today, keep going with ${plan.minutos} ${etiquetaIntensidad} minutes.`
        : ' Great job, stick to the plan.';
  return logro + cola;
}
