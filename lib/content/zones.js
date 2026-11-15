// Contenido educativo del mapa corporal. Sale de doc/proyecto/sintesis/matriz-peligro-riesgo-indicador.md
// y de las fichas de doc/nasa/riesgos/**. Las 9 zonas se evalúan 100 % contra registros reales de la BD.

export const PELIGROS = {
  R: 'Radiation',
  I: 'Isolation',
  D: 'Distance from Earth',
  G: 'Gravity',
  E: 'Hostile & closed environment',
};

const DOC = 'https://github.com/santi-subidia/nasa-space-buenacom/blob/main/doc/nasa/riesgos/';

// `indicadores`:
//   - `{ clave }` toma la lectura persistida en BD para esa clave (`evaluate` + `baseline`).
//   - `{ cabina }` toma la telemetría ambiental de cabina persistida en BD para el `sol` activo.
//   - `{ sintoma, nombre, textoSin }` consulta síntomas reportados en BD.
//   - `{ derivado, nombre }` se calcula dinámicamente en `evaluarZonas` desde el historial de la BD.
export const ZONAS = [
  {
    id: 'brain',
    nombre: 'Brain & Mind',
    funcion: 'Cognition, mood, sleep, and orientation. Affected by isolation, poor sleep, and radiation.',
    riesgos: ['Behavioral and psychiatric conditions', 'Sleep and irregular schedules', 'Radiation effects on the central nervous system', 'Hypoxia'],
    peligros: ['I', 'R', 'E'],
    indicadores: [{ clave: 'sleep_h' }, { clave: 'mood' }, { clave: 'stress' }],
    queHacer: ['Keep regular sleep and light schedules', 'Share how you feel: Vega and the medical officer listen', 'Complete the 30s reaction test'],
    fuente: { titulo: 'NASA HRP · Sleep & Circadian Disruption', url: `${DOC}conducta/sueno-horarios.md` },
  },
  {
    id: 'eyes',
    nombre: 'Eyes',
    funcion: 'Vision. In microgravity, fluids shift toward the head and can reshape the eye (SANS syndrome).',
    riesgos: ['SANS (Spaceflight Associated Neuro-ocular Syndrome)', 'Radiation-induced cataracts'],
    peligros: ['G', 'R'],
    indicadores: [
      { clave: 'visual_acuity' },
      { sintoma: 'blurred_vision', nombre: 'Blurred vision', textoSin: 'None reported' },
    ],
    queHacer: ['Repeat the visual acuity mini-test weekly', 'Report if blurred vision lasts longer than one day'],
    enlace: { href: '/registrar#vision', etiqueta: 'Run visual test' },
    fuente: { titulo: 'NASA HRP · SANS', url: `${DOC}fisiologia/sans-ojos.md` },
  },
  {
    id: 'inner_ear',
    nombre: 'Inner Ear',
    funcion: 'Balance and orientation. When gravity changes, the brain must relearn which way is up.',
    riesgos: ['Altered sensorimotor and vestibular function', 'Noise-induced hearing loss'],
    peligros: ['G', 'E'],
    indicadores: [
      { sintoma: 'dizzy_standing', nombre: 'Dizziness on movement', textoSin: 'No dizziness' },
      { cabina: 'ruido', nombre: 'Cabin noise' },
    ],
    queHacer: ['Move slowly after gravity transitions', 'Wear hearing protection in noisy areas'],
    fuente: { titulo: 'NASA HRP · Sensorimotor & Vestibular', url: `${DOC}fisiologia/sensoriomotor-vestibular.md` },
  },
  {
    id: 'heart',
    nombre: 'Heart & Vessels',
    funcion: 'Blood circulation. In microgravity the heart becomes more spherical and returning to higher gravity can make maintaining blood pressure harder.',
    riesgos: ['Cardiovascular adaptations (orthostatic dizziness, arrhythmias)', 'Venous thromboembolism (neck and arms)'],
    peligros: ['G', 'R'],
    indicadores: [{ clave: 'bp_sys' }, { clave: 'bp_dia' }, { clave: 'hr_rest' }],
    queHacer: ['Drink fluids according to protocol', 'Stand up slowly', 'Report immediately if one side of the neck or an arm swells'],
    fuente: { titulo: 'NASA HRP · Cardiovascular', url: `${DOC}fisiologia/cardiovascular.md` },
  },
  {
    id: 'lungs',
    nombre: 'Lungs',
    funcion: 'Oxygen delivery to the blood. Cabin air quality (O₂, CO₂, dust) matters far more than on Earth.',
    riesgos: ['Hypoxia', 'Elevated CO₂', 'Planetary dust', 'Aerobic capacity'],
    peligros: ['E', 'G'],
    indicadores: [{ clave: 'spo2' }, { cabina: 'co2', nombre: 'Cabin CO₂' }],
    queHacer: ['Check cabin atmosphere if headache and low SpO₂ occur', 'Rest and report if SpO₂ < 94%'],
    fuente: { titulo: 'NASA HRP · Hypoxia', url: `${DOC}fisiologia/hipoxia.md` },
  },
  {
    id: 'immune',
    nombre: 'Immune System',
    funcion: 'Body defense (blood and skin). Stress and lack of sleep can reactivate latent viruses such as herpes.',
    riesgos: ['Altered immune responses', 'Host-microorganism interactions in the habitat'],
    peligros: ['E', 'R', 'I'],
    indicadores: [
      { clave: 'temp' },
      { clave: 'stress' },
      { sintoma: 'cold_sore', nombre: 'Lesion / rash (photo)', textoSin: 'No lesions reported' },
    ],
    queHacer: ['Wash hands and avoid sharing utensils', 'Prioritize 8 h of sleep', 'Notify the crew medical officer'],
    fuente: { titulo: 'NASA HRP · Altered Immune System', url: `${DOC}fisiologia/inmunidad.md` },
  },
  {
    id: 'kidneys',
    nombre: 'Kidneys',
    funcion: 'Blood filtration. In microgravity, bone calcium rises in urine and can form kidney stones.',
    riesgos: ['Renal stones', 'Urinary retention'],
    peligros: ['G'],
    indicadores: [
      { derivado: 'agua_ayer', nombre: 'Recent water' },
      { sintoma: 'flank_pain', nombre: 'Flank pain', textoSin: 'No' },
    ],
    queHacer: ['Drink at least 2 L of water per day', 'Report severe pain on one side'],
    fuente: { titulo: 'NASA HRP · Bone (includes renal stones)', url: `${DOC}fisiologia/hueso.md` },
  },
  {
    id: 'muscles',
    nombre: 'Muscles',
    funcion: 'Strength and movement. Without gravity loading, 10% to 12% of muscle mass can be lost.',
    riesgos: ['Reduced physical and musculoskeletal performance'],
    peligros: ['G'],
    indicadores: [
      { derivado: 'ejercicio_hoy', nombre: 'Sol exercise' },
      { derivado: 'racha_ejercicio', nombre: 'Streak' },
    ],
    queHacer: ['Complete your routine: target is 1.5 h per day', 'Use the Trainer to count reps and check posture'],
    fuente: { titulo: 'NASA HRP · Physical Performance', url: `${DOC}fisiologia/capacidad-fisica.md` },
  },
  {
    id: 'bones',
    nombre: 'Bones',
    funcion: 'Body support. Without gravity loading, 1% to 1.5% of bone density is lost per month.',
    riesgos: ['Bone loss', 'Fracture risk'],
    peligros: ['G'],
    indicadores: [
      { derivado: 'soles_mision', nombre: 'Sols in reduced gravity' },
      { derivado: 'ejercicio_carga_semanal', nombre: 'Weekly load average' },
    ],
    queHacer: ['Do resistance exercise every day', 'Maintain calcium and vitamin D per protocol'],
    fuente: { titulo: 'NASA HRP · Bone', url: `${DOC}fisiologia/hueso.md` },
  },
];
