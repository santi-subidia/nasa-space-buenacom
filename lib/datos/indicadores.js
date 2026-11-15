// Utilidades puras de indicadores, chequeo diario y resúmenes calculados desde la base de datos.
// Reemplaza a `lib/mock/*`: cero valores ficticios ni lecturas de muestra.

import { evaluarIndicador } from '../motor/evaluar.js';
import { INDICADORES, nivelMaximo } from '../tipos.js';

export const META_INDICADORES = Object.freeze({
  bp_sys: { nombre: 'Presión sistólica', unidad: 'mmHg' },
  bp_dia: { nombre: 'Presión diastólica', unidad: 'mmHg' },
  hr_rest: { nombre: 'Frecuencia en reposo', unidad: 'lpm' },
  glucose: { nombre: 'Glucosa en ayunas', unidad: 'mg/dL' },
  temp: { nombre: 'Temperatura', unidad: '°C' },
  sleep_h: { nombre: 'Horas de sueño', unidad: 'h' },
  mood: { nombre: 'Ánimo', unidad: '/ 5' },
  spo2: { nombre: 'Oxígeno en sangre (SpO₂)', unidad: '%' },
  water_ml: { nombre: 'Agua del día', unidad: 'ml' },
  exercise_min: { nombre: 'Ejercicio de hoy', unidad: 'min' },
  stress: { nombre: 'Estrés percibido', unidad: '/ 10' },
  visual_acuity: { nombre: 'Agudeza visual', unidad: '/ 100' },
  reaction_ms: { nombre: 'Atención (PVT)', unidad: 'ms' },
  radiation_msv: { nombre: 'Dosis acumulada', unidad: 'mSv' },
});

export const CHEQUEO_DIARIO = [
  { id: 'vitales', etiqueta: 'Signos vitales', claves: ['bp_sys', 'bp_dia'] },
  { id: 'sueno', etiqueta: 'Sueño y ánimo', claves: ['sleep_h', 'mood', 'stress'] },
  { id: 'agua', etiqueta: 'Hidratación', claves: ['water_ml'] },
  { id: 'ejercicio', etiqueta: 'Ejercicio', claves: ['exercise_min'] },
  { id: 'watch', etiqueta: 'Reloj sincronizado', claves: ['hr_rest', 'spo2', 'temp'] },
];

export const TARJETAS_RESUMEN = [
  { id: 'bp', titulo: 'Presión arterial', claves: ['bp_sys', 'bp_dia'], unidad: 'mmHg', nota: 'objetivo < 120 / 80' },
  { id: 'hr_rest', titulo: 'FC reposo', claves: ['hr_rest'], unidad: 'lpm', nota: 'base personalizada' },
  { id: 'sleep_h', titulo: 'Sueño anoche', claves: ['sleep_h'], unidad: 'h', nota: 'óptimo 7 a 9 h' },
  { id: 'temp', titulo: 'Temperatura', claves: ['temp'], unidad: '°C', nota: 'subfebril desde 37,5' },
  { id: 'spo2', titulo: 'SpO₂', claves: ['spo2'], unidad: '%', nota: 'del Watch · ≥ 95 %' },
  { id: 'stress', titulo: 'Estrés', claves: ['stress'], unidad: '/ 10', nota: 'atención desde 7' },
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
const coma = (n, d = 1) => Number(n).toFixed(d).replace('.', ',');

/** Genera una lectura clínica dinámica de Vega a partir de la serie real de la BD. */
export function resumirTendenciaParaVega({ serie = [], sintomas = [], evaluacion = {}, solActual = 42, baseline = {} }) {
  const visibles = serie.filter((d) => d.sol <= solActual);
  if (visibles.length === 0) {
    return 'Todavía no hay mediciones guardadas en la base de datos para analizar tendencias. Registrá o simulá el próximo sol para empezar el seguimiento.';
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
    const comp = suenoPrev != null ? ` (antes ${coma(suenoPrev)} h, tu base ${coma(baseSueno)} h)` : ` (tu base es ${coma(baseSueno)} h)`;
    partes.push(`En los últimos ${recientes.length} soles promediaste ${coma(suenoRec)} h de sueño${comp}`);
  }
  if (estresRec != null) {
    partes.push(`estrés reciente en ${coma(estresRec, 0)} / 10`);
  }
  if (Number.isFinite(tempMax) && tempMax >= 37.3) {
    partes.push(`pico térmico de ${coma(tempMax)} °C`);
  }
  const resumenNumerico = partes.length ? `${partes.join(', ')}.` : `Hay ${visibles.length} soles registrados hasta el Sol ${solActual}.`;

  const alerta = evaluacion?.alerts?.[0];
  const notaSintoma = ultimoSintoma
    ? ` Último síntoma registrado: ${ultimoSintoma.code.replace(/_/g, ' ')} (Sol ${ultimoSintoma.sol ?? solActual}).`
    : '';

  if (alerta) {
    return `${resumenNumerico}${notaSintoma} ${alerta.title}: ${alerta.why} Es una observación, no un diagnóstico.`;
  }
  return `${resumenNumerico}${notaSintoma} Los parámetros evaluados hasta el Sol ${solActual} se mantienen estables. Es una observación, no un diagnóstico.`;
}
