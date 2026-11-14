// Lógica pura del enlace con Tierra con retraso simulado (issue #17).
// Sin imports `@/` para poder probarse directamente con `node --test`.

export const RETRASO_SOLO_IDA_MIN = 14;
export const DURACION_EVALUACION_MIN = 2;
export const DURACION_TOTAL_MIN = RETRASO_SOLO_IDA_MIN * 2 + DURACION_EVALUACION_MIN;

export const HITOS_ENLACE = [
  {
    id: 'enviado',
    etiqueta: 'Enviado desde Base Marte',
    descripcion: 'El paquete clínico sale de Ares IV hacia la red de espacio profundo.',
  },
  {
    id: 'llega_houston',
    etiqueta: 'Llega a Houston',
    descripcion: 'Recepción del informe técnico en Control de Misión (Johnson Space Center).',
  },
  {
    id: 'evaluacion_medica',
    etiqueta: 'Evaluación de médica de vuelo',
    descripcion: 'Revisión clínica de la médica de vuelo y redacción de indicaciones.',
  },
  {
    id: 'llega_marte',
    etiqueta: 'Llega a Base Marte',
    descripcion: 'La respuesta queda disponible en la bandeja de Ares IV.',
  },
];

const ESTADOS_HITO_POR_ETAPA = {
  en_cola: ['pendiente', 'pendiente', 'pendiente', 'pendiente'],
  viajando_ida: ['completado', 'activo', 'pendiente', 'pendiente'],
  en_houston: ['completado', 'completado', 'activo', 'pendiente'],
  viajando_vuelta: ['completado', 'completado', 'completado', 'activo'],
  recibido: ['completado', 'completado', 'completado', 'completado'],
};

/**
 * Calcula la etapa y el progreso de la transmisión ida y vuelta entre Base Marte y Houston.
 * Tramos: 14 min ida + 2 min evaluación médica + 14 min vuelta = 30 min.
 */
export function calcularEstadoEnvio(minutosTranscurridos, retrasoMin = RETRASO_SOLO_IDA_MIN) {
  const retraso = Number.isFinite(retrasoMin) && retrasoMin > 0 ? retrasoMin : RETRASO_SOLO_IDA_MIN;
  const finEvaluacion = retraso + DURACION_EVALUACION_MIN;
  const totalMin = retraso * 2 + DURACION_EVALUACION_MIN;
  const minutosHito = [0, retraso, finEvaluacion, totalMin];

  const invalido = minutosTranscurridos == null || Number.isNaN(Number(minutosTranscurridos)) || Number(minutosTranscurridos) < 0;
  const t = invalido ? null : Number(minutosTranscurridos);

  let etapa = 'en_cola';
  let etiqueta = 'En cola en Base Marte';
  let progresoPct = 0;
  let minutosRestantes = totalMin;
  let respuestaDisponible = false;

  if (t !== null) {
    if (t >= totalMin) {
      etapa = 'recibido';
      etiqueta = 'Respuesta recibida en Base Marte';
      progresoPct = 100;
      minutosRestantes = 0;
      respuestaDisponible = true;
    } else if (t >= finEvaluacion) {
      etapa = 'viajando_vuelta';
      etiqueta = 'Respuesta viajando a Base Marte';
      progresoPct = Math.round((t / totalMin) * 100);
      minutosRestantes = Math.max(0, Math.round((totalMin - t) * 10) / 10);
    } else if (t >= retraso) {
      etapa = 'en_houston';
      etiqueta = 'En evaluación de médica de vuelo (Houston)';
      progresoPct = Math.round((t / totalMin) * 100);
      minutosRestantes = Math.max(0, Math.round((totalMin - t) * 10) / 10);
    } else {
      etapa = 'viajando_ida';
      etiqueta = 'Transmitiendo hacia Houston';
      progresoPct = Math.round((t / totalMin) * 100);
      minutosRestantes = Math.max(0, Math.round((totalMin - t) * 10) / 10);
    }
  }

  const estadosHitos = ESTADOS_HITO_POR_ETAPA[etapa];
  const hitos = HITOS_ENLACE.map((hito, i) => {
    const estado = estadosHitos[i];
    return {
      ...hito,
      minutoObjetivo: minutosHito[i],
      estado,
      completado: estado === 'completado',
      activo: estado === 'activo',
    };
  });

  return {
    etapa,
    etiqueta,
    progresoPct,
    hitos,
    minutosRestantes,
    minutosTranscurridos: t ?? 0,
    duracionTotalMin: totalMin,
    retrasoSoloIdaMin: retraso,
    respuestaDisponible,
  };
}

/** Respuesta clínica fija de Houston para el caso del Sol 42. */
export const RESPUESTA_MEDICA_SOL42 = {
  remitente: 'Dra. Elena Vance · Médica de vuelo (Houston)',
  sol: 42,
  nivelRecomendado: 'orange',
  asunto: 'Respuesta médica Sol 42 · Posible reactivación viral leve (Ana Ríos)',
  resumenTecnico:
    'Revisado el informe de la Junta médica del Sol 42. Cuadro compatible con reactivación viral leve (herpes labial grado 2 en Sol 41, T 37,6 °C sin fiebre ≥ 38,0 °C, FC en reposo +8 lpm sobre tendencia de 7 soles, TA estable 121/78 mmHg) en contexto de deuda de sueño (5,2–5,3 h) y estrés sostenido (8/10). Mantener nivel de alerta naranja y seguimiento conjunto con el oficial médico de a bordo.',
  indicaciones: [
    'Control térmico y registro de síntomas cada 8 horas; escalar de inmediato si la temperatura alcanza ≥ 38,0 °C o aparecen síntomas sistémicos.',
    'Reducir carga física a ejercicio suave (≤ 30 min/día) durante las próximas 48 horas y priorizar ventana de descanso de 7 a 8 horas.',
    'Aislamiento estricto de utensilios personales, toallas y limpieza de superficies comunes para evitar transmisión a la tripulación.',
    'Reforzar hidratación (≥ 2.200 ml/día) y realizar hisopado / control fotográfico de la lesión en Sol 44 junto al oficial médico (CMO).',
  ],
};

/** Traducción de Vega en lenguaje simple y sereno para la tripulante. */
export const TRADUCCION_VEGA_SOL42 = {
  titulo: 'Qué te dijo la médica desde Tierra',
  resumenSimple:
    'La Dra. Elena Vance revisó tus datos desde Houston y coincide con lo que vimos acá: no es una emergencia y no tenés fiebre. Tu cuerpo está cansado por dormir poco y por el estrés de estos días, y por eso apareció el herpes en el labio. Con descanso, agua y cuidando tus utensilios deberías sentirte mejor en un par de soles.',
  textoVoz:
    'Ana, llegó la respuesta de la doctora Elena Vance desde Houston. No es una emergencia y no tenés fiebre. Lo que ves en el labio es una reactivación leve por el cansancio y el estrés de estos días. Te pide cuatro cosas simples: controlarte la temperatura cada ocho horas, hacer ejercicio suave de no más de treinta minutos por cuarenta y ocho horas, tomar más agua y usar solo tus propios utensilios. En el sol cuarenta y cuatro hacemos un control con foto e hisopado junto a Marcos.',
  pasos: [
    'Medite la temperatura cada 8 horas para confirmar que siga sin fiebre.',
    'Bajá el ritmo: ejercicio suave de máximo 30 minutos durante 48 horas y tratá de dormir entre 7 y 8 horas.',
    'No compartas vasos, cubiertos ni toallas, y tomá al menos 2,2 litros de agua por día.',
    'En el Sol 44 hacé el control fotográfico e hisopado de la lesión con Marcos.',
  ],
};

/** Informe técnico de respaldo si aún no se ejecutó la Junta médica en IndexedDB. */
export const INFORME_TECNICO_RESPALDO_SOL42 = {
  origen: 'respaldo',
  sol: 42,
  nivel: 'orange',
  astronauta: 'Ana Ríos',
  titulo: 'Informe para médicos de vuelo · Sol 42',
  resumen:
    'Tripulante Ana Ríos, Sol 42, Base Marte. Herpes labial reportado en Sol 41 (gravedad 2). Temperatura 37,6 °C en ascenso desde 36,8 °C, sin fiebre. Sueño promedio de 5,2 h en los últimos 3 soles, estrés 8/10 y ánimo 2/5 sostenido. FC en reposo 70 lpm (desde 62 lpm); TA estable 121/78 mmHg. Descenso de ingesta hídrica (1.900 ml) y ejercicio (40 min). Nivel del motor: orange.',
  hallazgos: [
    'Posible reactivación viral (herpes labial) con riesgo de transmisión por contacto o utensilios.',
    'Temperatura 37,6 °C sin fiebre (≥ 38,0 °C), en ascenso progresivo durante 7 soles.',
    'Deuda de sueño (5,2 h promedio en S40–S42), estrés 8/10 y ánimo 2/5.',
    'FC en reposo +8 lpm en 7 soles con presión arterial estable (121/78 mmHg).',
  ],
  plan: [
    'Evaluación por oficial médico (CMO) y consulta diferida con médicas de vuelo en Houston.',
    'Aislamiento de utensilios e higiene estricta de superficies compartidas.',
    'Plan de recuperación de sueño (7–8 h) y refuerzo de hidratación diaria.',
    'Monitoreo de temperatura cada 8 h y reevaluación clínica en Sol 44.',
  ],
  ts: null,
};

/** Normaliza un registro `AiResult` de tipo `'board'` al formato de informe técnico para Tierra. */
export function armarInformeParaTierra(aiResult) {
  if (!aiResult) return INFORME_TECNICO_RESPALDO_SOL42;
  const output = aiResult.output ?? {};
  const junta = output.json ?? output.junta ?? output;
  const tecnico = junta?.informe_tecnico;
  if (!tecnico?.resumen_clinico) return INFORME_TECNICO_RESPALDO_SOL42;

  const sol = Number.isInteger(aiResult.input?.sol) ? aiResult.input.sol : 42;
  return {
    origen: 'junta',
    sol,
    nivel: junta?.sintesis?.nivel ?? aiResult.input?.nivelMotor ?? 'orange',
    astronauta: aiResult.input?.astronauta === 'marcos' ? 'Marcos Silva' : 'Ana Ríos',
    titulo: `Informe para médicos de vuelo · Sol ${sol}`,
    resumen: tecnico.resumen_clinico,
    hallazgos: Array.isArray(tecnico.hallazgos) && tecnico.hallazgos.length > 0
      ? tecnico.hallazgos
      : INFORME_TECNICO_RESPALDO_SOL42.hallazgos,
    plan: Array.isArray(tecnico.plan) && tecnico.plan.length > 0
      ? tecnico.plan
      : INFORME_TECNICO_RESPALDO_SOL42.plan,
    ts: aiResult.ts ?? null,
  };
}

function tiempoMisionIso(sol, hora = 8, minuto = 0) {
  const baseMs = Date.UTC(2026, 8, 1, hora, minuto, 0);
  return new Date(baseMs + (sol - 1) * 86_400_000).toISOString();
}

/**
 * Construye 3 tareas compatibles con `Task` (`lib/tipos.js`) a partir de la respuesta de Houston.
 * @returns {Array<{id: string, astronautId: string, kind: string, title: string, missionTime: string, recurrence: 'event', done: boolean}>}
 */
export function construirRecordatoriosDeRespuesta(astronautId = 'ana', sol = 42) {
  const solBase = Number.isInteger(sol) && sol > 0 ? sol : 42;
  const solControl = solBase + 2;
  return [
    {
      id: `enlace-sol${solBase}-${astronautId}-temp-8h`,
      astronautId,
      kind: 'measure',
      title: 'Control de temperatura cada 8 h (indicado por Houston)',
      missionTime: tiempoMisionIso(solBase, 20, 0),
      recurrence: 'event',
      done: false,
    },
    {
      id: `enlace-sol${solBase}-${astronautId}-ejercicio-suave`,
      astronautId,
      kind: 'exercise',
      title: 'Ejercicio suave ≤ 30 min por 48 h',
      missionTime: tiempoMisionIso(solBase + 1, 17, 0),
      recurrence: 'event',
      done: false,
    },
    {
      id: `enlace-sol${solBase}-${astronautId}-control-sol${solControl}`,
      astronautId,
      kind: 'report',
      title: `Hisopado y control fotográfico de lesión (Sol ${solControl})`,
      missionTime: tiempoMisionIso(solControl, 9, 0),
      recurrence: 'event',
      done: false,
    },
  ];
}
