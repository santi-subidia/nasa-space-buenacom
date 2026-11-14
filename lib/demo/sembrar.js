// Siembra y mantenimiento de los 60 soles de demo sobre IndexedDB (lib/db.js).
// Sin dependencias de React ni `@/` para funcionar también en `node --test` con fake-indexeddb.

import demoData from './demo-data.json' with { type: 'json' };
import { FOTO_DEMO_SVG, SOL_ACTUAL, lecturasNocheWatch } from './generador.js';
import {
  addReading,
  getAstronaut,
  getDb,
  getReadings,
  getSymptoms,
  replaceAlerts,
  resetDb,
  saveAstronaut,
} from '../db.js';
import { evaluate } from '../motor/evaluar.js';

export const DEMO_DATA = demoData;

let inFlight = null;

async function yaSembrada() {
  const ana = await getAstronaut('ana');
  const marcos = await getAstronaut('marcos');
  if (!ana || !marcos) return false;
  const lecturas = await getReadings('ana');
  const solesDistintos = new Set(lecturas.map((r) => r.sol).filter((s) => Number.isInteger(s)));
  return solesDistintos.size >= demoData.mission.totalSoles;
}

/**
 * Siembra los 60 soles (Ana Ríos y Marcos Silva), el síntoma del sol 41 y las alertas evaluadas.
 * Por defecto es idempotente: si los 60 soles ya están en IndexedDB, no pisa lecturas del usuario.
 */
export async function sembrarDemo({ force = false, savePhoto = null } = {}) {
  if (inFlight && !force) return inFlight;

  const ejecutar = async () => {
    if (!force && (await yaSembrada())) {
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

    // Evaluar y guardar alertas iniciales para ambos tripulantes al sol actual (42).
    for (const astronaut of demoData.astronauts) {
      const r = await getReadings(astronaut.id);
      const s = await getSymptoms(astronaut.id);
      const ev = evaluate(r, astronaut.baseline, demoData.mission.env, { symptoms: s, sol: SOL_ACTUAL });
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
export async function sincronizarWatch(sol = SOL_ACTUAL, astronautId = 'ana') {
  const lote = lecturasNocheWatch(sol, astronautId);
  const guardadas = await Promise.all(lote.map((l) => addReading(l)));

  const astronaut = (await getAstronaut(astronautId)) || demoData.astronauts.find((a) => a.id === astronautId);
  const readings = await getReadings(astronautId);
  const symptoms = await getSymptoms(astronautId);
  const evaluacion = evaluate(readings, astronaut?.baseline || {}, demoData.mission.env, { symptoms, sol });
  await replaceAlerts(astronautId, evaluacion.alerts);

  return { readings: guardadas, evaluacion };
}
