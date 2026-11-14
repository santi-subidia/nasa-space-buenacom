// Elige qué fichas mandarle a Claude según la pregunta (solo las del riesgo que toca: unos pocos miles
// de tokens, nunca el corpus entero). Es determinista y sin IA: palabras al comienzo de una palabra.
import { normalizar } from './texto.js';

const REGLAS = [
  ['inmunidad', ['herpes', 'virus', 'viral', 'infecc', 'fiebre', 'febril', 'temperatura', 'alergi', 'erupcion', 'sarpullido', 'piel', 'resfri', 'gripe', 'inmun', 'defensa', 'zoster', 'culebrilla']],
  ['microorganismos', ['bacteria', 'microb', 'hongo', 'moho', 'contagi', 'higiene']],
  ['sueno-horarios', ['sueno', 'dormi', 'dorm', 'insomni', 'descans', 'cansanc', 'fatiga', 'circadi', 'horario', 'despert', 'siesta']],
  ['conducta-psiquiatria', ['animo', 'estres', 'ansied', 'tristez', 'deprim', 'soledad', 'aislam', 'psicolog', 'irrit', 'motivacion', 'agobi']],
  ['trabajo-en-equipo', ['equipo', 'conflicto', 'companer', 'tripulacion', 'discusion']],
  ['cardiovascular', ['corazon', 'presion arterial', 'pulso', 'cardiac', 'cardio', 'latid', 'arritm', 'trombo', 'yugular', 'taquicardia']],
  ['hipoxia', ['oxigeno', 'spo2', 'respirar', 'respirac', 'falta de aire', 'hipoxia', 'saturacion', 'co2']],
  ['hueso', ['hueso', 'oseo', 'fractura', 'densidad', 'calcio', 'columna', 'rinon', 'renal', 'calculo']],
  ['capacidad-fisica', ['ejercicio', 'entren', 'musculo', 'muscular', 'fuerza', 'aerobic', 'atrofia', 'flexion', 'sentadilla', 'plancha', 'condicion fisica']],
  ['nutricion', ['comida', 'comer', 'aliment', 'nutri', 'peso', 'agua', 'hidrat', 'deshidrat', 'sed', 'hambre', 'kcal', 'dieta', 'vitamina']],
  ['sans-ojos', ['ojo', 'vision', 'vista', 'borros', 'ocular', 'sans']],
  ['sensoriomotor-vestibular', ['equilibrio', 'mareo', 'vertigo', 'vestibul', 'orientacion', 'nausea']],
  ['cancer-por-radiacion', ['radiacion', 'cancer', 'dosis', 'tumor', 'tormenta solar']],
  ['descompresion', ['descompres', 'burbuja', 'bends']],
  ['eva', ['eva', 'caminata', 'traje', 'escafandra', 'actividad extravehicular', 'salir de la nave']],
  ['cargas-dinamicas', ['aterriz', 'amerizaj', 'impacto', 'despegue', 'cargas dinamicas']],
  ['soporte-sistemas', ['soporte', 'sistema de a bordo', 'falla del sistema', 'manual', 'protocolo']],
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
