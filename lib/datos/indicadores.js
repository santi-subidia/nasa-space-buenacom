// Utilidades puras de indicadores, chequeo diario y resúmenes calculados desde la base de datos.
// Reemplaza a `lib/mock/*`: cero valores ficticios ni lecturas de muestra.

import { evaluarIndicador } from '../motor/evaluar.js';
import { INDICADORES, nivelMaximo } from '../tipos.js';

export const META_INDICADORES = Object.freeze({
  bp_sys: { nombre: 'Systolic blood pressure', unidad: 'mmHg' },
  bp_dia: { nombre: 'Diastolic blood pressure', unidad: 'mmHg' },
  hr_rest: { nombre: 'Resting heart rate', unidad: 'bpm' },
  glucose: { nombre: 'Fasting glucose', unidad: 'mg/dL' },
  temp: { nombre: 'Temperature', unidad: '°C' },
  sleep_h: { nombre: 'Sleep hours', unidad: 'h' },
  mood: { nombre: 'Mood', unidad: '/ 5' },
  spo2: { nombre: 'Blood oxygen (SpO₂)', unidad: '%' },
  water_ml: { nombre: 'Water today', unidad: 'ml' },
  exercise_min: { nombre: 'Exercise today', unidad: 'min' },
  stress: { nombre: 'Perceived stress', unidad: '/ 10' },
  visual_acuity: { nombre: 'Visual acuity', unidad: '/ 100' },
  reaction_ms: { nombre: 'Attention (PVT)', unidad: 'ms' },
  radiation_msv: { nombre: 'Cumulative dose', unidad: 'mSv' },
});

export const CHEQUEO_DIARIO = [
  { id: 'vitales', etiqueta: 'Vital signs', claves: ['bp_sys', 'bp_dia'] },
  { id: 'sueno', etiqueta: 'Sleep & mood', claves: ['sleep_h', 'mood', 'stress'] },
  { id: 'agua', etiqueta: 'Hydration', claves: ['water_ml'] },
  { id: 'ejercicio', etiqueta: 'Exercise', claves: ['exercise_min'] },
  { id: 'signos', etiqueta: 'Additional signs', claves: ['hr_rest', 'spo2', 'temp'] },
];

export const TARJETAS_RESUMEN = [
  { id: 'bp', titulo: 'Blood pressure', claves: ['bp_sys', 'bp_dia'], unidad: 'mmHg', nota: 'target < 120 / 80' },
  { id: 'hr_rest', titulo: 'Resting HR', claves: ['hr_rest'], unidad: 'bpm', nota: 'personalized baseline' },
  { id: 'sleep_h', titulo: 'Last night sleep', claves: ['sleep_h'], unidad: 'h', nota: 'optimal 7 to 9 h' },
  { id: 'temp', titulo: 'Temperature', claves: ['temp'], unidad: '°C', nota: 'subfebrile from 37.5' },
  { id: 'spo2', titulo: 'SpO₂', claves: ['spo2'], unidad: '%', nota: 'target ≥ 95%' },
  { id: 'stress', titulo: 'Stress', claves: ['stress'], unidad: '/ 10', nota: 'watch from 7' },
];

/** Evalúa un indicador usando el motor oficial `rules.json` y la línea base del tripulante en BD. */
export function evaluarConMotor(clave, valor, baseline = {}) {
  if (valor == null || Number.isNaN(Number(valor))) return null;
  if (clave === 'mood') {
    const n = Number(valor);
    if (n <= 1) return 'red';
    if (n <= 2) return 'orange';
    if (n === 3) return 'yellow';
    return 'green';
  }
  return evaluarIndicador(clave, Number(valor), baseline).level;
}

/** Devuelve el nivel máximo de una tarjeta resumen calculado desde lecturas reales de la BD. */
export function nivelDeTarjetaDb(tarjeta, valoresPorClave, baseline = {}) {
  const niveles = tarjeta.claves.map((k) => {
    const d = valoresPorClave?.[k];
    if (!d) return 'green';
    return evaluarConMotor(k, d.valor, baseline) ?? 'green';
  });
  return nivelMaximo(...niveles);
}

/**
 * Construye mapa `{ indicator: { valor, sol, hoy, unidad, note, ts, source } }`
 * exclusivamente desde lecturas persistidas en BD hasta `solActual`.
 */
export function valoresDelDia(lecturas = [], solActual = 42) {
  const porClave = {};
  const ordenadas = [...lecturas]
    .filter((l) => l && Number.isFinite(l.value) && (l.sol == null || l.sol <= solActual))
    .sort((a, b) => (a.sol ?? 0) - (b.sol ?? 0) || String(a.ts || '').localeCompare(String(b.ts || '')));

  for (const r of ordenadas) {
    const solRegistro = r.sol ?? solActual;
    porClave[r.indicator] = {
      valor: r.value,
      sol: solRegistro,
      hoy: solRegistro === solActual,
      unidad: r.unit ?? INDICADORES[r.indicator]?.unidad ?? '',
      note: r.note,
      ts: r.ts,
      source: r.source,
    };
  }
  return porClave;
}

/** Racha de días consecutivos con ejercicio (>= 20 min) hasta `solActual` usando lecturas reales de la BD. */
export function rachaEjercicioDesdeLecturas(lecturas = [], solActual = 42, minimoMin = 20) {
  if (!Array.isArray(lecturas) || !lecturas.length) return 0;
  const minPorSol = new Map();
  for (const l of lecturas) {
    if (l?.indicator !== 'exercise_min' || !Number.isFinite(l.value)) continue;
    const sol = Number.isInteger(l.sol) ? l.sol : solActual;
    if (sol > solActual) continue;
    minPorSol.set(sol, (minPorSol.get(sol) ?? 0) + l.value);
  }
  let racha = 0;
  for (let s = solActual; s >= 1; s--) {
    const min = minPorSol.get(s) ?? 0;
    if (min >= minimoMin) {
      racha += 1;
    } else if (s === solActual) {
      // Si todavía no entrenó hoy, seguimos contando desde ayer; si ayer tampoco entrenó, corta.
      continue;
    } else {
      break;
    }
  }
  return racha;
}

const prom = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const coma = (n, d = 1) => Number(n).toFixed(d);

/** Genera una lectura clínica dinámica de Vega a partir de la serie real de la BD. */
export function resumirTendenciaParaVega({ serie = [], sintomas = [], evaluacion = {}, solActual = 42, baseline = {} }) {
  const visibles = serie.filter((d) => d.sol <= solActual);
  if (visibles.length === 0) {
    return 'No measurements saved in the database yet to analyze trends. Log or simulate the next sol to start tracking.';
  }

  const recientes = visibles.slice(-7);
  const previos = visibles.slice(0, Math.max(0, visibles.length - recientes.length));
  const suenoRec = prom(recientes.map((d) => d.sleep_h).filter((v) => v != null));
  const suenoPrev = prom(previos.map((d) => d.sleep_h).filter((v) => v != null));
  const estresRec = prom(recientes.map((d) => d.stress).filter((v) => v != null));
  const tempMax = Math.max(...recientes.map((d) => d.temp).filter((v) => v != null), -Infinity);
  const ultimoSintoma = [...sintomas]
    .filter((s) => s && (s.sol == null || s.sol <= solActual))
    .sort((a, b) => (a.sol ?? 0) - (b.sol ?? 0) || String(a.ts || '').localeCompare(String(b.ts || '')))
    .at(-1);

  const partes = [];
  if (suenoRec != null) {
    const baseSueno = baseline.sleep_h ?? 7.5;
    const comp = suenoPrev != null ? ` (previously ${coma(suenoPrev)} h, baseline ${coma(baseSueno)} h)` : ` (your baseline is ${coma(baseSueno)} h)`;
    partes.push(`Over the last ${recientes.length} sols you averaged ${coma(suenoRec)} h of sleep${comp}`);
  }
  if (estresRec != null) {
    partes.push(`recent stress at ${coma(estresRec, 0)} / 10`);
  }
  if (Number.isFinite(tempMax) && tempMax >= 37.3) {
    partes.push(`temperature peak of ${coma(tempMax)} °C`);
  }
  const resumenNumerico = partes.length ? `${partes.join(', ')}.` : `There are ${visibles.length} sols logged up to Sol ${solActual}.`;

  const alerta = evaluacion?.alerts?.[0];
  const notaSintoma = ultimoSintoma
    ? ` Latest logged symptom: ${ultimoSintoma.code.replace(/_/g, ' ')} (Sol ${ultimoSintoma.sol ?? solActual}).`
    : '';

  if (alerta) {
    return `${resumenNumerico}${notaSintoma} ${alerta.title}: ${alerta.why} This is an observation, not a diagnosis.`;
  }
  return `${resumenNumerico}${notaSintoma} Parameters evaluated through Sol ${solActual} remain stable. This is an observation, not a diagnosis.`;
}
