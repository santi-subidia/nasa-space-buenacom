// Elige qué fichas mandarle a Claude según la pregunta (solo las del riesgo que toca: unos pocos miles
// de tokens, nunca el corpus entero). Es determinista y sin IA: palabras al comienzo de una palabra.
import { normalizar } from './texto.js';

const REGLAS = [
  // Primero: ante un empate, la ficha de emergencias (protocolos de la NASA) va antes que la del órgano.
  ['emergencias-medicas', ['emergenc', 'urgenc', 'first aid', 'cpr', 'resuscitat', 'defibril', 'aed', 'faint', 'seizur', 'convuls', 'chok', 'anaphylax', 'med kit', 'medical kit', 'bleed', 'chest', 'unconscious', 'unresponsive', 'poison', 'toxic', 'smoke', 'ammonia', 'feel bad', 'feel unwell', 'surgeon', 'medical officer', 'cmo', 'evacu', 'checklist', 'triag', 'auxilio', 'rcp', 'reanim', 'desfibril', 'desmay', 'atragant', 'anafilax', 'botiquin', 'sangr', 'pecho', 'inconscien', 'intoxic', 'humo', 'amoniaco', 'me siento mal', 'malestar', 'cirujano', 'oficial medico', 'triaje']],
  ['inmunidad', ['herpes', 'cold sore', 'virus', 'viral', 'infect', 'infecc', 'fever', 'febrile', 'fiebre', 'febril', 'temp', 'temperatura', 'allerg', 'alergi', 'rash', 'erupcion', 'sarpullido', 'skin', 'piel', 'cold', 'flu', 'resfri', 'gripe', 'immun', 'inmun', 'defensa', 'zoster', 'shingles', 'culebrilla']],
  ['microorganismos', ['bacteria', 'microb', 'fung', 'mold', 'moho', 'hongo', 'contagi', 'hygien', 'higiene']],
  ['sueno-horarios', ['sleep', 'sueno', 'dormi', 'dorm', 'insomni', 'rest', 'descans', 'tired', 'cansanc', 'fatigu', 'circadi', 'schedule', 'horario', 'wake', 'despert', 'nap', 'siesta']],
  ['conducta-psiquiatria', ['mood', 'animo', 'stress', 'estres', 'anxiet', 'anxious', 'ansied', 'sad', 'tristez', 'depress', 'deprim', 'lonel', 'soledad', 'isolat', 'aislam', 'psycholog', 'psicolog', 'irrit', 'motivat', 'motivacion', 'overwhelm', 'agobi']],
  ['trabajo-en-equipo', ['team', 'equipo', 'conflict', 'conflicto', 'crewmate', 'companer', 'crew', 'tripulacion', 'argument', 'discusion']],
  ['cardiovascular', ['heart', 'corazon', 'blood pressure', 'presion arterial', 'pulse', 'pulso', 'cardiac', 'cardio', 'beat', 'latid', 'arrhythm', 'arritm', 'thromb', 'clot', 'trombo', 'jugular', 'yugular', 'tachycard', 'taquicardia']],
  ['hipoxia', ['oxygen', 'oxigeno', 'spo2', 'breath', 'respirar', 'respirac', 'shortness of breath', 'falta de aire', 'hypox', 'hipoxia', 'saturat', 'saturacion', 'co2']],
  ['hueso', ['bone', 'hueso', 'oseo', 'fractur', 'densit', 'densidad', 'calcium', 'calcio', 'spine', 'columna', 'kidney', 'rinon', 'renal', 'stone', 'calculo']],
  ['capacidad-fisica', ['exercis', 'ejercicio', 'workout', 'entren', 'muscl', 'musculo', 'muscular', 'strength', 'fuerza', 'aerobic', 'atroph', 'atrofia', 'pushup', 'push-up', 'flexion', 'squat', 'sentadilla', 'plank', 'plancha', 'lunge', 'fitness', 'condicion fisica']],
  ['nutricion', ['food', 'meal', 'comida', 'eat', 'comer', 'aliment', 'nutri', 'weight', 'peso', 'water', 'agua', 'hydrat', 'hidrat', 'dehydrat', 'deshidrat', 'thirst', 'sed', 'hunger', 'hambre', 'kcal', 'calor', 'diet', 'dieta', 'vitamin', 'vitamina']],
  ['sans-ojos', ['eye', 'ojo', 'vision', 'sight', 'vista', 'blurr', 'borros', 'ocular', 'sans']],
  ['sensoriomotor-vestibular', ['balanc', 'equilibrio', 'dizz', 'mareo', 'vertigo', 'vestibul', 'orient', 'orientacion', 'nause']],
  ['cancer-por-radiacion', ['radiat', 'radiacion', 'cancer', 'dose', 'dosis', 'tumor', 'solar storm', 'tormenta solar']],
  ['descompresion', ['decompress', 'descompres', 'bubble', 'burbuja', 'bends']],
  ['eva', ['eva', 'spacewalk', 'caminata', 'suit', 'traje', 'escafandra', 'extravehicular', 'actividad extravehicular', 'airlock', 'salir de la nave']],
  ['cargas-dinamicas', ['land', 'aterriz', 'splashdown', 'amerizaj', 'impact', 'impacto', 'launch', 'despegue', 'dynamic load', 'cargas dinamicas']],
  ['soporte-sistemas', ['support', 'soporte', 'onboard system', 'sistema de a bordo', 'system failure', 'falla del sistema', 'manual', 'protocol']],
];

// Preguntas que casi siempre piden varias fichas a la vez.
const EXTRAS = { eva: ['descompresion', 'capacidad-fisica'] };

const MAX_RIESGOS = 3;

/** @returns {string[]} hasta 3 ids de riesgo (vacío si la pregunta no toca ninguno). */
export function elegirRiesgos(pregunta) {
  const t = ` ${normalizar(pregunta)} `;
  const puntaje = new Map();
  for (const [id, raices] of REGLAS) {
    for (const raiz of raices) {
      if (new RegExp(`[^a-z0-9]${raiz}`).test(t)) puntaje.set(id, (puntaje.get(id) ?? 0) + 1);
    }
  }
  const orden = [...puntaje.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const elegidos = [];
  for (const id of orden) {
    for (const r of [id, ...(EXTRAS[id] ?? [])]) if (!elegidos.includes(r)) elegidos.push(r);
  }
  return elegidos.slice(0, MAX_RIESGOS);
}
