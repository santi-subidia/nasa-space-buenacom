// DATOS DE MENTIRA (mock) hasta integrar #3 y #4.
// Rangos: doc/04-sintesis/catalogo-indicadores.md (valores generales, orientativos y configurables).

import { maxNivel } from '@/lib/niveles';

// Línea base personal (antes del vuelo).
export const LINEA_BASE = { bp_sys: 118, bp_dia: 76, hr_rest: 64, temp: 36.7, sleep_h: 7.8, mood: 4, spo2: 98 };

// Qué se midió hoy (sol 42). Lo que no está acá se muestra con el último valor conocido ("ayer").
export const VALORES_SOL_42 = { bp_sys: 118, bp_dia: 76, hr_rest: 74, temp: 37.6, sleep_h: 5.5, spo2: 97 };
const ULTIMO_CONOCIDO = { mood: 3 };

const entre = (v, a, b) => v >= a && v <= b;

// Cada función devuelve el nivel de un valor. Se reemplaza por el motor de reglas (#3).
export const EVALUAR = {
  bp_sys: (v) => (v >= 180 ? 'red' : v >= 140 ? 'orange' : v >= 130 || v < 90 ? 'yellow' : 'green'),
  bp_dia: (v) => (v >= 120 ? 'red' : v >= 90 ? 'orange' : v >= 85 || v < 60 ? 'yellow' : 'green'),
  hr_rest: (v) =>
    v > 120 || v < 40 ? 'red' : v > 100 ? 'orange' : v > 90 || v - LINEA_BASE.hr_rest >= 10 ? 'yellow' : 'green',
  temp: (v) => (v >= 38 || v < 35 ? 'red' : v >= 37.3 ? 'yellow' : 'green'),
  sleep_h: (v) => (v < 5 ? 'red' : v < 7 ? 'yellow' : 'green'),
  mood: (v) => (v <= 2 ? 'orange' : v <= 3 ? 'yellow' : 'green'),
  spo2: (v) => (v < 90 ? 'red' : v < 95 ? 'yellow' : 'green'),
  stress: (v) => (v >= 9 ? 'orange' : v >= 7 ? 'yellow' : 'green'),
  glucose: (v) => (v < 54 || v > 250 ? 'red' : v < 70 ? 'orange' : v >= 100 ? 'yellow' : 'green'),
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
  for (const [k, valor] of Object.entries(VALORES_SOL_42)) vals[k] = { valor, hoy: true };
  for (const l of lecturas) {
    if (l.sol === sol) vals[l.indicator] = { valor: l.value, hoy: true };
  }
  return vals;
}

/** Nivel de una tarjeta = el peor de sus indicadores. */
export function nivelDeTarjeta(tarjeta, vals) {
  return maxNivel(
    tarjeta.claves.map((k) => (vals[k] && EVALUAR[k] ? EVALUAR[k](vals[k].valor) : 'green')),
  );
}
