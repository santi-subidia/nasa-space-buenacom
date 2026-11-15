// ¿VYTA puede cargar los signos vitales? Recorre el camino completo:
// carga (manual como en /registrar, o desde el Watch simulado) → IndexedDB → motor → tarjetas de Inicio y Salud.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { addReading, getAlerts, getLastReading, getReadings, resetDb } from '../lib/db.js';
import { sincronizarWatch } from '../lib/demo/sembrar.js';
import { evaluate } from '../lib/motor/evaluar.js';
import { metricasDesdeLecturas } from '../components/inicio/metricas.js';
import { datosSalud } from '../components/salud/datos.js';

const SOL = 42;
const ts = (minuto) => `2026-11-22T07:${String(minuto).padStart(2, '0')}:00.000Z`;

// Lo mismo que hace `guardarLecturas` (lib/datos/lecturas.js) al guardar el formulario de Registrar.
const cargar = (astronautId, lecturas) => Promise.all(lecturas.map((l) => addReading({ astronautId, ...l })));

const pantallas = (lecturas, sol = SOL) => {
  const evaluacion = evaluate(lecturas, {}, 'mars_base', { sol });
  return {
    inicio: metricasDesdeLecturas(lecturas, evaluacion, {}, sol),
    salud: datosSalud({ lecturas, evaluacion, sol }),
  };
};
const tarjeta = (lista, id) => lista.find((t) => t.id === id);

beforeEach(resetDb);

test('carga manual: los signos vitales se guardan con unidad y origen y se leen de vuelta', async () => {
  const guardadas = await cargar('ana', [
    { indicator: 'bp_sys', value: 118, sol: SOL, ts: ts(0) },
    { indicator: 'bp_dia', value: 76, sol: SOL, ts: ts(0) },
    { indicator: 'hr_rest', value: 64, sol: SOL, ts: ts(1) },
    { indicator: 'temp', value: 36.7, sol: SOL, ts: ts(2) },
    { indicator: 'spo2', value: 98, sol: SOL, ts: ts(3) },
  ]);

  assert.equal(guardadas.length, 5);
  assert.ok(guardadas.every((l) => l.id && l.source === 'manual'));
  assert.deepEqual(
    Object.fromEntries(guardadas.map((l) => [l.indicator, l.unit])),
    { bp_sys: 'mmHg', bp_dia: 'mmHg', hr_rest: 'bpm', temp: '°C', spo2: '%' },
  );

  const leidas = await getReadings('ana');
  assert.equal(leidas.length, 5);
  assert.equal((await getLastReading('ana', 'temp')).value, 36.7);
  assert.deepEqual(await getReadings('marcos'), [], 'no se mezclan con otro tripulante');
});

test('carga manual: los vitales guardados aparecen en las tarjetas de Inicio y Salud', async () => {
  await cargar('ana', [
    { indicator: 'bp_sys', value: 118, sol: SOL, ts: ts(0) },
    { indicator: 'bp_dia', value: 76, sol: SOL, ts: ts(0) },
    { indicator: 'hr_rest', value: 64, sol: SOL, ts: ts(1), note: 'HRV 48 ms' },
    { indicator: 'temp', value: 36.7, sol: SOL, ts: ts(2) },
    { indicator: 'spo2', value: 98, sol: SOL, ts: ts(3) },
  ]);
  const { inicio, salud } = pantallas(await getReadings('ana'));

  assert.equal(tarjeta(inicio, 'hr_rest').valor, '64');
  assert.equal(tarjeta(inicio, 'presion').valor, '118 / 76');
  assert.equal(tarjeta(inicio, 'spo2').valor, '98');
  assert.equal(tarjeta(inicio, 'temp').valor, '36.7');
  assert.equal(tarjeta(inicio, 'hrv').valor, '48');
  for (const id of ['hr_rest', 'presion', 'spo2', 'temp']) {
    assert.equal(tarjeta(inicio, id).estado, 'Normal range', `${id} en rango normal`);
  }

  const vitales = Object.fromEntries(salud.vitales.map((v) => [v.id, v]));
  assert.equal(vitales.hr_rest.valor, '64');
  assert.equal(vitales.presion.valor, '118 / 76');
  assert.equal(vitales.spo2.valor, '98');
  assert.equal(vitales.temp.valor, '36.7');
  assert.equal(vitales.hrv.valor, '48');
  assert.equal(vitales.hr_rest.nivel, 'green');
  assert.equal(vitales.respiracion.valor, '—', 'la frecuencia respiratoria no se mide todavía');
});

test('la presión arterial sólo se muestra cuando están cargadas la sistólica y la diastólica', async () => {
  await cargar('ana', [{ indicator: 'bp_sys', value: 120, sol: SOL, ts: ts(0) }]);
  let { inicio } = pantallas(await getReadings('ana'));
  assert.equal(tarjeta(inicio, 'presion').valor, '—');
  assert.equal(tarjeta(inicio, 'presion').estado, 'No data');

  await cargar('ana', [{ indicator: 'bp_dia', value: 80, sol: SOL, ts: ts(1) }]);
  ({ inicio } = pantallas(await getReadings('ana')));
  assert.equal(tarjeta(inicio, 'presion').valor, '120 / 80');
});

test('una nueva carga reemplaza a la anterior y un vital fuera de rango deja de verse verde', async () => {
  await cargar('ana', [{ indicator: 'temp', value: 36.6, sol: SOL - 1, ts: '2026-11-21T07:00:00.000Z' }]);
  await cargar('ana', [{ indicator: 'temp', value: 38.6, sol: SOL, ts: ts(0) }]);
  const { inicio, salud } = pantallas(await getReadings('ana'));

  assert.equal(tarjeta(inicio, 'temp').valor, '38.6');
  assert.notEqual(tarjeta(inicio, 'temp').estado, 'Normal range');
  assert.notEqual(salud.vitales.find((v) => v.id === 'temp').nivel, 'green');
});

test('rechaza un signo vital desconocido sin guardar nada', async () => {
  await assert.rejects(cargar('ana', [{ indicator: 'pulso_inventado', value: 70, sol: SOL }]), /Unknown indicator/);
  assert.deepEqual(await getReadings('ana'), []);
});

test('Sincronizar Watch carga FC, HRV, SpO₂ y temperatura y re-evalúa las alertas', async () => {
  const { readings } = await sincronizarWatch(SOL, 'ana');

  assert.deepEqual(readings.map((r) => r.indicator).sort(), ['hr_rest', 'sleep_h', 'spo2', 'temp']);
  assert.ok(readings.every((r) => r.source === 'watch_sim' && r.sol === SOL));

  const { inicio, salud } = pantallas(await getReadings('ana'));
  assert.equal(tarjeta(inicio, 'hr_rest').valor, '74');
  assert.equal(tarjeta(inicio, 'hrv').valor, '34', 'el HRV sale de la nota del Watch');
  assert.equal(tarjeta(inicio, 'spo2').valor, '97');
  assert.equal(tarjeta(inicio, 'temp').valor, '37.6');
  assert.equal(salud.vitales.find((v) => v.id === 'temp').valor, '37.6');

  const alertas = await getAlerts('ana');
  assert.ok(Array.isArray(alertas), 'las alertas quedan guardadas tras sincronizar');
});
