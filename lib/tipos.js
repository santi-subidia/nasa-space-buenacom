// Contrato de datos entre las tres personas (issue #2). Cambiarlo avisando.
//
// El proyecto es JavaScript, así que los "tipos" son typedefs de JSDoc (el editor
// los entiende) más constantes que sí existen en tiempo de ejecución.
// Referencia: doc/proyecto/plan/prototipo.md §2 y doc/proyecto/plan/plan-final.md §8.

// ─── Enumerados (constantes reutilizables) ─────────────────────────────────

/** Dónde está la tripulación. */
export const ENTORNOS = ['transit_0g', 'station', 'rover_eva', 'moon_base', 'mars_base'];

/** Rol dentro de la tripulación: `cmo` es el oficial médico (Crew Medical Officer). */
export const ROLES = ['crew', 'cmo'];

/** Semáforo, de menor a mayor gravedad. El orden importa: el estado de una zona es el máximo. */
export const NIVELES = ['green', 'yellow', 'orange', 'red'];

/** Zonas del cuerpo (las 12 de la matriz peligro-riesgo-indicador; el mapa clicable muestra 9). */
export const ZONAS = [
  'brain', 'eyes', 'inner_ear', 'heart', 'lungs', 'immune',
  'bones', 'muscles', 'kidneys', 'gut', 'dna', 'whole',
];

/** Origen de una medición. */
export const FUENTES_LECTURA = ['manual', 'voice', 'watch_sim', 'camera'];

/** A quién se escala una alerta. */
export const ESCALAMIENTOS = ['self', 'cmo', 'flight_surgeon'];

export const RECURRENCIAS = ['daily', 'weekly', 'event'];

export const TIPOS_RESULTADO_IA = ['board', 'answer', 'exercise', 'face'];

/** Etiqueta y unidad por indicador (rangos y umbrales viven en el motor de reglas, #3). */
export const INDICADORES = {
  bp_sys: { etiqueta: 'Systolic blood pressure', unidad: 'mmHg' },
  bp_dia: { etiqueta: 'Diastolic blood pressure', unidad: 'mmHg' },
  hr_rest: { etiqueta: 'Resting heart rate', unidad: 'bpm' },
  glucose: { etiqueta: 'Glucose', unidad: 'mg/dL' },
  temp: { etiqueta: 'Temperature', unidad: '°C' },
  sleep_h: { etiqueta: 'Sleep hours', unidad: 'h' },
  mood: { etiqueta: 'Mood', unidad: '1–5' },
  spo2: { etiqueta: 'SpO₂', unidad: '%' },
  water_ml: { etiqueta: 'Water', unidad: 'ml' },
  exercise_min: { etiqueta: 'Exercise', unidad: 'min' },
  stress: { etiqueta: 'Stress', unidad: '1–10' },
  visual_acuity: { etiqueta: 'Visual acuity', unidad: 'pts' },
  reaction_ms: { etiqueta: 'Reaction time', unidad: 'ms' },
  mass_kg: { etiqueta: 'Body mass', unidad: 'kg' },
  kcal: { etiqueta: 'Calorie intake', unidad: 'kcal' },
  radiation_msv: { etiqueta: 'Radiation dose', unidad: 'mSv' },
  resp_rate: { etiqueta: 'Respiratory rate', unidad: 'breaths/min' },
  muscle_mass_pct: { etiqueta: 'Muscle mass', unidad: '%' },
  bone_density_pct: { etiqueta: 'Bone density', unidad: '%' },
  microgravity_adapt: { etiqueta: 'Microgravity adaptation', unidad: '%' },
  isolation_score: { etiqueta: 'Social isolation', unidad: '1–10' },
};

export const INDICADOR_IDS = Object.keys(INDICADORES);

// ─── Typedefs ──────────────────────────────────────────────────────────────

/** @typedef {'transit_0g'|'station'|'rover_eva'|'moon_base'|'mars_base'} Env */
/** @typedef {'crew'|'cmo'} Role */
/** @typedef {'green'|'yellow'|'orange'|'red'} Level */
/** @typedef {'brain'|'eyes'|'inner_ear'|'heart'|'lungs'|'immune'|'bones'|'muscles'|'kidneys'|'gut'|'dna'|'whole'} BodyZone */
/** @typedef {'bp_sys'|'bp_dia'|'hr_rest'|'glucose'|'temp'|'sleep_h'|'mood'|'spo2'|'water_ml'|'exercise_min'|'stress'|'visual_acuity'|'reaction_ms'|'mass_kg'|'kcal'|'radiation_msv'|'resp_rate'|'muscle_mass_pct'|'bone_density_pct'|'microgravity_adapt'|'isolation_score'} IndicatorId */

/**
 * @typedef {Object} Astronaut
 * @property {string} id
 * @property {string} name
 * @property {Role} role
 * @property {Partial<Record<IndicatorId, number>>} baseline  Línea base personal previa al vuelo.
 * @property {string} [baselinePhotoId]  Foto base de la cara (para "¿Cómo me ves hoy?").
 */

/**
 * @typedef {Object} Reading
 * @property {string} id
 * @property {string} astronautId
 * @property {IndicatorId} indicator
 * @property {number} value
 * @property {string} unit
 * @property {string} ts  ISO 8601, hora de misión.
 * @property {'manual'|'voice'|'watch_sim'|'camera'} source
 * @property {string} [note]
 */

/**
 * @typedef {Object} Symptom
 * @property {string} id
 * @property {string} astronautId
 * @property {BodyZone} bodyZone
 * @property {string} code  Ej.: 'rash', 'cold_sore', 'dizzy_standing', 'neck_swelling'.
 * @property {1|2|3} severity
 * @property {string} ts  ISO 8601.
 * @property {string} [photoBlobId]
 */

/**
 * @typedef {Object} Alert
 * @property {string} id
 * @property {string} astronautId
 * @property {Level} level
 * @property {BodyZone} zone
 * @property {string} ruleId
 * @property {string} title
 * @property {string} why
 * @property {string[]} actions
 * @property {'self'|'cmo'|'flight_surgeon'} escalate
 * @property {string} nasaSource  Ruta al documento de riesgo (por qué importa el indicador), en doc/nasa/fuentes/ o doc/proyecto/sintesis/.
 * @property {ThresholdBasis|null} [basis]  De dónde sale el número del umbral.
 * @property {string} ts  ISO 8601.
 */

/**
 * Origen del número de un umbral de lib/motor/rules.json.
 * @typedef {Object} ThresholdBasis
 * @property {'nasa'|'nasa_derived'|'external'|'design'} type
 * @property {string} ref  Documento o criterio concreto.
 * @property {string} [url]
 * @property {string} [note]  Qué parte es de la fuente y qué parte es adaptación propia.
 */

/** Etiquetas para mostrar el origen de un umbral. */
export const ORIGEN_UMBRAL = {
  nasa: 'NASA value',
  nasa_derived: 'Derived from a NASA value',
  external: 'External clinical or occupational guideline (non-NASA)',
  design: 'Team design criterion (non-NASA)',
};

/**
 * Tarea de la jornada, base de las notificaciones.
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} astronautId
 * @property {string} kind  Ej.: 'measure', 'exercise', 'meal', 'report'.
 * @property {string} title
 * @property {string} missionTime  Hora de misión en que toca (ISO 8601).
 * @property {'daily'|'weekly'|'event'} recurrence
 * @property {boolean} done
 */

/**
 * Respuesta de la IA guardada: sirve de historial y de respaldo cuando la IA está apagada.
 * @typedef {Object} AiResult
 * @property {string} id
 * @property {'board'|'answer'|'exercise'|'face'} kind
 * @property {*} input   Lo que se le mandó a la IA (para encontrar la respuesta guardada).
 * @property {*} output  Lo que respondió.
 * @property {string} ts  ISO 8601.
 */

// ─── Utilidades ────────────────────────────────────────────────────────────

/** Gravedad numérica de un nivel (0 = verde … 3 = rojo). */
export const gravedad = (nivel) => NIVELES.indexOf(nivel);

/** El peor de varios niveles; `green` si no hay ninguno. Así se calcula cada zona y el estado global. */
export const nivelMaximo = (...niveles) =>
  niveles.flat().reduce((peor, n) => (gravedad(n) > gravedad(peor) ? n : peor), 'green');
