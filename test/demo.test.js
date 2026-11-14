import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { generarDemo, SOL_ACTUAL, SOLES_MISION } from '../lib/demo/generador.js';
import { DEMO_DATA, reiniciarDemo, sembrarDemo, sincronizarWatch } from '../lib/demo/sembrar.js';
import { evaluate } from '../lib/motor/evaluar.js';
import { getAlerts, getReadings, getSymptoms, listAstronauts, resetDb } from '../lib/db.js';

beforeEach(async () => {
  await resetDb();
});

test('demo-data.json coincide con el generador determinista y cubre 60 soles y 2 tripulantes', () => {
  const generado = generarDemo(42);
  assert.deepEqual(DEMO_DATA.astronauts, generado.astronauts);
  assert.equal(DEMO_DATA.readings.length, generado.readings.length);
  assert.equal(DEMO_DATA.mission.totalSoles, SOLES_MISION);
  assert.equal(DEMO_DATA.mission.solActual, SOL_ACTUAL);

  const solesAna = new Set(DEMO_DATA.readings.filter((r) => r.astronautId === 'ana').map((r) => r.sol));
  const solesMarcos = new Set(DEMO_DATA.readings.filter((r) => r.astronautId === 'marcos').map((r) => r.sol));
  assert.equal(solesAna.size, 60);
  assert.equal(solesMarcos.size, 60);
});

test('historia de 60 soles: soles 1-30 verdes, 31-40 fatiga/estrés, sol 41 herpes+37.6, Marcos todo verde', () => {
  const ana = DEMO_DATA.astronauts.find((a) => a.id === 'ana');
  const marcos = DEMO_DATA.astronauts.find((a) => a.id === 'marcos');
  const rAna = DEMO_DATA.readings.filter((r) => r.astronautId === 'ana');
  const sAna = DEMO_DATA.symptoms.filter((s) => s.astronautId === 'ana');
  const rMarcos = DEMO_DATA.readings.filter((r) => r.astronautId === 'marcos');

  const sol20 = evaluate(rAna, ana.baseline, 'mars_base', { symptoms: sAna, sol: 20 });
  assert.equal(sol20.globalLevel, 'green');
  assert.equal(sol20.alerts.length, 0);

  const sol35Sleep = rAna.filter((r) => r.sol >= 31 && r.sol <= 40 && r.indicator === 'sleep_h');
  const sol35Stress = rAna.filter((r) => r.sol >= 31 && r.sol <= 40 && r.indicator === 'stress');
  assert.ok(sol35Sleep.every((r) => r.value < 6.7));
  assert.ok(sol35Stress.every((r) => r.value >= 7 && r.value <= 8));

  const sol42Ana = evaluate(rAna, ana.baseline, 'mars_base', { symptoms: sAna, sol: 42 });
  assert.equal(sol42Ana.globalLevel, 'orange');
  assert.equal(sol42Ana.alerts[0].ruleId, 'viral_reactivation');

  const sol42Marcos = evaluate(rMarcos, marcos.baseline, 'mars_base', { sol: 42 });
  assert.equal(sol42Marcos.globalLevel, 'green');
  assert.equal(sol42Marcos.alerts.length, 0);
});

test('sembrarDemo es idempotente y sincronizarWatch agrega lecturas watch_sim del sol 42', async () => {
  let guardadasFotos = 0;
  const primera = await sembrarDemo({
    savePhoto: async () => {
      guardadasFotos += 1;
      return `foto-demo-${guardadasFotos}`;
    },
  });
  assert.equal(primera.seeded, true);
  assert.equal(guardadasFotos, 1);

  const segunda = await sembrarDemo();
  assert.equal(segunda.seeded, false);

  const tripulantes = await listAstronauts();
  assert.equal(tripulantes.length, 2);
  assert.equal((await getSymptoms('ana'))[0].photoBlobId, 'foto-demo-1');
  assert.ok((await getAlerts('ana')).some((a) => a.ruleId === 'viral_reactivation'));

  const antesWatch = (await getReadings('ana')).filter((r) => r.sol === SOL_ACTUAL && r.source === 'watch_sim');
  assert.equal(antesWatch.length, 0);

  const sync = await sincronizarWatch(SOL_ACTUAL, 'ana');
  assert.equal(sync.readings.length, 4);
  assert.ok(sync.readings.every((r) => r.source === 'watch_sim' && r.sol === SOL_ACTUAL));
  assert.equal(sync.evaluacion.globalLevel, 'orange');

  const despuesWatch = (await getReadings('ana')).filter((r) => r.sol === SOL_ACTUAL && r.source === 'watch_sim');
  assert.equal(despuesWatch.length, 4);

  const reinicio = await reiniciarDemo();
  assert.equal(reinicio.seeded, true);
  const trasReinicio = (await getReadings('ana')).filter((r) => r.sol === SOL_ACTUAL && r.source === 'watch_sim');
  assert.equal(trasReinicio.length, 0);
});
