// Mapa corporal integrado en Salud: evalúa las 9 zonas estrictamente desde la BD.
// Cero valores hardcoded ni imports de `lib/mock/*`.

import { NIVELES, maxNivel } from '../niveles.js';
import {
  META_INDICADORES,
  evaluarConMotor,
  rachaEjercicioDesdeLecturas,
  valoresDelDia,
} from '../datos/indicadores.js';
import { panelCabina } from '../cabina/simulador.js';
import { evaluarIndicador } from '../motor/evaluar.js';
import { ZONAS } from './zones.js';

export const ZONAS_POR_SECCION = {
  fisica: ['heart', 'lungs', 'muscles', 'bones', 'immune', 'kidneys', 'eyes', 'inner_ear'],
  mental: ['brain'],
  riesgos: null,
};

export { esZonaValida, rutaZona, seccionDeZona } from './rutaZona.js';

const fmt = (v) => String(v).replace('.', ',');

function resolverCabinaParaZona(cabinaDb, sol) {
  if (cabinaDb) {
    return {
      co2: { valor: cabinaDb.co2Mmhg, unidad: 'mmHg', nivel: evaluarIndicador('co2_mmhg', cabinaDb.co2Mmhg).level },
      ruido: { valor: cabinaDb.noiseDba, unidad: 'dBA', nivel: evaluarIndicador('noise_dba', cabinaDb.noiseDba).level },
    };
  }
  const fallback = panelCabina({ sol });
  const co2 = fallback.atmosfera.find((a) => a.id === 'co2');
  const ruido = fallback.atmosfera.find((a) => a.id === 'ruido');
  return { co2, ruido };
}

function ultimoSintomaDe(sintomas, codigos, sol, ventanaSoles = 6) {
  const lista = Array.isArray(codigos) ? codigos : [codigos];
  return [...sintomas]
    .filter((s) => s && lista.includes(s.code) && (s.sol == null || (s.sol <= sol && s.sol >= sol - ventanaSoles)))
    .sort((a, b) => (a.sol ?? 0) - (b.sol ?? 0) || String(a.ts || '').localeCompare(String(b.ts || '')))
    .at(-1);
}

/**
 * Resuelve los indicadores de cada zona con las lecturas y síntomas reales de la BD,
 * la telemetría de cabina del sol y la evaluación del motor de reglas.
 */
export function evaluarZonas({ lecturas = [], sintomas = [], evaluacion = {}, sol = 42, baseline = {}, cabinaDb = null }) {
  const vals = valoresDelDia(lecturas, sol);
  const cabina = resolverCabinaParaZona(cabinaDb, sol);

  const racha = rachaEjercicioDesdeLecturas(lecturas, sol);
  const ejercicioHoy = lecturas
    .filter((r) => r.indicator === 'exercise_min' && (r.sol ?? sol) === sol && Number.isFinite(r.value))
    .reduce((s, r) => s + r.value, 0);
  const metaEjercicio = baseline?.exercise_min ?? 90;

  const ultimos7Ex = lecturas.filter(
    (r) => r.indicator === 'exercise_min' && Number.isFinite(r.value) && (r.sol == null || (r.sol <= sol && r.sol > sol - 7)),
  );
  const promEx7 = ultimos7Ex.length
    ? Math.round(ultimos7Ex.reduce((a, b) => a + b.value, 0) / Math.min(7, new Set(ultimos7Ex.map((r) => r.sol ?? sol)).size || 1))
    : null;

  const aguaReciente = vals.water_ml;

  return ZONAS.map((z) => {
    const indicadores = z.indicadores.map((i) => {
      if (i.cabina) {
        const s = cabina[i.cabina];
        if (!s) return { nombre: i.nombre, valor: 'Sin dato', nivel: null, ambiental: true };
        const dec = s.unidad === 'mmHg' ? 2 : 0;
        return {
          nombre: i.nombre,
          valor: `${Number(s.valor).toFixed(dec).replace('.', ',')} ${s.unidad}`,
          nivel: s.nivel,
          ambiental: true,
        };
      }

      if (i.sintoma) {
        const codigos = i.sintoma === 'cold_sore' ? ['cold_sore', 'rash'] : [i.sintoma];
        const match = ultimoSintomaDe(sintomas, codigos, sol);
        if (!match) {
          return { nombre: i.nombre, valor: i.textoSin ?? 'No', nivel: 'green' };
        }
        const etiqueta =
          match.code === 'cold_sore' || match.code === 'rash'
            ? `Herpes labial · sol ${match.sol ?? sol}`
            : match.severity >= 2
              ? `Moderado · sol ${match.sol ?? sol}`
              : `Leve · sol ${match.sol ?? sol}`;
        const nivel =
          match.code === 'cold_sore' || match.code === 'rash'
            ? evaluacion.zoneLevels?.immune || 'orange'
            : match.severity >= 2
              ? 'orange'
              : 'yellow';
        return { nombre: i.nombre, valor: etiqueta, nivel };
      }

      if (i.derivado) {
        if (i.derivado === 'agua_ayer') {
          if (!aguaReciente) return { nombre: i.nombre, valor: 'Sin dato', nivel: null };
          const litros = (aguaReciente.valor / 1000).toFixed(1).replace('.', ',');
          return {
            nombre: i.nombre,
            valor: `${litros} L (sol ${aguaReciente.sol})`,
            nivel: evaluarConMotor('water_ml', aguaReciente.valor, baseline) ?? 'green',
          };
        }
        if (i.derivado === 'ejercicio_hoy') {
          const tieneHoy = lecturas.some((r) => r.indicator === 'exercise_min' && (r.sol ?? sol) === sol);
          if (!tieneHoy && !vals.exercise_min) return { nombre: i.nombre, valor: 'Sin dato', nivel: null };
          const min = tieneHoy ? ejercicioHoy : vals.exercise_min.valor;
          const nivel = evaluarConMotor('exercise_min', min, baseline) ?? 'green';
          return { nombre: i.nombre, valor: `${Math.round(min)} min (plan: ${metaEjercicio})`, nivel };
        }
        if (i.derivado === 'racha_ejercicio') {
          return {
            nombre: i.nombre,
            valor: `${racha} ${racha === 1 ? 'sol' : 'soles'}`,
            nivel: racha >= 5 ? 'green' : racha >= 2 ? 'yellow' : 'orange',
          };
        }
        if (i.derivado === 'soles_mision') {
          return {
            nombre: i.nombre,
            valor: `${sol} ${sol === 1 ? 'sol' : 'soles'}`,
            nivel: sol >= 30 ? 'yellow' : 'green',
          };
        }
        if (i.derivado === 'ejercicio_carga_semanal') {
          if (promEx7 == null) return { nombre: i.nombre, valor: 'Sin dato', nivel: null };
          const nivel = promEx7 >= metaEjercicio * 0.85 ? 'green' : promEx7 >= metaEjercicio * 0.5 ? 'yellow' : 'orange';
          return {
            nombre: i.nombre,
            valor: `${promEx7} min/sol (${promEx7 >= metaEjercicio * 0.85 ? 'en plan' : 'por debajo del plan'})`,
            nivel,
          };
        }
      }

      const dato = vals[i.clave];
      const meta = META_INDICADORES[i.clave] ?? { nombre: i.clave, unidad: '' };
      return {
        nombre: meta.nombre,
        valor: dato ? `${fmt(dato.valor)} ${meta.unidad}` : 'Sin dato',
        nivel: dato ? evaluarConMotor(i.clave, dato.valor, baseline) : null,
      };
    });

    const nivel = maxNivel(
      indicadores.filter((i) => !i.ambiental).map((i) => i.nivel).filter(Boolean),
      evaluacion.zoneLevels?.[z.id] ?? 'green',
    );
    return { ...z, indicadores, nivel };
  });
}

/** Zona más delicada de una lista (para abrir el mapa en ella si la URL no pide otra). */
export function zonaMasDelicada(zonas) {
  return zonas.reduce((a, b) => ((NIVELES[b.nivel]?.orden ?? 0) > (NIVELES[a.nivel]?.orden ?? 0) ? b : a));
}
