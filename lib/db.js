// Almacenamiento local en IndexedDB con Dexie (issue #2). Funciona sin conexión.
//
// Solo se usa en el navegador (componentes con 'use client'). La base se abre
// la primera vez que se la pide, así que importar este archivo en el servidor no rompe nada.
// Los `ts` son strings ISO 8601, por eso se pueden comparar como texto.

import Dexie from 'dexie';
import { INDICADORES } from './tipos.js';

let _db = null;

/** La base, creada recién la primera vez que se usa. */
export function getDb() {
  if (!_db) {
    _db = new Dexie('astrovitals');
    _db.version(1).stores({
      astronauts: 'id',
      readings: 'id, astronautId, [astronautId+ts], [astronautId+indicator+ts]',
      symptoms: 'id, astronautId, [astronautId+ts]',
      alerts: 'id, astronautId, [astronautId+ts]',
      tasks: 'id, astronautId, [astronautId+missionTime]',
      aiResults: 'id, kind, ts',
    });
  }
  return _db;
}

const nuevoId = () => globalThis.crypto.randomUUID();

/** Rango "desde `desde` en adelante" (`desde` opcional). */
const desdeTs = (desde) => desde ?? '';

// ─── Tripulantes ───────────────────────────────────────────────────────────

/** @param {import('./tipos.js').Astronaut} astronaut */
export const saveAstronaut = (astronaut) => getDb().astronauts.put(astronaut);

/** @returns {Promise<import('./tipos.js').Astronaut|undefined>} */
export const getAstronaut = (id) => getDb().astronauts.get(id);

/** @returns {Promise<import('./tipos.js').Astronaut[]>} */
export const listAstronauts = () => getDb().astronauts.toArray();

// ─── Mediciones ────────────────────────────────────────────────────────────

/**
 * Guarda una medición. Completa `id`, `unit` (según el indicador), `ts` (ahora) y `source` ('manual').
 * @param {Partial<import('./tipos.js').Reading> & Pick<import('./tipos.js').Reading, 'astronautId'|'indicator'|'value'>} lectura
 * @returns {Promise<import('./tipos.js').Reading>} la medición guardada
 */
export async function addReading(lectura) {
  const unidad = INDICADORES[lectura.indicator]?.unidad;
  if (!unidad) throw new Error(`Indicador desconocido: "${lectura.indicator}"`);
  const completa = {
    id: nuevoId(),
    unit: unidad,
    ts: new Date().toISOString(),
    source: 'manual',
    ...lectura,
  };
  await getDb().readings.put(completa);
  return completa;
}

/** Carga varias mediciones de una vez (datos de demo). Ya deben venir completas. */
export const addReadings = (lecturas) => getDb().readings.bulkPut(lecturas);

/**
 * Mediciones de un tripulante desde `desde` (ISO, inclusive), de la más vieja a la más nueva.
 * Con `indicator` filtra por indicador.
 * @returns {Promise<import('./tipos.js').Reading[]>}
 */
export function getReadings(astronautId, desde, { indicator } = {}) {
  const readings = getDb().readings;
  if (indicator) {
    return readings
      .where('[astronautId+indicator+ts]')
      .between([astronautId, indicator, desdeTs(desde)], [astronautId, indicator, Dexie.maxKey], true, true)
      .toArray();
  }
  return readings
    .where('[astronautId+ts]')
    .between([astronautId, desdeTs(desde)], [astronautId, Dexie.maxKey], true, true)
    .toArray();
}

/** Última medición de un indicador, o `undefined`. */
export function getLastReading(astronautId, indicator) {
  return getDb()
    .readings.where('[astronautId+indicator+ts]')
    .between([astronautId, indicator, Dexie.minKey], [astronautId, indicator, Dexie.maxKey])
    .last();
}

// ─── Síntomas ──────────────────────────────────────────────────────────────

/**
 * @param {Partial<import('./tipos.js').Symptom> & Pick<import('./tipos.js').Symptom, 'astronautId'|'bodyZone'|'code'>} sintoma
 * @returns {Promise<import('./tipos.js').Symptom>}
 */
export async function addSymptom(sintoma) {
  const completo = { id: nuevoId(), severity: 1, ts: new Date().toISOString(), ...sintoma };
  await getDb().symptoms.put(completo);
  return completo;
}

export const addSymptoms = (sintomas) => getDb().symptoms.bulkPut(sintomas);

/** @returns {Promise<import('./tipos.js').Symptom[]>} */
export const getSymptoms = (astronautId, desde) =>
  getDb()
    .symptoms.where('[astronautId+ts]')
    .between([astronautId, desdeTs(desde)], [astronautId, Dexie.maxKey], true, true)
    .toArray();

// ─── Alertas ───────────────────────────────────────────────────────────────

/**
 * Reemplaza todas las alertas de un tripulante por las recién calculadas (el motor las recalcula completas).
 * @param {import('./tipos.js').Alert[]} alertas
 */
export async function replaceAlerts(astronautId, alertas) {
  const { alerts } = getDb();
  await getDb().transaction('rw', alerts, async () => {
    await alerts.where('astronautId').equals(astronautId).delete();
    await alerts.bulkPut(alertas.map((a) => ({ id: nuevoId(), ...a, astronautId })));
  });
}

/** @returns {Promise<import('./tipos.js').Alert[]>} */
export const getAlerts = (astronautId) => getDb().alerts.where('astronautId').equals(astronautId).toArray();

// ─── Jornada ───────────────────────────────────────────────────────────────

/**
 * @param {Partial<import('./tipos.js').Task> & Pick<import('./tipos.js').Task, 'astronautId'|'kind'|'title'|'missionTime'>} tarea
 * @returns {Promise<import('./tipos.js').Task>}
 */
export async function saveTask(tarea) {
  const completa = { id: nuevoId(), recurrence: 'daily', done: false, ...tarea };
  await getDb().tasks.put(completa);
  return completa;
}

export const saveTasks = (tareas) => getDb().tasks.bulkPut(tareas);

/** Tareas de un tripulante desde `desde` (hora de misión), en orden. */
export const getTasks = (astronautId, desde) =>
  getDb()
    .tasks.where('[astronautId+missionTime]')
    .between([astronautId, desdeTs(desde)], [astronautId, Dexie.maxKey], true, true)
    .toArray();

export const setTaskDone = (id, done = true) => getDb().tasks.update(id, { done });

// ─── Respuestas de la IA ───────────────────────────────────────────────────

/**
 * Guarda una respuesta de la IA (historial y respaldo para la demo sin IA).
 * @param {Pick<import('./tipos.js').AiResult, 'kind'|'input'|'output'> & Partial<import('./tipos.js').AiResult>} resultado
 * @returns {Promise<import('./tipos.js').AiResult>}
 */
export async function saveAiResult(resultado) {
  const completo = { id: nuevoId(), ts: new Date().toISOString(), ...resultado };
  await getDb().aiResults.put(completo);
  return completo;
}

/** Respuestas guardadas de un tipo, de la más nueva a la más vieja. */
export const listAiResults = (kind) => getDb().aiResults.where('kind').equals(kind).reverse().sortBy('ts');

/** La respuesta guardada más reciente de un tipo cuyo `input` cumpla `coincide` (o la última, si no se pasa). */
export async function findAiResult(kind, coincide = () => true) {
  return (await listAiResults(kind)).find((r) => coincide(r.input));
}

// ─── Utilidades ────────────────────────────────────────────────────────────

/** Borra todo (para recargar los datos de demo desde cero). */
export async function resetDb() {
  const db = getDb();
  await db.transaction('rw', db.tables, () => Promise.all(db.tables.map((t) => t.clear())));
}
