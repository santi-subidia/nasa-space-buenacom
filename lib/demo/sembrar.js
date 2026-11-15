// Siembra y mantenimiento de los 60 soles de demo + telemetría de cabina + estado de misión sobre IndexedDB (lib/db.js).
// Sin dependencias de React ni `@/` para funcionar también en `node --test` con fake-indexeddb.

import demoData from './demo-data.json' with { type: 'json' };
import { FOTO_DEMO_SVG, MISION_BASE, SOL_ACTUAL, lecturasNocheWatch } from './generador.js';
import { panelCabina } from '../cabina/simulador.js';
import {
  addReading,
  getAstronaut,
  getCabinTelemetry,
  getDb,
  getMissionState,
  getReadings,
  getSymptoms,
  replaceAlerts,
  resetDb,
  saveAstronaut,
  saveCabinTelemetry,
  saveMissionState,
} from '../db.js';
import { evaluate } from '../motor/evaluar.js';

export const DEMO_DATA = demoData;

let inFlight = null;

function construirCabinaInicial(totalSoles = demoData.mission.totalSoles) {
  const filas = [];
  for (let s = 1; s <= totalSoles; s++) {
    const p = panelCabina({ sol: s, astronautId: 'ana' });
    const co2 = p.atmosfera.find((a) => a.id === 'co2')?.valor ?? 2.1;
    const o2 = p.atmosfera.find((a) => a.id === 'o2')?.valor ?? 20.9;
    const pres = p.atmosfera.find((a) => a.id === 'presion')?.valor ?? 101.2;
    const ruido = p.atmosfera.find((a) => a.id === 'ruido')?.valor ?? 53;
    const fecha = new Date(Date.parse('2026-09-01T12:00:00.000Z') + (s - 1) * 86_400_000).toISOString();
    filas.push({
      id: `cabina-sol-${s}`,
      sol: s,
      ts: fecha,
      co2Mmhg: co2,
      o2Pct: o2,
      pressureKpa: pres,
      noiseDba: ruido,
      noiseRestDb: 42,
      radiationRateMsvSol: p.dosis.tasaMSvDia,
      radiationTotalMsv: p.dosis.total,
      tormenta: false,
      enRefugio: false,
      source: 'cabin_sensors',
      note: `Telemetría inicial Base Marte · Sol ${s}`,
    });
  }
  return filas;
}

async function yaSembrada() {
  const ana = await getAstronaut('ana');
  const marcos = await getAstronaut('marcos');
  if (!ana || !marcos) return false;
  const lecturas = await getReadings('ana');
  const solesDistintos = new Set(lecturas.map((r) => r.sol).filter((s) => Number.isInteger(s)));
  return solesDistintos.size >= demoData.mission.totalSoles && lecturas.some((r) => r.indicator === 'resp_rate');
}

/** Asegura que `missionState` y `cabinTelemetry` existan en BD cuando la app está ya sembrada. */
export async function asegurarCabinaYMision({ syncRemote = false } = {}) {
  const estadoExistente = await getMissionState();
  if (!estadoExistente) {
    await saveMissionState(
      {
        id: 'ares-iv',
        missionName: MISION_BASE.nombre,
        entorno: MISION_BASE.entorno,
        solActual: SOL_ACTUAL,
        totalSoles: MISION_BASE.totalSoles,
        minutos: 390,
        diaSemana: 'jueves',
        pausado: true,
        acelerado: true,
      },
      { syncRemote },
    );
  }
  const cab = await getCabinTelemetry();
  if (!cab.length) {
    await saveCabinTelemetry(construirCabinaInicial(demoData.mission.totalSoles), { syncRemote });
  }
}

/**
 * Siembra los 60 soles (Ana Ríos y Marcos Silva), el síntoma del sol 41, cabina, estado de misión y alertas evaluadas.
 * Por defecto es idempotente: si los 60 soles ya están en IndexedDB, no pisa lecturas del usuario.
 */
export async function sembrarDemo({ force = false, savePhoto = null } = {}) {
  if (inFlight && !force) return inFlight;

  const ejecutar = async () => {
    if (!force && (await yaSembrada())) {
      await asegurarCabinaYMision({ syncRemote: false });
      return { seeded: false };
    }

    if (force) {
      await resetDb();
    }

    const db = getDb();
    for (const astronaut of demoData.astronauts) {
      const previo = force ? null : await getAstronaut(astronaut.id);
      await saveAstronaut({
        ...astronaut,
        ...(previo?.baselinePhotoId ? { baselinePhotoId: previo.baselinePhotoId } : {}),
      });
    }

    await db.readings.bulkPut(demoData.readings);
    await db.tasks.bulkPut(demoData.tasks);

    const symptomsToPut = [];
    for (const sym of demoData.symptoms) {
      let photoBlobId = sym.photoBlobId;
      if (sym.samplePhoto && !photoBlobId && typeof savePhoto === 'function' && typeof Blob !== 'undefined') {
        try {
          photoBlobId = await savePhoto(new Blob([FOTO_DEMO_SVG], { type: 'image/svg+xml' }));
        } catch {
          photoBlobId = undefined;
        }
      }
      const { samplePhoto: _flag, ...cleanSym } = sym;
      symptomsToPut.push({
        ...cleanSym,
        ...(photoBlobId ? { photoBlobId } : {}),
      });
    }
    await db.symptoms.bulkPut(symptomsToPut);

    await asegurarCabinaYMision({ syncRemote: false });

    const estadoMision = await getMissionState();
    const solObjetivo = estadoMision?.solActual ?? SOL_ACTUAL;

    // Evaluar y guardar alertas iniciales para ambos tripulantes al sol actual de la BD.
    for (const astronaut of demoData.astronauts) {
      const r = await getReadings(astronaut.id);
      const s = await getSymptoms(astronaut.id);
      const ev = evaluate(r, astronaut.baseline, demoData.mission.env, { symptoms: s, sol: solObjetivo });
      await replaceAlerts(astronaut.id, ev.alerts);
    }

    return { seeded: true, readings: demoData.readings.length };
  };

  inFlight = ejecutar().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Reinicia la demo desde cero (IndexedDB + foto de ejemplo si corresponde).
 */
export async function reiniciarDemo(opts = {}) {
  return sembrarDemo({ ...opts, force: true });
}

/**
 * Simula la sincronización nocturna del reloj ("Sincronizar Watch") agregando
 * sueño, FC en reposo + HRV (en `note`), SpO₂ y temperatura de muñeca como `watch_sim`.
 */
export async function sincronizarWatch(sol, astronautId = 'ana') {
  const estado = await getMissionState();
  const solActivo = Number.isInteger(sol) ? sol : estado?.solActual ?? SOL_ACTUAL;
  const lote = lecturasNocheWatch(solActivo, astronautId);
  const guardadas = await Promise.all(lote.map((l) => addReading(l)));

  const astronaut = (await getAstronaut(astronautId)) || demoData.astronauts.find((a) => a.id === astronautId);
  const readings = await getReadings(astronautId);
  const symptoms = await getSymptoms(astronautId);
  const evaluacion = evaluate(readings, astronaut?.baseline || {}, estado?.entorno || demoData.mission.env, {
    symptoms,
    sol: solActivo,
  });
  await replaceAlerts(astronautId, evaluacion.alerts);

  return { readings: guardadas, evaluacion };
}
