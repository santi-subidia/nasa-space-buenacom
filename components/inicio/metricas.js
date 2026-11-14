import { maxNivel, NIVELES } from '../../lib/niveles.js';
import { evaluarIndicador } from '../../lib/motor/evaluar.js';

// Composición del frame General; valores y estados leídos de la base y del motor existente.
export const METRICAS_FIGMA = [
  { id: 'hr_rest', claves: ['hr_rest'], nombre: 'Frecuencia cardíaca', unidad: 'lpm', icono: 'corazon', onda: 'rosa' },
  { id: 'hrv', claves: ['hrv'], nombre: 'HRV', unidad: 'ms', icono: 'corazon', onda: 'rosa' },
  { id: 'spo2', claves: ['spo2'], nombre: 'Oxígeno en sangre', unidad: '%', icono: 'pulmones' },
  { id: 'sleep_h', claves: ['sleep_h'], nombre: 'Promedio de Sueño', unidad: 'min', icono: 'luna' },
  { id: 'presion', claves: ['bp_sys', 'bp_dia'], nombre: 'Presión arterial', unidad: 'mmHg', icono: 'presion' },
  { id: 'temp', claves: ['temp'], nombre: 'Temperatura Corporal', unidad: '°C', icono: 'cerebro' },
];

const COLORES = { green: 'menta', yellow: 'amarillo', orange: 'naranja', red: 'rosa' };
const numero = (valor) => valor.toLocaleString('es-AR', { maximumFractionDigits: 1 });

/** Lecturas de presentación: conserva la unidad y extrae HRV de las notas ya guardadas por el Watch. */
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
    if (sinDatos) return { ...tarjeta, valor: '—', estado: 'Sin datos', color: 'neutro', detalle: 'No hay una medición guardada para este indicador.' };

    const nivel = tarjeta.id === 'hrv' ? null : maxNivel(tarjeta.claves.map((clave, i) =>
      evaluacion.indicatorLevels?.[clave] ?? evaluarIndicador(clave, registros[i].value, baseline).level));
    let valor = registros.map((l) => numero(l.value)).join(' / ');
    let detalle = `Última lectura: sol ${Math.min(...registros.map((l) => l.sol))}.`;
    let estado = nivel === 'green' ? 'Rango normal' : NIVELES[nivel]?.etiqueta || 'Registrada';

    if (tarjeta.id === 'sleep_h') {
      const noches = new Map(disponibles.filter((l) => l.indicator === 'sleep_h' && l.sol >= sol - 6).map((l) => [l.sol, l.value]));
      if (!noches.size) return { ...tarjeta, valor: '—', estado: 'Sin datos recientes', color: 'neutro', detalle: 'No hay registros de sueño en los últimos 7 soles.' };
      const promedio = [...noches.values()].reduce((suma, horas) => suma + horas, 0) / noches.size;
      const minutos = Math.round(promedio * 60);
      valor = `${Math.floor(minutos / 60)} h ${minutos % 60}`;
      detalle = `Promedio de ${noches.size} noches registradas en los últimos 7 soles.`;
      if (nivel === 'green') estado = 'Calidad buena';
    }
    return { ...tarjeta, valor, estado, color: COLORES[nivel] || 'neutro', detalle };
  });
}
