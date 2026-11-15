// Lógica pura del enlace con Tierra con retraso simulado (issue #17).
// Sin imports `@/` para poder probarse directamente con `node --test`.

export const RETRASO_SOLO_IDA_MIN = 14;
export const DURACION_EVALUACION_MIN = 2;
export const DURACION_TOTAL_MIN = RETRASO_SOLO_IDA_MIN * 2 + DURACION_EVALUACION_MIN;

export const HITOS_ENLACE = [
  {
    id: 'enviado',
    etiqueta: 'Sent from Mars Base',
    descripcion: 'The clinical packet leaves Ares IV toward the Deep Space Network.',
  },
  {
    id: 'llega_houston',
    etiqueta: 'Arrives in Houston',
    descripcion: 'Technical report received at Mission Control (Johnson Space Center).',
  },
  {
    id: 'evaluacion_medica',
    etiqueta: 'Flight Surgeon Review',
    descripcion: 'Clinical review by the flight surgeon and drafting of medical orders.',
  },
  {
    id: 'llega_marte',
    etiqueta: 'Arrives at Mars Base',
    descripcion: 'The reply becomes available in the Ares IV inbox.',
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
  let etiqueta = 'Queued at Mars Base';
  let progresoPct = 0;
  let minutosRestantes = totalMin;
  let respuestaDisponible = false;

  if (t !== null) {
    if (t >= totalMin) {
      etapa = 'recibido';
      etiqueta = 'Reply received at Mars Base';
      progresoPct = 100;
      minutosRestantes = 0;
      respuestaDisponible = true;
    } else if (t >= finEvaluacion) {
      etapa = 'viajando_vuelta';
      etiqueta = 'Reply in transit to Mars Base';
      progresoPct = Math.round((t / totalMin) * 100);
      minutosRestantes = Math.max(0, Math.round((totalMin - t) * 10) / 10);
    } else if (t >= retraso) {
      etapa = 'en_houston';
      etiqueta = 'Under Flight Surgeon review (Houston)';
      progresoPct = Math.round((t / totalMin) * 100);
      minutosRestantes = Math.max(0, Math.round((totalMin - t) * 10) / 10);
    } else {
      etapa = 'viajando_ida';
      etiqueta = 'Transmitting to Houston';
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
  remitente: 'Dr. Elena Vance · Flight Surgeon (Houston)',
  sol: 42,
  nivelRecomendado: 'orange',
  asunto: 'Medical Reply Sol 42 · Possible mild viral reactivation (Nicolás Méndez)',
  resumenTecnico:
    'Reviewed the Sol 42 Medical Board report. Findings compatible with mild viral reactivation (grade 2 cold sore on Sol 41, T 37.6 °C without fever ≥ 38.0 °C, resting HR +8 bpm above 7-sol baseline, stable BP 121/78 mmHg) in the context of sleep debt (5.2–5.3 h) and sustained stress (8/10). Maintain orange alert level and joint monitoring with the onboard Crew Medical Officer.',
  indicaciones: [
    'Temperature check and symptom log every 8 hours; escalate immediately if temperature reaches ≥ 38.0 °C or systemic symptoms appear.',
    'Reduce physical load to light exercise (≤ 30 min/day) for the next 48 hours and prioritize a 7 to 8 hour sleep window.',
    'Strict isolation of personal utensils and towels, plus regular disinfection of shared surfaces to prevent crew transmission.',
    'Increase hydration (≥ 2,200 ml/day) and perform lesion swab / photo follow-up on Sol 44 with the Crew Medical Officer (CMO).',
  ],
};

/** Traducción de Vega en lenguaje simple y sereno para el tripulante. */
export const TRADUCCION_VEGA_SOL42 = {
  titulo: 'What the Earth doctor told you',
  resumenSimple:
    'Dr. Elena Vance reviewed your data from Houston and agrees with what we saw here: it is not an emergency and you do not have a fever. Your body is tired from short sleep and recent stress, which is why the lip cold sore appeared. With rest, water, and keeping your utensils separate, you should feel better in a couple of sols.',
  textoVoz:
    'Nicolás, the reply from Dr. Elena Vance in Houston has arrived. It is not an emergency and you do not have a fever. What you see on your lip is a mild reactivation caused by fatigue and stress over the past few days. She asks for four simple steps: check your temperature every eight hours, keep exercise light for up to thirty minutes over forty-eight hours, drink more water, and use only your own utensils. On sol forty-four we will do a photo and swab check with Marcos.',
  pasos: [
    'Check your temperature every 8 hours to confirm you remain fever-free.',
    'Slow the pace: light exercise up to 30 minutes for 48 hours and aim for 7 to 8 hours of sleep.',
    'Do not share cups, cutlery, or towels, and drink at least 2.2 liters of water per day.',
    'On Sol 44, complete the lesion photo check and swab with Marcos.',
  ],
};

/** Informe técnico de respaldo si aún no se ejecutó la Junta médica en IndexedDB. */
export const INFORME_TECNICO_RESPALDO_SOL42 = {
  origen: 'respaldo',
  sol: 42,
  nivel: 'orange',
  astronauta: 'Nicolás Méndez',
  titulo: 'Flight Surgeon Report · Sol 42',
  resumen:
    'Crewmember Nicolás Méndez, Sol 42, Mars Base. Cold sore reported on Sol 41 (severity 2). Temperature 37.6 °C rising from 36.8 °C, without fever. Average sleep 5.2 h over the last 3 sols, stress 8/10, and sustained mood 2/5. Resting HR 70 bpm (up from 62 bpm); stable BP 121/78 mmHg. Drop in fluid intake (1,900 ml) and exercise (40 min). Engine level: orange.',
  hallazgos: [
    'Possible viral reactivation (cold sore) with contact or shared-utensil transmission risk.',
    'Temperature 37.6 °C without fever (≥ 38.0 °C), gradually rising over 7 sols.',
    'Sleep debt (5.2 h average across S40–S42), stress 8/10, and mood 2/5.',
    'Resting HR +8 bpm over 7 sols with stable blood pressure (121/78 mmHg).',
  ],
  plan: [
    'Evaluation by the Crew Medical Officer (CMO) and deferred consultation with flight surgeons in Houston.',
    'Utensil isolation and strict hygiene on shared surfaces.',
    'Sleep recovery plan (7–8 h) and daily hydration boost.',
    'Temperature monitoring every 8 h and clinical reassessment on Sol 44.',
  ],
  ts: null,
};

/** Normaliza respuestas médicas heredadas del seed en español al equivalente oficial en inglés. */
export function normalizarRespuestaMedica(respuesta) {
  if (!respuesta || typeof respuesta !== 'object') return respuesta;
  const remitente = String(respuesta.remitente ?? '');
  const asunto = String(respuesta.asunto ?? '');
  const resumen = String(respuesta.resumenTecnico ?? '');
  const esSeedEspanol =
    /Médica de vuelo/i.test(remitente) ||
    /Posible reactivación viral leve/i.test(asunto) ||
    /^(?:Revisado el informe de la Junta médica del Sol 42|Se revisó el informe de Junta médica del Sol 42)/i.test(resumen);
  if (esSeedEspanol) return RESPUESTA_MEDICA_SOL42;
  if (/Dra\.\s*Elena Vance/i.test(remitente)) {
    return {
      ...respuesta,
      remitente: remitente.replace(/Dra\.\s*Elena Vance/gi, 'Dr. Elena Vance'),
    };
  }
  return respuesta;
}

/** Normaliza traducciones de Vega heredadas del seed en español al equivalente oficial en inglés. */
export function normalizarTraduccionVega(traduccion) {
  if (!traduccion || typeof traduccion !== 'object') return traduccion;
  if (traduccion.titulo === 'Qué te dijo la médica desde Tierra') {
    return TRADUCCION_VEGA_SOL42;
  }
  return traduccion;
}

/** Normaliza informes técnicos heredados del seed en español al equivalente oficial en inglés. */
export function normalizarInformeTecnico(informe) {
  if (!informe || typeof informe !== 'object') return informe;
  const resumen = String(informe.resumen ?? '');
  if (/^Tripulante Ana Ríos, Sol 42, Base Marte/i.test(resumen)) {
    return INFORME_TECNICO_RESPALDO_SOL42;
  }
  return informe;
}

/** Normaliza un registro `AiResult` de tipo `'board'` al formato de informe técnico para Tierra. */
export function armarInformeParaTierra(aiResult) {
  if (!aiResult) return INFORME_TECNICO_RESPALDO_SOL42;
  const output = aiResult.output ?? {};
  const junta = output.json ?? output.junta ?? output;
  const tecnico = junta?.informe_tecnico;
  if (!tecnico?.resumen_clinico) return INFORME_TECNICO_RESPALDO_SOL42;
  if (/^Tripulante (?:Ana|Ana Ríos), Sol 42/i.test(String(tecnico.resumen_clinico))) {
    return INFORME_TECNICO_RESPALDO_SOL42;
  }

  const sol = Number.isInteger(aiResult.input?.sol) ? aiResult.input.sol : 42;
  return {
    origen: 'junta',
    sol,
    nivel: junta?.sintesis?.nivel ?? aiResult.input?.nivelMotor ?? 'orange',
    astronauta: aiResult.input?.astronauta === 'marcos' ? 'Marcos Silva' : 'Nicolás Méndez',
    titulo: `Flight Surgeon Report · Sol ${sol}`,
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
      title: 'Temperature check every 8 h (ordered by Houston)',
      missionTime: tiempoMisionIso(solBase, 20, 0),
      recurrence: 'event',
      done: false,
    },
    {
      id: `enlace-sol${solBase}-${astronautId}-ejercicio-suave`,
      astronautId,
      kind: 'exercise',
      title: 'Light exercise ≤ 30 min (Plank and Squats) for 48 h',
      missionTime: tiempoMisionIso(solBase + 1, 17, 0),
      recurrence: 'event',
      done: false,
    },
    {
      id: `enlace-sol${solBase}-${astronautId}-control-sol${solControl}`,
      astronautId,
      kind: 'report',
      title: `Lesion swab & photo check (Sol ${solControl})`,
      missionTime: tiempoMisionIso(solControl, 9, 0),
      recurrence: 'event',
      done: false,
    },
  ];
}
