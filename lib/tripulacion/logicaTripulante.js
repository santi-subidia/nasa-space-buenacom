// Lógica pura de tripulación, privacidad y vista del oficial médico (issue #10).
// Sin dependencias de React ni `@/` para poder ejecutarse directo con `node --test`.

import { INDICADORES, gravedad } from '../tipos.js';

export const CLAVE_TRIPULANTE_ACTIVO = 'astrovitals:tripulante-activo:v1';
export const CLAVE_PERMISOS_CMO = 'astrovitals:permisos-cmo:v1';

export const TRIPULANTE_DEFECTO = 'ana';
export const PERMISOS_DEFECTO = Object.freeze({
  ana: false,
  marcos: true,
});

const ORDEN_INDICADORES = Object.keys(INDICADORES);

const ETIQUETA_ESCALAMIENTO = {
  self: 'Autocuidado',
  cmo: 'Medical Officer (CMO)',
  flight_surgeon: 'Flight Surgeons (Earth)',
};

export function etiquetaEscalamiento(escalate) {
  return ETIQUETA_ESCALAMIENTO[escalate] || 'Medical Officer (CMO)';
}

function normalizarEntradaIndicador(id, entrada, evaluacion) {
  const meta = INDICADORES[id] || { etiqueta: id, unidad: '' };
  const indEval = evaluacion?.indicators?.[id];

  if (entrada && typeof entrada === 'object') {
    const value = entrada.value ?? entrada.valor;
    if (typeof value !== 'number' || Number.isNaN(value)) return null;
    return {
      id,
      indicator: id,
      label: entrada.label || entrada.nombre || indEval?.label || meta.etiqueta,
      value,
      unit: entrada.unit || entrada.unidad || indEval?.unit || meta.unidad,
      level: entrada.level || indEval?.level || evaluacion?.indicatorLevels?.[id] || 'green',
      hoy: entrada.hoy ?? null,
      sol: entrada.sol ?? indEval?.sol ?? null,
      source: entrada.source || indEval?.source || null,
      note: entrada.note || null,
    };
  }

  if (typeof entrada === 'number' && !Number.isNaN(entrada)) {
    return {
      id,
      indicator: id,
      label: indEval?.label || meta.etiqueta,
      value: entrada,
      unit: indEval?.unit || meta.unidad,
      level: indEval?.level || evaluacion?.indicatorLevels?.[id] || 'green',
      hoy: null,
      sol: indEval?.sol ?? null,
      source: indEval?.source || null,
      note: null,
    };
  }

  return null;
}

function extraerIndicadoresVisibles(valores, evaluacion) {
  const fuente =
    valores && typeof valores === 'object' && Object.keys(valores).length > 0
      ? valores
      : evaluacion?.indicators || {};

  const lista = Array.isArray(fuente)
    ? fuente
        .map((item) => normalizarEntradaIndicador(item?.id || item?.indicator, item, evaluacion))
        .filter(Boolean)
    : Object.entries(fuente)
        .map(([id, item]) => normalizarEntradaIndicador(id, item, evaluacion))
        .filter(Boolean);

  return lista.sort((a, b) => {
    const nivelDiff = gravedad(b.level) - gravedad(a.level);
    if (nivelDiff !== 0) return nivelDiff;
    const idxA = ORDEN_INDICADORES.indexOf(a.id);
    const idxB = ORDEN_INDICADORES.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Construye las tarjetas de la vista del oficial médico (CMO) aplicando la regla de privacidad:
 * el CMO siempre ve el semáforo (`level`) y la alerta activa (`alertaActiva`) de cada tripulante,
 * pero solo accede a sus mediciones numéricas (`indicadoresVisibles`) cuando `permisosPorId[t.id] === true`.
 *
 * @param {object} params
 * @param {Array<object>} params.tripulacion
 * @param {Record<string, object>} [params.evaluacionesPorId]
 * @param {Record<string, boolean>} [params.permisosPorId]
 * @param {Record<string, object>} [params.valoresPorId]
 */
export function armarVistaOficialMedico({
  tripulacion = [],
  evaluacionesPorId = {},
  permisosPorId = {},
  valoresPorId = {},
} = {}) {
  return tripulacion.map((t) => {
    const evaluacion = evaluacionesPorId?.[t.id] || null;
    const level = evaluacion?.globalLevel || 'green';
    const alertaActiva = evaluacion?.alerts?.[0] || null;
    const compartioDetalles = permisosPorId?.[t.id] === true;

    const indicadoresVisibles = compartioDetalles
      ? extraerIndicadoresVisibles(valoresPorId?.[t.id], evaluacion)
      : [];

    const notaPrivacidad = compartioDetalles
      ? null
      : `${t.name} did not share detailed measurements with the medical officer. Only the status indicator and active alert are shown.`;

    return {
      id: t.id,
      name: t.name,
      role: t.role,
      titulo: t.titulo || (t.role === 'cmo' ? 'Crew Medical Officer (CMO)' : 'Crewmember'),
      level,
      alertaActiva,
      compartioDetalles,
      indicadoresVisibles,
      notaPrivacidad,
    };
  });
}
