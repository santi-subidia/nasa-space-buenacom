// Plan de ejercicio según el estado de salud. Mismo principio que el semáforo: la IA puede BAJAR la
// carga (más descanso), nunca subirla por encima de lo que permite el nivel del motor de reglas.

export const INTENSIDADES = ['reposo', 'liviana', 'moderada', 'normal'];

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
  if (!techo) throw new Error(`Nivel desconocido "${nivelMotor}"`);

  const base = propuesto && INTENSIDADES.includes(propuesto.intensidad) ? propuesto : planActual;
  const intensidad = INTENSIDADES[Math.min(ORDEN[base.intensidad] ?? ORDEN.normal, ORDEN[techo.intensidad])];
  const minutos = intensidad === 'reposo' ? 0 : Math.max(0, Math.min(Math.round(Number(base.minutos) || 0), planActual.minutos ?? Infinity, techo.minutos));

  const limitadoPorMotor = intensidad !== base.intensidad || minutos !== Math.round(Number(base.minutos) || 0);
  const motivo = propuesto?.motivo || (limitadoPorMotor ? 'Ajustado al estado de salud de hoy.' : 'Sin cambios: el estado de salud lo permite.');
  return { minutos, intensidad, motivo, limitadoPorMotor };
}

/** Comentario sin IA, con las métricas de la serie: respaldo si Claude no está disponible. */
export function comentarioLocal({ ejercicio, metricas = {} }, plan) {
  const reps = Number(metricas.repeticiones);
  const seg = Number(metricas.tiempoPlanchaSeg);
  const logro = Number.isFinite(reps) && reps > 0
    ? `Terminaste ${reps} repeticiones de ${ejercicio}.`
    : Number.isFinite(seg) && seg > 0
      ? `Aguantaste ${seg} segundos de ${ejercicio}.`
      : `Terminaste la serie de ${ejercicio}.`;
  const cola =
    plan.intensidad === 'reposo' ? ' Hoy toca descansar.'
      : plan.limitadoPorMotor ? ` Por tu estado de hoy, seguí con ${plan.minutos} minutos ${plan.intensidad}.`
        : ' Muy bien, seguí con el plan.';
  return logro + cola;
}
