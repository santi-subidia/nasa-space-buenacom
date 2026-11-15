import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { addReading, getReadings, resetDb } from '../lib/db.js';
import { calcularPuntajeSalud, metricasDesdeLecturas, lecturasParaInicio } from '../components/inicio/metricas.js';
import { evaluate } from '../lib/motor/evaluar.js';

beforeEach(async () => { await resetDb(); });
const tarjeta = (datos, id) => datos.find((t) => t.id === id);
const lectura = (indicator, value, sol, ts = `2026-10-${String(sol).padStart(2, '0')}T07:00:00.000Z`) => ({ astronautId: 'ana', indicator, value, sol, ts });

test('Inicio conserva las seis métricas de Figma y refleja cambios guardados en la base', async () => {
  await addReading(lectura('hr_rest', 68, 41));
  await addReading(lectura('bp_sys', 118, 41));
  await addReading(lectura('bp_dia', 91, 41));
  await addReading(lectura('temp', 37.6, 41));
  const inicial = metricasDesdeLecturas(await getReadings('ana'), {}, {}, 42);
  assert.deepEqual(inicial.map((t) => t.id), ['hr_rest', 'hrv', 'spo2', 'sleep_h', 'presion', 'temp']);
  assert.equal(tarjeta(inicial, 'hr_rest').valor, '68');
  assert.equal(tarjeta(inicial, 'presion').valor, '118 / 91');
  assert.equal(tarjeta(inicial, 'presion').estado, 'Alerta');
  assert.equal(tarjeta(inicial, 'temp').valor, '37,6');
  assert.equal(tarjeta(inicial, 'temp').estado, 'Atención');
  await addReading(lectura('hr_rest', 99, 42));
  const actualizado = metricasDesdeLecturas(await getReadings('ana'), {}, {}, 42);
  assert.equal(tarjeta(actualizado, 'hr_rest').valor, '99');
  assert.equal(tarjeta(actualizado, 'hr_rest').estado, 'Atención');
});

test('HRV usa la nota realmente guardada, en ms, y nunca reutiliza la frecuencia cardíaca', async () => {
  await addReading(lectura('hr_rest', 74, 41));
  const sinHrv = metricasDesdeLecturas(await getReadings('ana'), {}, {}, 42);
  assert.equal(tarjeta(sinHrv, 'hrv').valor, '—');
  assert.equal(tarjeta(sinHrv, 'hrv').estado, 'Sin datos');
  await addReading({ ...lectura('hr_rest', 74, 42), note: 'FC reposo +10 sobre base · HRV 34 ms', source: 'watch_sim' });
  const conHrv = metricasDesdeLecturas(await getReadings('ana'), {}, {}, 42);
  assert.equal(tarjeta(conHrv, 'hrv').valor, '34');
  assert.equal(tarjeta(conHrv, 'hrv').unidad, 'ms');
  assert.equal(tarjeta(conHrv, 'hrv').estado, 'Registrada');
  const otroTripulante = metricasDesdeLecturas(await getReadings('marcos'), {}, {}, 42);
  assert.equal(tarjeta(otroTripulante, 'hrv').valor, '—');
});

test('las tarjetas vacías no inventan datos y las lecturas futuras no se muestran', () => {
  const vacias = metricasDesdeLecturas([], {}, {}, 42);
  assert.ok(vacias.every((t) => t.valor === '—' && t.estado === 'Sin datos'));
  const datos = [lectura('hr_rest', 65, 41), lectura('hr_rest', 105, 60)];
  assert.equal(tarjeta(metricasDesdeLecturas(datos, {}, {}, 42), 'hr_rest').valor, '65');
  assert.equal(datos.length, 2);
  assert.equal(lecturasParaInicio(datos, 42).length, 1);
});

test('el promedio de sueño usa la última lectura de cada noche de los últimos siete soles', () => {
  const datos = [
    lectura('sleep_h', 10, 35),
    lectura('sleep_h', 6, 40, '2026-10-10T07:00:00.000Z'),
    lectura('sleep_h', 7, 40, '2026-10-10T08:00:00.000Z'),
    lectura('sleep_h', 6, 41),
    lectura('sleep_h', 12, 43),
  ];
  const sueno = tarjeta(metricasDesdeLecturas(datos, {}, {}, 42), 'sleep_h');
  assert.equal(sueno.valor, '6 h 30');
  assert.equal(sueno.detalle, 'Promedio de 2 noches registradas en los últimos 7 soles.');
  assert.equal(sueno.estado, 'Atención');
});

test('el puntaje total refleja cambios guardados y descarta mediciones futuras', async () => {
  await addReading(lectura('hr_rest', 65, 41));
  await addReading(lectura('temp', 36.5, 41));
  await addReading(lectura('temp', 39, 60));
  const inicial = calcularPuntajeSalud(evaluate(await getReadings('ana'), {}, 'mars_base', { sol: 42 }));
  assert.equal(inicial.valor, 100);
  assert.equal(inicial.indicadores, 2);

  await addReading(lectura('temp', 38.1, 42));
  const actualizado = calcularPuntajeSalud(evaluate(await getReadings('ana'), {}, 'mars_base', { sol: 42 }));
  assert.equal(actualizado.valor, 39, 'la fiebre crítica limita el total aunque la frecuencia siga normal');
});

test('el puntaje usa la línea base personal y no asigna puntos a indicadores sin reglas', () => {
  const lecturas = [lectura('hr_rest', 74, 42), lectura('hrv', 34, 42), lectura('mass_kg', 75, 42)];
  const evaluacion = evaluate(lecturas, { hr_rest: 64 }, 'mars_base', { sol: 42 });
  const puntaje = calcularPuntajeSalud(evaluacion);
  assert.equal(puntaje.indicadores, 1);
  assert.equal(puntaje.valor, 67);
  assert.equal(calcularPuntajeSalud({}).valor, null);
  assert.equal(calcularPuntajeSalud(evaluate([lectura('hrv', 80, 42)])).valor, null);
  assert.equal(calcularPuntajeSalud({ indicators: { temp: { indicator: 'temp', value: NaN, level: 'green' } } }).valor, null);
});

test('una alerta compuesta limita el puntaje y ninguna alerta se diluye al promediar vitales normales', () => {
  const registros = [
    ['hr_rest', 65], ['temp', 36.5], ['spo2', 98], ['bp_sys', 118], ['bp_dia', 76],
    ['water_ml', 2200], ['exercise_min', 90], ['sleep_h', 5.5], ['stress', 8],
  ].map(([id, valor]) => lectura(id, valor, 42));
  const evaluacion = evaluate(registros, {}, 'mars_base', {
    sol: 42,
    symptoms: [{ code: 'cold_sore', bodyZone: 'immune', severity: 2, sol: 42 }],
  });
  assert.equal(evaluacion.globalLevel, 'orange');
  assert.equal(calcularPuntajeSalud(evaluacion).valor, 69);

  const atencion = evaluate(registros.filter((r) => r.indicator !== 'sleep_h'), {}, 'mars_base', { sol: 42 });
  assert.equal(atencion.globalLevel, 'yellow');
  assert.equal(calcularPuntajeSalud(atencion).valor, 89);

  const critico = evaluate([lectura('temp', 38.5, 42)], {}, 'mars_base', { sol: 42 });
  assert.equal(calcularPuntajeSalud(critico).valor, 0);
});
