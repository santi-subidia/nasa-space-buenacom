import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { addReading, getCheckinPorSol, getChequeoFacialPorSol, getDb, getReadings, getSymptoms, guardarCheckinPorSol, guardarChequeoFacial, resetDb } from '../lib/db.js';

beforeEach(resetDb);
const ahora = new Date('2026-11-15T14:00:00.000Z');
const chequeo = (astronautId = 'ana') => ({ astronautId, sol: 42, lecturas: [{ indicator: 'temp', value: 36.7 }] });
const completarCara = (astronautId = 'ana', sol = 42) => guardarChequeoFacial({
  astronautId, sol, resultado: { ok: true, comparacionDeIA: true, resumen: 'Análisis completado.' },
});

test('un check-in por sol guarda todos sus datos junto al análisis facial y conserva la confirmación', async () => {
  const facial = await completarCara();
  const primero = await guardarCheckinPorSol({ ...chequeo(), sintoma: { bodyZone: 'immune', code: 'rash', photoBlobId: 'foto-prueba' } }, ahora);
  assert.equal(primero.guardado, true);
  assert.equal((await getReadings('ana')).length, 1);
  assert.equal((await getSymptoms('ana')).length, 1);
  assert.equal((await getCheckinPorSol('ana', 42)).ts, ahora.toISOString());
  assert.equal(primero.checkin.facialId, facial.id);

  const segundo = await guardarCheckinPorSol({ ...chequeo(), lecturas: [{ indicator: 'temp', value: 38 }] }, ahora);
  assert.equal(segundo.guardado, false);
  assert.equal((await getReadings('ana'))[0].value, 36.7);
  assert.equal(await getDb().checkinsPorSol.count(), 1);
});

test('dos pestañas que guardan a la vez producen un solo check-in y cada tripulante tiene su propio cupo', async () => {
  await completarCara();
  await completarCara('marcos');
  const resultados = await Promise.all([
    guardarCheckinPorSol(chequeo(), ahora),
    guardarCheckinPorSol(chequeo(), ahora),
  ]);
  assert.equal(resultados.filter((resultado) => resultado.guardado).length, 1);
  assert.equal((await getReadings('ana')).length, 1);
  assert.equal((await guardarCheckinPorSol(chequeo('marcos'), ahora)).guardado, true);
  assert.equal(await getDb().checkinsPorSol.count(), 2);
});

test('el cambio de fecha terrestre mantiene el bloqueo del mismo sol y avanzar el sol habilita el próximo', async () => {
  const antes = new Date('2026-11-16T02:59:59.000Z');
  const despues = new Date('2026-11-16T03:00:00.000Z');
  await completarCara();
  assert.equal((await guardarCheckinPorSol(chequeo(), antes)).guardado, true);
  assert.equal((await guardarCheckinPorSol(chequeo(), despues)).guardado, false);
  assert.equal((await guardarCheckinPorSol(chequeo(), new Date('2026-11-20T14:00:00Z'))).guardado, false);
  assert.equal(await getCheckinPorSol('ana', 43), null);
  await assert.rejects(guardarCheckinPorSol({ ...chequeo(), sol: 43 }, despues), /Cómo me ves hoy/);
  await completarCara('ana', 43);
  assert.equal((await guardarCheckinPorSol({ ...chequeo(), sol: 43 }, despues)).guardado, true);
  assert.equal((await getReadings('ana')).length, 2);
});

test('un error intermedio revierte las lecturas y la confirmación y permite reintentar', async () => {
  await completarCara();
  const repetidas = [
    { id: 'mismo-id', indicator: 'temp', value: 36.7 },
    { id: 'mismo-id', indicator: 'hr_rest', value: 70 },
  ];
  await assert.rejects(guardarCheckinPorSol({ ...chequeo(), lecturas: repetidas }, ahora));
  assert.equal((await getReadings('ana')).length, 0);
  assert.equal(await getCheckinPorSol('ana', 42), null);
  assert.equal((await guardarCheckinPorSol(chequeo(), ahora)).guardado, true);
});

test('las confirmaciones anteriores por fecha se reconocen en su sol y conservan el historial original', async () => {
  const anterior = { astronautId: 'ana', fecha: '2026-11-14', sol: 42, lecturas: ['lectura-anterior'] };
  await getDb().checkins.add(anterior);
  assert.deepEqual(await getCheckinPorSol('ana', 42), anterior);
  assert.equal((await guardarCheckinPorSol(chequeo(), ahora)).guardado, false);
  assert.deepEqual(await getDb().checkins.get(['ana', anterior.fecha]), anterior);
  assert.equal(await getCheckinPorSol('ana', 43), null);
  assert.equal(await getCheckinPorSol('marcos', 42), null);
});

test('las mediciones o fotos de lesiones no sustituyen al chequeo facial obligatorio', async () => {
  await addReading({ astronautId: 'ana', indicator: 'hr_rest', value: 70, sol: 42, source: 'camera' });
  const foto = { astronautId: 'ana', sol: 42, sintoma: { bodyZone: 'immune', code: 'rash', photoBlobId: 'foto-hoy' } };
  await assert.rejects(guardarCheckinPorSol(chequeo(), ahora), /Cómo me ves hoy/);
  await assert.rejects(guardarCheckinPorSol(foto, ahora), /Cómo me ves hoy/);
  assert.equal(await getCheckinPorSol('ana', 42), null);
  assert.equal((await getReadings('ana')).length, 1);
  assert.equal((await getSymptoms('ana')).length, 0);
  await completarCara();
  assert.equal((await guardarCheckinPorSol(foto, ahora)).guardado, true);
  assert.equal((await guardarCheckinPorSol(chequeo(), ahora)).guardado, false);
});

test('el análisis facial es exclusivo del tripulante y sol y permite completar sin nuevas mediciones manuales', async () => {
  await completarCara('marcos', 42);
  await completarCara('ana', 41);
  assert.equal(await getChequeoFacialPorSol('ana', 42), null);
  await assert.rejects(guardarCheckinPorSol(chequeo(), ahora), /Cómo me ves hoy/);
  await completarCara();
  assert.ok(await getChequeoFacialPorSol('ana', 42));
  assert.equal((await guardarCheckinPorSol({ astronautId: 'ana', sol: 42 }, ahora)).guardado, true);
});

test('un análisis fallido o sin resultados no completa el requisito y el análisis local de parpadeo sí lo hace', async () => {
  for (const resultado of [{ ok: false }, { ok: true, comparacionDeIA: false, fatiga: null }]) {
    assert.throws(() => guardarChequeoFacial({ astronautId: 'ana', sol: 42, resultado }), /análisis facial/);
  }
  assert.equal(await getDb().aiResults.count(), 0);
  const local = await guardarChequeoFacial({ astronautId: 'ana', sol: 42, resultado: { ok: true, comparacionDeIA: false, fatiga: { nivel: 'normal', mensaje: 'Parpadeo normal.' } } });
  assert.equal((await getChequeoFacialPorSol('ana', 42)).id, local.id);
  await assert.rejects(guardarCheckinPorSol({ ...chequeo(), sol: null }, ahora), /sol/);
});
