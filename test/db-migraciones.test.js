import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { getDb, guardarCheckinPorSol, guardarChequeoFacial, getCheckinPorSol } from '../lib/db.js';

const db = getDb();
const esquemaBase = {
  astronauts: 'id',
  readings: 'id, astronautId, [astronautId+ts], [astronautId+indicator+ts]',
  symptoms: 'id, astronautId, [astronautId+ts]',
  alerts: 'id, astronautId, [astronautId+ts]',
  tasks: 'id, astronautId, [astronautId+missionTime]',
  aiResults: 'id, kind, ts',
};
const esquemaInformes = { transmisionesEnlace: 'id, astronaut_id, enviado_en' };
const esquemaCheckin = { checkins: '[astronautId+fecha], astronautId' };
const esquemaMision = {
  missionState: 'id',
  cabinTelemetry: 'id, sol, ts',
  notifications: 'id, astronautId, sol, ts',
};
const registros = {
  astronauts: { id: 'ana', name: 'Ana', baseline: { temp: 36.5 } },
  readings: { id: 'lectura', astronautId: 'ana', indicator: 'temp', value: 36.7, sol: 43, ts: '2026-11-15T14:00:00Z', checkinFecha: '2026-11-15' },
  symptoms: { id: 'sintoma', astronautId: 'ana', bodyZone: 'immune', code: 'rash', photoBlobId: 'foto-existente' },
  alerts: { id: 'alerta', astronautId: 'ana', title: 'Control', level: 'yellow' },
  tasks: { id: 'tarea', astronautId: 'ana', title: 'Ejercicio', missionTime: '10:00', done: true },
  aiResults: { id: 'respuesta', kind: 'answer', input: {}, output: 'Respuesta guardada' },
  transmisionesEnlace: { id: 'mensaje', astronaut_id: 'ana', mensaje: 'Informe guardado', enviado_en: '2026-11-15T14:00:00Z' },
  checkins: { astronautId: 'ana', fecha: '2026-11-15', sol: 43, lecturas: ['lectura'] },
  missionState: { id: 'ares-iv', solActual: 43 },
  cabinTelemetry: { id: 'cabina', sol: 43, co2Mmhg: 2.1 },
  notifications: { id: 'aviso', astronautId: 'ana', sol: 43, titulo: 'Control', leida: true },
};

beforeEach(async () => {
  db.close();
  await Dexie.delete(db.name);
});
afterEach(() => db.close());

const versionesAnteriores = [
  { nombre: 'base v1', version: 1, tablas: esquemaBase },
  { nombre: 'Informes local v2', version: 2, tablas: { ...esquemaBase, ...esquemaInformes } },
  { nombre: 'check-in local v3', version: 3, tablas: { ...esquemaBase, ...esquemaInformes, ...esquemaCheckin } },
  { nombre: 'persistencia de GitHub v2', version: 2, tablas: { ...esquemaBase, ...esquemaMision } },
  { nombre: 'integración v4', version: 4, tablas: { ...esquemaBase, ...esquemaInformes, ...esquemaCheckin, ...esquemaMision } },
];

for (const anterior of versionesAnteriores) {
  test(`la migración desde ${anterior.nombre} conserva cada registro y agrega todas las tablas`, async () => {
    const legado = new Dexie(db.name);
    legado.version(anterior.version).stores(anterior.tablas);
    try {
      await legado.open();
      for (const nombre of Object.keys(anterior.tablas)) {
        await legado.table(nombre).add(registros[nombre]);
      }
    } finally {
      legado.close();
    }

    await db.open();
    assert.equal(db.verno, 5);
    assert.deepEqual(db.tables.map((tabla) => tabla.name).sort(), [...Object.keys(registros), 'checkinsPorSol'].sort());
    for (const nombre of Object.keys(anterior.tablas)) {
      assert.deepEqual(await db.table(nombre).toArray(), [registros[nombre]], nombre);
    }
    for (const nombre of Object.keys(registros).filter((tabla) => !(tabla in anterior.tablas))) {
      assert.equal(await db.table(nombre).count(), 0, nombre);
    }

    if ('checkins' in anterior.tablas) assert.deepEqual(await getCheckinPorSol('ana', 43), registros.checkins);
    await guardarChequeoFacial({ astronautId: 'ana', sol: 44, resultado: { ok: true, comparacionDeIA: true } });
    const resultado = await guardarCheckinPorSol({
      astronautId: 'ana', sol: 44, lecturas: [{ indicator: 'spo2', value: 98 }],
    }, new Date('2026-11-16T14:00:00Z'));
    assert.equal(resultado.guardado, true);
    assert.equal(resultado.checkin.sol, 44);
    assert.equal((await db.readings.get('lectura')).value, 36.7);
  });
}
