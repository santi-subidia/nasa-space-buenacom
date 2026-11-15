import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import {
  getAlerts,
  getCabinTelemetryForSol,
  getMissionState,
  getNotificationsDb,
  getReadings,
  resetDb,
  saveCabinTelemetry,
} from '../lib/db.js';
import { sembrarDemo } from '../lib/demo/sembrar.js';
import { evaluarZonas } from '../lib/content/zonasSalud.js';
import { resumirTendenciaParaVega } from '../lib/datos/indicadores.js';
import { rachaEjercicio } from '../lib/entrenador/racha.js';
import {
  ARTEFACTOS_NASA,
  PERFILES_SIMULACION,
  avanzarYSimularSoles,
  generarPaqueteSol,
  inyectarArtefactoEnSol,
} from '../lib/simulador/artefactos.js';

beforeEach(async () => {
  await resetDb();
});

test('generarPaqueteSol respeta rangos de artefactos NASA y aplica deriva diaria según perfil', () => {
  const ana = {
    id: 'ana',
    baseline: { hr_rest: 64, spo2: 98, temp: 36.7, sleep_h: 7.8, stress: 3, mood: 4, water_ml: 2150, exercise_min: 90, reaction_ms: 260, visual_acuity: 92 },
  };
  const historial = [
    { astronautId: 'ana', indicator: 'sleep_h', value: 7.6, sol: 42 },
    { astronautId: 'ana', indicator: 'stress', value: 3, sol: 42 },
    { astronautId: 'ana', indicator: 'reaction_ms', value: 260, sol: 42 },
  ];

  const nominal = generarPaqueteSol({ astronauta: ana, sol: 43, paso: 1, historial, perfil: 'nominal', seed: 100 });
  for (const l of nominal.lecturas) {
    const rango = Object.values(ARTEFACTOS_NASA).map((a) => a.rangos[l.indicator]).find(Boolean);
    if (rango) {
      assert.ok(l.value >= rango.min && l.value <= rango.max, `${l.indicator}=${l.value} fuera de rango [${rango.min}, ${rango.max}]`);
    }
    assert.equal(l.sol, 43);
  }

  const co2 = generarPaqueteSol({
    astronauta: ana,
    sol: 43,
    paso: 1,
    historial,
    cabinaPrevia: { co2Mmhg: 2.9 },
    perfil: 'depurador_co2',
    seed: 101,
  });
  assert.ok(co2.cabina.co2Mmhg >= 2.9, 'el perfil depurador_co2 eleva CO2 sobre el valor previo');
});

test('avanzarYSimularSoles avanza el sol en BD, carga datos futuros y dispara evaluación clínica inmediata', async () => {
  await sembrarDemo();
  const antes = await getMissionState();
  assert.equal(antes.solActual, 42);

  const sim = await avanzarYSimularSoles({
    cantidad: 5,
    perfil: 'fatiga_progresiva',
    seed: 4242,
  });

  assert.equal(sim.solAnterior, 42);
  assert.equal(sim.solNuevo, 47);
  assert.ok(sim.lecturasGeneradas >= 60);

  const despues = await getMissionState();
  assert.equal(despues.solActual, 47);

  const lecturasAna = await getReadings('ana');
  assert.ok(lecturasAna.some((r) => r.sol === 47 && r.source === 'watch_sim'));

  const cab47 = await getCabinTelemetryForSol(47);
  assert.ok(cab47 && cab47.sol === 47);

  const alertasAna = await getAlerts('ana');
  assert.ok(alertasAna.length > 0, 'el motor evalúa y guarda alertas inmediatamente tras simular soles futuros');

  const notifs = await getNotificationsDb('ana');
  assert.ok(notifs.length > 0, 'persiste notificación en BD al detectar alertas en soles futuros');
});

test('inyectarArtefactoEnSol permite cargar datos puntuales y recalcular al instante', async () => {
  await sembrarDemo();
  const res = await inyectarArtefactoEnSol({
    astronautId: 'ana',
    sol: 42,
    artefactoId: 'watch',
    perfil: 'reactivacion_viral',
    seed: 77,
  });
  assert.equal(res.artefactoId, 'watch');
  assert.ok(res.lecturas.some((r) => r.indicator === 'hr_rest' && /HRV \d+ ms/.test(r.note || '')));
  assert.ok(['green', 'yellow', 'orange', 'red'].includes(res.evaluacion.globalLevel));
});

test('evaluarZonas, rachaEjercicio y resumirTendenciaParaVega reflejan únicamente datos reales de la BD', async () => {
  const lecturas = [
    { indicator: 'water_ml', value: 2600, sol: 43, ts: '2026-10-13T20:00:00Z' },
    { indicator: 'exercise_min', value: 95, sol: 41, ts: '2026-10-11T17:00:00Z' },
    { indicator: 'exercise_min', value: 85, sol: 42, ts: '2026-10-12T17:00:00Z' },
    { indicator: 'exercise_min', value: 90, sol: 43, ts: '2026-10-13T17:00:00Z' },
    { indicator: 'sleep_h', value: 8.1, sol: 43, ts: '2026-10-13T07:00:00Z' },
    { indicator: 'stress', value: 2, sol: 43, ts: '2026-10-13T08:00:00Z' },
  ];

  assert.equal(rachaEjercicio(lecturas, 43), 3);

  await saveCabinTelemetry([{ id: 'cabina-sol-43', sol: 43, co2Mmhg: 3.15, o2Pct: 20.8, pressureKpa: 101.2, noiseDba: 61, radiationRateMsvSol: 0.73, radiationTotalMsv: 355 }]);
  const cab43 = await getCabinTelemetryForSol(43);

  const zonas = evaluarZonas({ lecturas, sintomas: [], evaluacion: { globalLevel: 'green', zoneLevels: {} }, sol: 43, cabinaDb: cab43 });
  const rinones = zonas.find((z) => z.id === 'kidneys');
  const musculos = zonas.find((z) => z.id === 'muscles');
  const pulmones = zonas.find((z) => z.id === 'lungs');
  const oido = zonas.find((z) => z.id === 'inner_ear');

  assert.equal(rinones.indicadores[0].valor, '2,6 L (sol 43)');
  assert.equal(musculos.indicadores[0].valor, '90 min (plan: 90)');
  assert.equal(musculos.indicadores[1].valor, '3 soles');
  assert.equal(pulmones.indicadores[1].valor, '3,15 mmHg');
  assert.equal(oido.indicadores[1].valor, '61 dBA');

  const texto = resumirTendenciaParaVega({ serie: [{ sol: 43, sleep_h: 8.1, stress: 2 }], solActual: 43, baseline: { sleep_h: 7.8 } });
  assert.match(texto, /8,1 h/);
  assert.ok(!texto.includes('sol 41'));
  assert.ok(Object.keys(PERFILES_SIMULACION).length >= 5);
});
