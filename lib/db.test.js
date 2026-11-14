import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  addReading, getReadings, getLastReading, addSymptom, getSymptoms, replaceAlerts, getAlerts,
  saveTask, getTasks, setTaskDone, saveAiResult, findAiResult, saveAstronaut, listAstronauts, resetDb,
} from './db.js';
import { nivelMaximo, gravedad } from './tipos.js';

beforeEach(resetDb);

test('guarda y lee mediciones desde una fecha, filtrando por indicador', async () => {
  const base = { astronautId: 'a1', source: 'manual' };
  await addReading({ ...base, indicator: 'sleep_h', value: 5.5, ts: '2026-01-01T07:00:00Z' });
  await addReading({ ...base, indicator: 'sleep_h', value: 7.2, ts: '2026-01-02T07:00:00Z' });
  await addReading({ ...base, indicator: 'temp', value: 37.6, ts: '2026-01-02T07:05:00Z' });
  await addReading({ astronautId: 'a2', indicator: 'temp', value: 36.5, ts: '2026-01-02T07:05:00Z' });

  assert.equal((await getReadings('a1')).length, 3);
  assert.equal((await getReadings('a1', '2026-01-02T00:00:00Z')).length, 2);
  const sueno = await getReadings('a1', undefined, { indicator: 'sleep_h' });
  assert.deepEqual(sueno.map((r) => r.value), [5.5, 7.2]);
  assert.equal((await getLastReading('a1', 'sleep_h')).value, 7.2);
  assert.equal(await getLastReading('a1', 'spo2'), undefined);
});

test('addReading completa id, unidad, ts y source; rechaza indicadores desconocidos', async () => {
  const r = await addReading({ astronautId: 'a1', indicator: 'temp', value: 36.8 });
  assert.ok(r.id && r.ts);
  assert.equal(r.unit, '°C');
  assert.equal(r.source, 'manual');
  await assert.rejects(addReading({ astronautId: 'a1', indicator: 'nope', value: 1 }));
});

test('síntomas, alertas, tareas y respuestas de la IA', async () => {
  await addSymptom({ astronautId: 'a1', bodyZone: 'immune', code: 'cold_sore', severity: 2 });
  assert.equal((await getSymptoms('a1')).length, 1);

  const alerta = { level: 'orange', zone: 'immune', ruleId: 'viral_reactivation', title: 't', why: 'w', actions: [], escalate: 'cmo', nasaSource: 's', ts: '2026-01-01T00:00:00Z' };
  await replaceAlerts('a1', [alerta]);
  await replaceAlerts('a1', [alerta, { ...alerta, ruleId: 'otra' }]);
  assert.equal((await getAlerts('a1')).length, 2);

  const t = await saveTask({ astronautId: 'a1', kind: 'measure', title: 'Medir PA', missionTime: '2026-01-01T07:00:00Z' });
  await setTaskDone(t.id);
  assert.equal((await getTasks('a1'))[0].done, true);

  await saveAiResult({ kind: 'answer', input: { q: 'hola' }, output: 'chau' });
  assert.equal((await findAiResult('answer', (i) => i.q === 'hola')).output, 'chau');
  assert.equal(await findAiResult('board'), undefined);
});

test('tripulantes y utilidades de niveles', async () => {
  await saveAstronaut({ id: 'a1', name: 'Ana', role: 'cmo', baseline: { hr_rest: 62 } });
  assert.equal((await listAstronauts())[0].name, 'Ana');
  assert.equal(nivelMaximo('green', 'orange', 'yellow'), 'orange');
  assert.equal(nivelMaximo(), 'green');
  assert.ok(gravedad('red') > gravedad('yellow'));
});
