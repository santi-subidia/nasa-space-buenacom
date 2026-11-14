// Arma los datos de la serie terminada para `crearComentarioDeSerie().comentar(...)` (#19).
// Módulo puro (sin React ni DOM) para poder probarlo en `node --test`.

import { EJERCICIOS } from './ejercicios.js';

function formatearResumenSalud(vals = {}, alertaTitulo = '') {
  const partes = [];
  if (vals.temp?.valor != null) partes.push(`Temp ${String(vals.temp.valor).replace('.', ',')} °C`);
  if (vals.sleep_h?.valor != null) partes.push(`sueño ${String(vals.sleep_h.valor).replace('.', ',')} h`);
  if (vals.hr_rest?.valor != null) partes.push(`FC ${vals.hr_rest.valor} lpm`);
  if (alertaTitulo) partes.push(`alerta: ${alertaTitulo}`);
  return (partes.join('; ') || 'Sin alertas activas').slice(0, 400);
}

/**
 * Convierte las series acumuladas de `Entrenador.js`, las fotos clave y el estado de salud
 * en el objeto que espera `ai/entrenador/serie.js`.
 */
export function armarPayloadSerie({
  series = [],
  ejercicioActual = 'sentadilla',
  minutos = 0.1,
  anguloMin = null,
  fotos = [],
  vals = {},
  nivelMotor = 'green',
  alertaTitulo = '',
}) {
  const principal = series.at(-1)?.ejercicio ?? ejercicioActual;
  const repeticiones = series.reduce((acc, s) => acc + (s.ejercicio === 'plancha' ? 0 : s.reps || 0), 0);
  const tiempoPlanchaSeg = series.reduce((acc, s) => acc + (s.ejercicio === 'plancha' ? s.segundos || 0 : 0), 0);
  const correcciones = series.flatMap((s) => s.correcciones ?? []);
  const correccionesEnVivo = correcciones.reduce((acc, c) => acc + (c.veces || 0), 0);

  const metricas = {
    repeticiones,
    tiempoPlanchaSeg,
    duracionMin: minutos,
    seriesCompletadas: series.length || 1,
    correccionesEnVivo,
  };
  if (anguloMin != null) metricas.anguloMinimo = anguloMin;
  if (correcciones.length) {
    metricas.detalleCorrecciones = correcciones.map((c) => `${c.texto} (${c.veces}x)`).slice(0, 8);
  }
  if (series.length > 1) {
    metricas.series = series.map((s) => {
      const nombre = EJERCICIOS[s.ejercicio]?.nombre ?? s.ejercicio;
      return `${nombre}: ${s.ejercicio === 'plancha' ? `${s.segundos} s` : `${s.reps} reps`}`;
    });
  }

  return {
    ejercicio: principal,
    metricas,
    fotos: fotos.slice(0, 3),
    estado: {
      nivelMotor,
      resumen: formatearResumenSalud(vals, alertaTitulo),
    },
  };
}
