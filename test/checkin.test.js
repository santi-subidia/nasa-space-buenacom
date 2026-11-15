import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { fechaCheckin } from '../lib/checkin.js';
import { addReading, addSymptom, getCheckinDiario, getDb, getReadings, getSymptoms, guardarCheckinDiario, resetDb } from '../lib/db.js';

beforeEach(resetDb);
const ahora = new Date('2026-11-15T14:00:00.000Z');
const chequeo = (astronautId = 'ana') => ({ astronautId, sol: 42, lecturas: [{ indicator: 'temp', value: 36.7 }] });

test('un solo check-in diario guarda todos sus datos y conserva la confirmación al volver a consultarla', async () => {
  const primero = await guardarCheckinDiario({ ...chequeo(), sintoma: { bodyZone: 'immune', code: 'rash', photoBlobId: 'foto-prueba' } }, ahora);
  assert.equal(primero.guardado, true);
  assert.equal((await getReadings('ana')).length, 1);
  assert.equal((await getSymptoms('ana')).length, 1);
  assert.equal((await getCheckinDiario('ana', '2026-11-15')).ts, ahora.toISOString());

  const segundo = await guardarCheckinDiario({ ...chequeo(), lecturas: [{ indicator: 'temp', value: 38 }] }, ahora);
  assert.equal(segundo.guardado, false);
  assert.equal((await getReadings('ana'))[0].value, 36.7);
  assert.equal(await getDb().checkins.count(), 1);
});

test('dos pestañas que guardan a la vez producen un solo check-in y cada tripulante tiene su propio cupo', async () => {
  const resultados = await Promise.all([
    guardarCheckinDiario(chequeo(), ahora),
    guardarCheckinDiario(chequeo(), ahora),
  ]);
  assert.equal(resultados.filter((resultado) => resultado.guardado).length, 1);
  assert.equal((await getReadings('ana')).length, 1);
  assert.equal((await guardarCheckinDiario(chequeo('marcos'), ahora)).guardado, true);
  assert.equal(await getDb().checkins.count(), 2);
});

test('se habilita un chequeo nuevo a medianoche de Buenos Aires, aunque el sol de la misión siga igual', async () => {
  const antes = new Date('2026-11-16T02:59:59.000Z');
  const despues = new Date('2026-11-16T03:00:00.000Z');
  assert.equal(fechaCheckin(antes), '2026-11-15');
  assert.equal(fechaCheckin(despues), '2026-11-16');
  assert.equal((await guardarCheckinDiario(chequeo(), antes)).guardado, true);
  assert.equal((await guardarCheckinDiario(chequeo(), despues)).guardado, true);
  assert.equal((await getReadings('ana')).length, 2);
});

test('un error intermedio revierte las lecturas y la confirmación y permite reintentar', async () => {
  const repetidas = [
    { id: 'mismo-id', indicator: 'temp', value: 36.7 },
    { id: 'mismo-id', indicator: 'hr_rest', value: 70 },
  ];
  await assert.rejects(guardarCheckinDiario({ ...chequeo(), lecturas: repetidas }, ahora));
  assert.equal((await getReadings('ana')).length, 0);
  assert.equal(await getCheckinDiario('ana', '2026-11-15'), null);
  assert.equal((await guardarCheckinDiario(chequeo(), ahora)).guardado, true);
});

test('reconoce chequeos anteriores y excluye demo, Watch, voz, cámara y tests cognitivos del límite diario', async () => {
  for (const source of ['watch_sim', 'voice', 'camera']) {
    await addReading({ astronautId: 'ana', indicator: 'temp', value: 36.7, source, ts: ahora.toISOString() });
  }
  await addReading({ id: 'demo-ana-42-temp', astronautId: 'ana', indicator: 'temp', value: 36.7, source: 'manual', ts: ahora.toISOString() });
  await addReading({ astronautId: 'ana', indicator: 'reaction_ms', value: 300, source: 'manual', ts: ahora.toISOString() });
  await addReading({ astronautId: 'ana', indicator: 'visual_acuity', value: 90, source: 'manual', ts: ahora.toISOString() });
  assert.equal(await getCheckinDiario('ana', '2026-11-15'), null);

  await addReading({ astronautId: 'ana', indicator: 'water_ml', value: 2200, source: 'manual', ts: ahora.toISOString() });
  assert.equal((await getCheckinDiario('ana', '2026-11-15')).origen, 'anterior');
  assert.equal((await guardarCheckinDiario(chequeo(), ahora)).guardado, false);
  assert.equal(await getCheckinDiario('marcos', '2026-11-15'), null);
});

test('el chequeo con una foto solamente también completa el día y no permite otro guardado', async () => {
  const foto = { astronautId: 'ana', sol: 42, sintoma: { bodyZone: 'immune', code: 'rash', photoBlobId: 'foto-hoy' } };
  assert.equal((await guardarCheckinDiario(foto, ahora)).guardado, true);
  assert.ok(await getCheckinDiario('ana', '2026-11-15'));
  assert.equal((await guardarCheckinDiario(chequeo(), ahora)).guardado, false);

  await addSymptom({ astronautId: 'marcos', bodyZone: 'immune', code: 'rash', photoBlobId: 'foto-anterior', ts: ahora.toISOString() });
  assert.equal((await getCheckinDiario('marcos', '2026-11-15')).origen, 'anterior');
});
