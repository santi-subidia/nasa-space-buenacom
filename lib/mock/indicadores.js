// DATOS DE MENTIRA (mock) hasta integrar #3 y #4.
// Rangos: doc/proyecto/sintesis/catalogo-indicadores.md (valores generales, orientativos y configurables).

import { maxNivel } from '@/lib/niveles';
import { evaluarIndicador } from '@/lib/motor/evaluar';

// Línea base personal (antes del vuelo).
export const LINEA_BASE = { bp_sys: 118, bp_dia: 76, hr_rest: 64, temp: 36.7, sleep_h: 7.8, mood: 4, spo2: 98, visual_acuity: 92 };

// Respaldo inicial antes de abrir IndexedDB (sol 42).
export const VALORES_SOL_42 = { bp_sys: 118, bp_dia: 76, hr_rest: 74, temp: 37.6, sleep_h: 5.5, spo2: 97, stress: 8 };
const ULTIMO_CONOCIDO = {
  bp_sys: 118,
  bp_dia: 76,
  hr_rest: 74,
  temp: 37.6,
  sleep_h: 5.3,
  spo2: 97,
  stress: 8,
  mood: 3,
  water_ml: 1850,
  glucose: 92,
};

// Cada función delega al motor de reglas (#3).
export const EVALUAR = {
  bp_sys: (v) => evaluarIndicador('bp_sys', v, LINEA_BASE).level,
  bp_dia: (v) => evaluarIndicador('bp_dia', v, LINEA_BASE).level,
  hr_rest: (v) => evaluarIndicador('hr_rest', v, LINEA_BASE).level,
  temp: (v) => evaluarIndicador('temp', v, LINEA_BASE).level,
  sleep_h: (v) => evaluarIndicador('sleep_h', v, LINEA_BASE).level,
  mood: (v) => evaluarIndicador('mood', v, LINEA_BASE).level,
  spo2: (v) => evaluarIndicador('spo2', v, LINEA_BASE).level,
  stress: (v) => evaluarIndicador('stress', v, LINEA_BASE).level,
  reaction_ms: (v) => evaluarIndicador('reaction_ms', v, LINEA_BASE).level,
  glucose: (v) => evaluarIndicador('glucose', v, LINEA_BASE).level,
  water_ml: (v) => evaluarIndicador('water_ml', v, LINEA_BASE).level,
  exercise_min: (v) => evaluarIndicador('exercise_min', v, LINEA_BASE).level,
  visual_acuity: (v) => evaluarIndicador('visual_acuity', v, LINEA_BASE).level,
};

// Las 6 tarjetas de indicadores de Inicio.
export const TARJETAS = [
  { id: 'presion', nombre: 'Presión arterial', unidad: 'mmHg', claves: ['bp_sys', 'bp_dia'], formato: ([s, d]) => `${s}/${d}`, zona: 'heart' },
  { id: 'hr_rest', nombre: 'Frecuencia cardíaca', unidad: 'lpm', claves: ['hr_rest'], formato: ([v]) => `${v}`, zona: 'heart' },
  { id: 'temp', nombre: 'Temperatura', unidad: '°C', claves: ['temp'], formato: ([v]) => v.toFixed(1).replace('.', ','), zona: 'immune' },
  { id: 'sleep_h', nombre: 'Sueño', unidad: 'h', claves: ['sleep_h'], formato: ([v]) => v.toFixed(1).replace('.', ','), zona: 'brain' },
  { id: 'mood', nombre: 'Ánimo', unidad: '/ 5', claves: ['mood'], formato: ([v]) => `${v}`, zona: 'brain' },
  { id: 'spo2', nombre: 'SpO₂', unidad: '%', claves: ['spo2'], formato: ([v]) => `${v}`, zona: 'lungs' },
];

// Chequeo matutino: qué se registra cada mañana.
export const CHEQUEO = [
  { id: 'presion', etiqueta: 'Presión arterial', claves: ['bp_sys', 'bp_dia'] },
  { id: 'temp', etiqueta: 'Temperatura', claves: ['temp'] },
  { id: 'sleep_h', etiqueta: 'Sueño', claves: ['sleep_h'] },
  { id: 'mood', etiqueta: 'Ánimo', claves: ['mood'] },
  { id: 'water_ml', etiqueta: 'Agua', claves: ['water_ml'] },
];

/**
 * Valores del día: lo medido en el sol (mock + lecturas guardadas) y, si falta,
 * el último conocido. Devuelve { clave: { valor, hoy } }.
 */
export function valoresDelDia(lecturas, sol) {
  const vals = {};
  for (const [k, valor] of Object.entries(ULTIMO_CONOCIDO)) vals[k] = { valor, hoy: false };

  if (!lecturas || lecturas.length === 0) {
    for (const [k, valor] of Object.entries(VALORES_SOL_42)) vals[k] = { valor, hoy: true };
    return vals;
  }

  const ordenadas = [...lecturas]
    .filter((l) => l && l.indicator && (l.sol == null || l.sol <= sol))
    .sort((a, b) => {
      const s = (a.sol ?? sol) - (b.sol ?? sol);
      return s !== 0 ? s : String(a.ts || '').localeCompare(String(b.ts || ''));
    });

  for (const l of ordenadas) {
    const esHoy = (l.sol ?? sol) === sol;
    vals[l.indicator] = { valor: l.value, hoy: esHoy, sol: l.sol ?? sol, source: l.source, note: l.note };
  }
  return vals;
}

// Nombre, unidad y formato de cada indicador (para listarlos fuera de las tarjetas).
export const META = {
  bp_sys: { nombre: 'Presión sistólica', unidad: 'mmHg' },
  bp_dia: { nombre: 'Presión diastólica', unidad: 'mmHg' },
  hr_rest: { nombre: 'Frecuencia cardíaca en reposo', unidad: 'lpm' },
  temp: { nombre: 'Temperatura', unidad: '°C' },
  sleep_h: { nombre: 'Sueño', unidad: 'h' },
  mood: { nombre: 'Ánimo', unidad: '/ 5' },
  spo2: { nombre: 'SpO₂', unidad: '%' },
  stress: { nombre: 'Estrés', unidad: '/ 10' },
  glucose: { nombre: 'Glucosa', unidad: 'mg/dL' },
  water_ml: { nombre: 'Agua', unidad: 'ml' },
  reaction_ms: { nombre: 'Tiempo de reacción', unidad: 'ms' },
  exercise_min: { nombre: 'Ejercicio', unidad: 'min' },
  visual_acuity: { nombre: 'Agudeza visual', unidad: 'puntos' },
};

// Lo que mide el reloj (Watch) cada mañana: se muestra cargado y no se edita.
export const WATCH = { hr_rest: 74, spo2: 97 };

/** Nivel de una tarjeta = el peor de sus indicadores. */
export function nivelDeTarjeta(tarjeta, vals) {
  return maxNivel(
    tarjeta.claves.map((k) => (vals[k] && EVALUAR[k] ? EVALUAR[k](vals[k].valor) : 'green')),
  );
}
