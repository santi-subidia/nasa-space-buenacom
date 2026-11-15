// Almacenamiento local en IndexedDB con Dexie (issue #2) + sincronización bidireccional con Supabase.
//
// Solo se usa en el navegador (componentes con 'use client'). La base se abre
// la primera vez que se la pide, así que importar este archivo en el servidor no rompe nada.
// Los `ts` son strings ISO 8601, por eso se pueden comparar como texto.

import Dexie from 'dexie';
import { INDICADORES } from './tipos.js';
import {
  sincronizarCabinaRemota,
  sincronizarEstadoMisionRemoto,
  sincronizarLecturaRemota,
  sincronizarLecturasRemotas,
  sincronizarNotificacionRemota,
  sincronizarResultadoIaRemoto,
  sincronizarSintomaRemoto,
  sincronizarSintomasRemotos,
  sincronizarTareasRemotas,
  sincronizarTripulanteRemoto,
} from './supabase/sincronizar.js';

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
    _db.version(2).stores({
      astronauts: 'id',
      readings: 'id, astronautId, [astronautId+ts], [astronautId+indicator+ts]',
      symptoms: 'id, astronautId, [astronautId+ts]',
      alerts: 'id, astronautId, [astronautId+ts]',
      tasks: 'id, astronautId, [astronautId+missionTime]',
      aiResults: 'id, kind, ts',
      missionState: 'id',
      cabinTelemetry: 'id, sol, ts',
      notifications: 'id, astronautId, sol, ts',
    });
  }
  return _db;
}

const nuevoId = () => globalThis.crypto.randomUUID();

/** Rango "desde `desde` en adelante" (`desde` opcional). */
const desdeTs = (desde) => desde ?? '';

// ─── Tripulantes ───────────────────────────────────────────────────────────

/** @param {import('./tipos.js').Astronaut} astronaut */
export async function saveAstronaut(astronaut) {
  await getDb().astronauts.put(astronaut);
  if (typeof window !== 'undefined') {
    sincronizarTripulanteRemoto(astronaut).catch(() => {});
  }
  return astronaut;
}

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
  if (typeof window !== 'undefined') {
    sincronizarLecturaRemota(completa).catch(() => {});
  }
  return completa;
}

/** Carga varias mediciones de una vez y las sincroniza con Supabase si estamos en el navegador. */
export async function addReadings(lecturas, { syncRemote = true } = {}) {
  if (!Array.isArray(lecturas) || lecturas.length === 0) return [];
  const res = await getDb().readings.bulkPut(lecturas);
  if (syncRemote && typeof window !== 'undefined') {
    sincronizarLecturasRemotas(lecturas).catch(() => {});
  }
  return res;
}

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
  if (typeof window !== 'undefined') {
    sincronizarSintomaRemoto(completo).catch(() => {});
  }
  return completo;
}

export async function addSymptoms(sintomas, { syncRemote = true } = {}) {
  if (!Array.isArray(sintomas) || sintomas.length === 0) return [];
  const res = await getDb().symptoms.bulkPut(sintomas);
  if (syncRemote && typeof window !== 'undefined') {
    sincronizarSintomasRemotos(sintomas).catch(() => {});
  }
  return res;
}

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
export async function saveTask(tarea, { syncRemote = true } = {}) {
  const completa = { id: nuevoId(), recurrence: 'daily', done: false, ...tarea };
  await getDb().tasks.put(completa);
  if (syncRemote && typeof window !== 'undefined') {
    sincronizarTareasRemotas([completa]).catch(() => {});
  }
  return completa;
}

export async function saveTasks(tareas, { syncRemote = true } = {}) {
  if (!Array.isArray(tareas) || tareas.length === 0) return [];
  const res = await getDb().tasks.bulkPut(tareas);
  if (syncRemote && typeof window !== 'undefined') {
    sincronizarTareasRemotas(tareas).catch(() => {});
  }
  return res;
}

/** Tareas de un tripulante desde `desde` (hora de misión), en orden. */
export const getTasks = (astronautId, desde) =>
  getDb()
    .tasks.where('[astronautId+missionTime]')
    .between([astronautId, desdeTs(desde)], [astronautId, Dexie.maxKey], true, true)
    .toArray();

export async function setTaskDone(id, done = true, { syncRemote = true } = {}) {
  await getDb().tasks.update(id, { done });
  if (syncRemote && typeof window !== 'undefined') {
    const actualizada = await getDb().tasks.get(id);
    if (actualizada) sincronizarTareasRemotas([actualizada]).catch(() => {});
  }
}

// ─── Estado de misión & Telemetría de cabina ───────────────────────────────

export async function saveMissionState(estado, { syncRemote = true } = {}) {
  const actual = await getDb().missionState.get(estado?.id ?? 'ares-iv');
  const completo = {
    id: 'ares-iv',
    missionName: 'Ares IV · Base Marte',
    entorno: 'mars_base',
    solActual: 42,
    totalSoles: 60,
    minutos: 390,
    diaSemana: 'jueves',
    pausado: true,
    acelerado: true,
    simulacionActiva: {},
    ...actual,
    ...estado,
    updatedAt: new Date().toISOString(),
  };
  await getDb().missionState.put(completo);
  if (syncRemote && typeof window !== 'undefined') {
    sincronizarEstadoMisionRemoto(completo).catch(() => {});
  }
  return completo;
}

export const getMissionState = (id = 'ares-iv') => getDb().missionState.get(id);

export async function saveCabinTelemetry(registros, { syncRemote = true } = {}) {
  const lista = Array.isArray(registros) ? registros : [registros];
  if (!lista.length) return [];
  const completos = lista.map((r) => ({
    id: r.id ?? `cabina-sol-${r.sol}`,
    ts: r.ts ?? new Date().toISOString(),
    source: r.source ?? 'cabin_sensors',
    ...r,
  }));
  await getDb().cabinTelemetry.bulkPut(completos);
  if (syncRemote && typeof window !== 'undefined') {
    sincronizarCabinaRemota(completos).catch(() => {});
  }
  return completos;
}

export const getCabinTelemetry = () => getDb().cabinTelemetry.orderBy('sol').toArray();

export const getCabinTelemetryForSol = (sol) =>
  getDb().cabinTelemetry.where('sol').equals(Number(sol)).last();

// ─── Notificaciones persistentes en BD ─────────────────────────────────────

export async function addNotificationDb(notif, { syncRemote = true } = {}) {
  const completa = {
    id: notif.id ?? nuevoId(),
    ts: notif.ts ?? new Date().toISOString(),
    leida: false,
    ...notif,
  };
  await getDb().notifications.put(completa);
  if (syncRemote && typeof window !== 'undefined') {
    sincronizarNotificacionRemota(completa).catch(() => {});
  }
  return completa;
}

export async function getNotificationsDb(astronautId = null) {
  const todas = await getDb().notifications.orderBy('ts').reverse().toArray();
  if (!astronautId) return todas;
  return todas.filter((n) => !n.astronautId || n.astronautId === astronautId);
}

// ─── Respuestas de la IA ───────────────────────────────────────────────────

/**
 * Guarda una respuesta de la IA (historial y respaldo para la demo sin IA).
 * @param {Pick<import('./tipos.js').AiResult, 'kind'|'input'|'output'> & Partial<import('./tipos.js').AiResult>} resultado
 * @returns {Promise<import('./tipos.js').AiResult>}
 */
export async function saveAiResult(resultado, { syncRemote = true } = {}) {
  const completo = { id: nuevoId(), ts: new Date().toISOString(), ...resultado };
  await getDb().aiResults.put(completo);
  if (syncRemote && typeof window !== 'undefined') {
    sincronizarResultadoIaRemoto(completo).catch(() => {});
  }
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
