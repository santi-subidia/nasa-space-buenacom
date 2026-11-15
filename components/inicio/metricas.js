import { maxNivel, NIVELES } from '../../lib/niveles.js';
import { evaluarIndicador, REGLAS } from '../../lib/motor/evaluar.js';

// Composición del frame General; valores y estados leídos de la base y del motor existente.
export const METRICAS_FIGMA = [
  { id: 'hr_rest', claves: ['hr_rest'], nombre: 'Heart Rate', unidad: 'bpm', icono: 'corazon', onda: 'rosa' },
  { id: 'hrv', claves: ['hrv'], nombre: 'HRV', unidad: 'ms', icono: 'corazon', onda: 'rosa' },
  { id: 'spo2', claves: ['spo2'], nombre: 'Blood Oxygen', unidad: '%', icono: 'pulmones' },
  { id: 'sleep_h', claves: ['sleep_h'], nombre: 'Average Sleep', unidad: 'min', icono: 'luna' },
  { id: 'presion', claves: ['bp_sys', 'bp_dia'], nombre: 'Blood Pressure', unidad: 'mmHg', icono: 'presion' },
  { id: 'temp', claves: ['temp'], nombre: 'Body Temperature', unidad: '°C', icono: 'cerebro' },
];

const COLORES = { green: 'menta', yellow: 'amarillo', orange: 'naranja', red: 'rosa' };
const numero = (valor) => valor.toLocaleString('en-US', { maximumFractionDigits: 1 });

// Índice de seguimiento propio de VYTA. La gravedad del motor va de 0 a 3.
// El promedio se convierte a 0–100 y su máximo respeta la alerta más alta.
const MAXIMO_PUNTAJE_POR_NIVEL = { green: 100, yellow: 89, orange: 69, red: 39 };

export function calcularPuntajeSalud(evaluacion = {}) {
  const indicadores = Object.values(evaluacion.indicators || {}).filter((indicador) =>
    Number.isFinite(indicador.value) &&
    NIVELES[indicador.level] &&
    (REGLAS.thresholds[indicador.indicator] || REGLAS.baselineDelta[indicador.indicator]) &&
    (evaluacion.sol == null || indicador.sol == null || indicador.sol <= evaluacion.sol));

  if (!indicadores.length) {
    return { valor: null, indicadores: 0, detalle: 'No evaluable measurements available to calculate the health score.' };
  }

  const gravedadMedia = indicadores.reduce((suma, indicador) => suma + NIVELES[indicador.level].orden, 0) / indicadores.length;
  const promedio = Math.round(100 * (1 - gravedadMedia / 3));
  const nivel = maxNivel(
    evaluacion.globalLevel,
    indicadores.map((indicador) => indicador.level),
    Object.values(evaluacion.zoneLevels || {}),
    (evaluacion.alerts || []).map((alerta) => alerta.level),
  );
  const valor = Math.max(0, Math.min(promedio, MAXIMO_PUNTAJE_POR_NIVEL[nivel]));
  return {
    valor,
    indicadores: indicadores.length,
    detalle: `VYTA tracking index. Average of ${indicadores.length} indicators by severity (normal 100, caution 66.7, alert 33.3, critical 0). Capped at ${MAXIMO_PUNTAJE_POR_NIVEL[nivel]} by engine level ${NIVELES[nivel].etiqueta.toLowerCase()}.`,
  };
}

/** Lecturas de presentación: conserva la unidad y extrae HRV de las notas guardadas. */
export function lecturasParaInicio(lecturas = [], sol) {
  const disponibles = lecturas
    .filter((l) => l && Number.isFinite(l.value) && (l.sol == null || l.sol <= sol))
    .map((l) => ({ ...l, sol: l.sol ?? sol }));
  const hrvEnNotas = disponibles.flatMap((l) => {
    if (l.indicator !== 'hr_rest') return [];
    const coincidencia = /\bHRV\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*ms\b/i.exec(l.note || '');
    return coincidencia ? [{ ...l, indicator: 'hrv', value: Number(coincidencia[1].replace(',', '.')), unit: 'ms' }] : [];
  });
  // Una lectura dedicada de HRV prevalece sobre una nota del mismo instante.
  return [...hrvEnNotas, ...disponibles].sort((a, b) => a.sol - b.sol || String(a.ts || '').localeCompare(String(b.ts || '')));
}

/** Adapta datos guardados a la composición de Figma sin crear valores ni umbrales clínicos. */
export function metricasDesdeLecturas(lecturas, evaluacion = {}, baseline = {}, sol) {
  const disponibles = lecturasParaInicio(lecturas, sol);
  const ultimas = new Map(disponibles.map((l) => [l.indicator, l]));
  return METRICAS_FIGMA.map((tarjeta) => {
    const registros = tarjeta.claves.map((clave) => ultimas.get(clave));
    const sinDatos = registros.some((l) => !l);
    if (sinDatos) return { ...tarjeta, valor: '—', estado: 'No data', color: 'neutro', detalle: 'No saved measurement for this indicator.' };

    const nivel = tarjeta.id === 'hrv' ? null : maxNivel(tarjeta.claves.map((clave, i) =>
      evaluacion.indicatorLevels?.[clave] ?? evaluarIndicador(clave, registros[i].value, baseline).level));
    let valor = registros.map((l) => numero(l.value)).join(' / ');
    let detalle = `Latest reading: Sol ${Math.min(...registros.map((l) => l.sol))}.`;
    let estado = nivel === 'green' ? 'Normal range' : NIVELES[nivel]?.etiqueta || 'Logged';

    if (tarjeta.id === 'sleep_h') {
      const noches = new Map(disponibles.filter((l) => l.indicator === 'sleep_h' && l.sol >= sol - 6).map((l) => [l.sol, l.value]));
      if (!noches.size) return { ...tarjeta, valor: '—', estado: 'No recent data', color: 'neutro', detalle: 'No sleep logs in the last 7 sols.' };
      const promedio = [...noches.values()].reduce((suma, horas) => suma + horas, 0) / noches.size;
      const minutos = Math.round(promedio * 60);
      valor = `${Math.floor(minutos / 60)} h ${minutos % 60}`;
      detalle = `Average of ${noches.size} logged nights over the last 7 sols.`;
      if (nivel === 'green') estado = 'Good quality';
    }
    return { ...tarjeta, valor, estado, color: COLORES[nivel] || 'neutro', detalle };
  });
}
