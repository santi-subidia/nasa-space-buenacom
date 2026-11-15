import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { addReading, getReadings, resetDb } from '../lib/db.js';
import { evaluate } from '../lib/motor/evaluar.js';
import { datosSalud } from '../components/salud/datos.js';

beforeEach(async () => { await resetDb(); });
const lectura = (indicator, value, sol, extra = {}) => ({ astronautId: 'ana', indicator, value, sol, ts: `2026-11-${String(sol - 20).padStart(2, '0')}T07:00:00.000Z`, ...extra });
const presentar = (lecturas, sintomas = [], sol = 42) => datosSalud({ lecturas, sintomas, sol, evaluacion: evaluate(lecturas, {}, 'mars_base', { sol, symptoms: sintomas }) });

test('Salud refleja cambios de la base con las unidades originales, sin convertir estrés o reacción a un puntaje ficticio', async () => {
  await addReading(lectura('stress', 7, 41));
  await addReading(lectura('reaction_ms', 314, 41));
  await addReading(lectura('sleep_h', 6.5, 41));
  let datos = presentar(await getReadings('ana'));
  assert.equal(datos.mental.indicadores[0].valor, '7');
  assert.equal(datos.mental.indicadores[0].unidad, '/10');
  assert.equal(datos.mental.indicadores[1].valor, '6 h 30');
  assert.equal(datos.mental.indicadores[2].valor, '314');
  assert.equal(datos.mental.indicadores[2].unidad, 'ms');
  assert.match(datos.mental.indicadores[2].detalle, /Tiempo de reacción/);
  await addReading(lectura('stress', 3, 42));
  datos = presentar(await getReadings('ana'));
  assert.equal(datos.mental.indicadores[0].valor, '3');
  assert.equal(datos.mental.indicadores[0].nivel, 'green');
  assert.equal(datos.mental.indicadores[0].progreso, 0.3);
});

test('sin registros no afirma normalidad ni usa valores de muestra, porcentajes o el dosímetro simulado', () => {
  const datos = presentar([]);
  assert.equal(datos.fisica.nivel, null);
  assert.equal(datos.mental.nivel, null);
  assert.equal(datos.riesgos.nivel, null);
  assert.ok(datos.vitales.every((v) => v.valor === '—'));
  assert.ok(datos.fisica.indicadores.every((v) => v.valor === '—' && v.estado === 'Sin datos'));
  assert.ok(datos.mental.indicadores.every((v) => v.valor === '—' && v.estado === 'Sin datos'));
  assert.ok(datos.historia.every((d) => d.animo === null && d.alertas === null));
  const conMasaCorporal = presentar([lectura('mass_kg', 73, 42)]);
  assert.equal(conMasaCorporal.fisica.indicadores[0].valor, '—', 'la masa corporal no es masa muscular');
});

test('vitales respeta el tripulante, descarta futuros y lee HRV desde la nota guardada', async () => {
  await addReading(lectura('hr_rest', 72, 41, { note: 'HRV 34 ms' }));
  await addReading(lectura('hr_rest', 100, 43));
  await addReading(lectura('hr_rest', 60, 42, { astronautId: 'marcos' }));
  const datos = presentar(await getReadings('ana'));
  assert.equal(datos.vitales[0].valor, '72');
  assert.equal(datos.vitales[4].valor, '34');
  assert.equal(datos.vitales[4].unidad, 'ms');
  assert.equal(datos.vitales[5].estado, 'Sin datos');
  assert.equal(datos.historia.at(-1).alertas, null, 'no inventa un registro del sol 42');
});

test('riesgos y su evolución muestran las alertas del motor existente, incluso en días con sólo síntomas', () => {
  const lecturas = [lectura('mood', 4, 40), lectura('stress', 8, 41), lectura('radiation_msv', 490, 42), lectura('mood', 1, 45)];
  const sintomas = [{ bodyZone: 'immune', code: 'rash', severity: 2, sol: 39, ts: '2026-11-19T07:00:00.000Z' }];
  const datos = presentar(lecturas, sintomas);
  const motor = evaluate(lecturas, {}, 'mars_base', { sol: 42, symptoms: sintomas });
  assert.deepEqual(datos.riesgos.alertas, motor.alerts);
  assert.equal(datos.riesgos.nivel, motor.globalLevel);
  assert.equal(datos.fisica.indicadores[3].valor, '490');
  assert.equal(datos.fisica.estados[3].nivel, 'orange');
  assert.ok(datos.mental.alertas.some((a) => a.ruleId === 'threshold:stress'));
  assert.ok(datos.mental.alertas.every((a) => a.ruleId !== 'threshold:radiation_msv'));
  assert.ok(datos.fisica.alertas.some((a) => a.ruleId === 'threshold:radiation_msv'));
  assert.equal(datos.historia.find((d) => d.sol === 40).animo, 4);
  assert.equal(datos.historia.find((d) => d.sol === 42).animo, null);
  for (const punto of datos.historia.filter((d) => d.alertas != null)) {
    assert.equal(punto.alertas, evaluate(lecturas, {}, 'mars_base', { sol: punto.sol, symptoms: sintomas }).alerts.length);
  }
  assert.notEqual(datos.historia.find((d) => d.sol === 39).alertas, null);
});

test('Salud muestra respiración, músculo, hueso, microgravedad, aislamiento y radiación desde BD', async () => {
  await addReading(lectura('resp_rate', 16, 42));
  await addReading(lectura('muscle_mass_pct', 97.4, 42));
  await addReading(lectura('bone_density_pct', 98.2, 42));
  await addReading(lectura('microgravity_adapt', 86, 42));
  await addReading(lectura('isolation_score', 4, 42));
  const lecturas = await getReadings('ana');
  const datos = datosSalud({
    lecturas,
    sintomas: [],
    sol: 42,
    cabina: [{ sol: 42, radiationTotalMsv: 354.7 }],
    evaluacion: evaluate(lecturas, {}, 'mars_base', { sol: 42 }),
  });

  assert.equal(datos.vitales[5].valor, '16');
  assert.equal(datos.vitales[5].unidad, 'rpm');
  assert.equal(datos.fisica.indicadores[0].valor, '97,4');
  assert.equal(datos.fisica.indicadores[1].valor, '98,2');
  assert.equal(datos.fisica.indicadores[2].valor, '86');
  assert.equal(datos.fisica.indicadores[3].valor, '354,7');
  assert.equal(datos.mental.indicadores[3].valor, '4');
  assert.equal(datos.mental.indicadores[3].nivel, 'yellow');
  assert.equal(datos.riesgos.filas[4].nivel, 'yellow');
});
