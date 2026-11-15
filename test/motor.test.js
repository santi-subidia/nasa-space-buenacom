import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluarIndicador, evaluate, mergeLevel } from '../lib/motor/evaluar.js';
import { DEMO_DATA } from '../lib/demo/sembrar.js';

test('umbrales individuales y diferencia respecto a la línea base (hr_rest +10)', () => {
  assert.equal(evaluarIndicador('temp', 36.7).level, 'green');
  assert.equal(evaluarIndicador('temp', 37.6).level, 'yellow');
  assert.equal(evaluarIndicador('temp', 38.2).level, 'red');

  assert.equal(evaluarIndicador('spo2', 98).level, 'green');
  assert.equal(evaluarIndicador('spo2', 93).level, 'yellow');
  assert.equal(evaluarIndicador('spo2', 88).level, 'red');

  assert.equal(evaluarIndicador('water_ml', 2100).level, 'green');
  assert.equal(evaluarIndicador('water_ml', 1400).level, 'orange');

  assert.equal(evaluarIndicador('exercise_min', 90).level, 'green');
  assert.equal(evaluarIndicador('exercise_min', 40).level, 'yellow');

  // 74 lpm es verde absoluto (50-90), pero +10 sobre la base 64 dispara atención amarilla.
  const hr = evaluarIndicador('hr_rest', 74, { hr_rest: 64 });
  assert.equal(hr.thresholdLevel, 'green');
  assert.equal(hr.baselineLevel, 'yellow');
  assert.equal(hr.level, 'yellow');
  assert.equal(hr.baselineDiff, 10);

  const r = evaluate(
    [{ indicator: 'hr_rest', value: 74, sol: 10 }],
    { hr_rest: 64 },
    'mars_base',
  );
  assert.equal(r.indicatorLevels.hr_rest, 'yellow');
  assert.equal(r.zoneLevels.heart, 'yellow');
  assert.equal(r.globalLevel, 'yellow');
  assert.ok(r.alerts.some((a) => a.ruleId === 'threshold:hr_rest' && a.why && a.actions.length && a.nasaSource));
});

test('con los datos del sol 41 sale "Posible reactivación viral" en naranja en la zona inmune', () => {
  const ana = DEMO_DATA.astronauts.find((a) => a.id === 'ana');
  const readings = DEMO_DATA.readings.filter((r) => r.astronautId === 'ana');
  const symptoms = DEMO_DATA.symptoms.filter((s) => s.astronautId === 'ana');

  const sol41 = evaluate(readings, ana.baseline, 'mars_base', { symptoms, sol: 41 });
  assert.equal(sol41.globalLevel, 'orange');
  assert.equal(sol41.zoneLevels.immune, 'orange');
  const viral = sol41.alerts.find((a) => a.ruleId === 'viral_reactivation');
  assert.ok(viral);
  assert.equal(viral.title, 'Posible reactivación viral');
  assert.equal(viral.level, 'orange');
  assert.equal(viral.zone, 'immune');
  assert.equal(viral.escalate, 'cmo');
  assert.ok(viral.why.length > 0);
  assert.ok(viral.actions.length > 0);
  assert.match(viral.nasaSource, /immune/i);
});

test('reglas compuestas adicionales: mareo pre-aterrizaje y trombo yugular', () => {
  const ortostatico = evaluate(
    [
      { indicator: 'bp_sys', value: 122, sol: 1 },
      { indicator: 'bp_sys', value: 118, sol: 3 },
      { indicator: 'bp_sys', value: 110, sol: 5 },
      { indicator: 'water_ml', value: 1200, sol: 4 },
      { indicator: 'water_ml', value: 1100, sol: 5 },
    ],
    { bp_sys: 120 },
    'mars_base',
    { sol: 5, missionEvents: [{ type: 'landing', withinHours: 48 }] },
  );
  assert.equal(ortostatico.zoneLevels.heart, 'yellow');
  assert.ok(ortostatico.alerts.some((a) => a.ruleId === 'orthostatic_pre_landing'));

  const trombo = evaluate(
    [{ indicator: 'bp_sys', value: 118, sol: 1 }],
    { bp_sys: 118 },
    'mars_base',
    {
      sol: 1,
      symptoms: [{ astronautId: 'ana', bodyZone: 'heart', code: 'neck_swelling', severity: 3, sol: 1 }],
    },
  );
  assert.equal(trombo.globalLevel, 'red');
  assert.equal(trombo.zoneLevels.heart, 'red');
  const vte = trombo.alerts.find((a) => a.ruleId === 'jugular_vte');
  assert.ok(vte);
  assert.equal(vte.escalate, 'flight_surgeon');
  assert.deepEqual(vte.alsoNotify, ['cmo']);
  assert.deepEqual(vte.commDelayMin, [4, 20]);
});

test('toda regla compuesta que dispara el motor está definida en rules.json', async () => {
  const fuente = await import('node:fs').then((fs) => fs.readFileSync(new URL('../lib/motor/evaluar.js', import.meta.url), 'utf8'));
  const usadas = [...fuente.matchAll(/defs\.(\w+)/g)].map((m) => m[1]);
  const definidas = new Set((await import('../lib/motor/rules.json', { with: { type: 'json' } })).default.composite.map((r) => r.id));
  for (const id of usadas) assert.ok(definidas.has(id), `Falta "${id}" en rules.json`);
});

test('déficit de ejercicio: promedio semanal < 45 min (50 % del plan) da amarillo en músculos sin romper el motor', () => {
  const bajo = evaluate(
    [1, 2, 3, 4, 5, 6, 7].map((sol) => ({ indicator: 'exercise_min', value: 30, sol })),
    {},
    'mars_base',
    { sol: 7 },
  );
  const alerta = bajo.alerts.find((a) => a.ruleId === 'exercise_deficit_week');
  assert.ok(alerta);
  assert.equal(alerta.level, 'yellow');
  assert.equal(alerta.zone, 'muscles');
  assert.equal(alerta.escalate, 'self');
  assert.match(alerta.why, /30 min\/día/);

  const cumple = evaluate(
    [1, 2, 3, 4, 5, 6, 7].map((sol) => ({ indicator: 'exercise_min', value: 80, sol })),
    {},
    'mars_base',
    { sol: 7 },
  );
  assert.ok(!cumple.alerts.some((a) => a.ruleId === 'exercise_deficit_week'));
});

test('SANS: visión borrosa + agudeza 10 puntos peor que la base da naranja en ojos y avisa al oficial médico', () => {
  const borrosa = [{ astronautId: 'ana', bodyZone: 'eyes', code: 'blurred_vision', severity: 2, sol: 10 }];
  const sans = evaluate([{ indicator: 'visual_acuity', value: 80, sol: 10 }], { visual_acuity: 92 }, 'mars_base', {
    sol: 10,
    symptoms: borrosa,
  });
  const alerta = sans.alerts.find((a) => a.ruleId === 'sans_visual_change');
  assert.ok(alerta);
  assert.equal(alerta.level, 'orange');
  assert.equal(alerta.escalate, 'cmo');
  assert.equal(sans.zoneLevels.eyes, 'orange');
  assert.match(alerta.why, /-12 respecto a tu base de 92/);

  // Sin síntoma no dispara la compuesta (queda el aviso por línea base).
  const sinSintoma = evaluate([{ indicator: 'visual_acuity', value: 80, sol: 10 }], { visual_acuity: 92 }, 'mars_base', { sol: 10 });
  assert.ok(!sinSintoma.alerts.some((a) => a.ruleId === 'sans_visual_change'));

  // Con síntoma pero agudeza igual a la base, tampoco.
  const estable = evaluate([{ indicator: 'visual_acuity', value: 90, sol: 10 }], { visual_acuity: 92 }, 'mars_base', {
    sol: 10,
    symptoms: borrosa,
  });
  assert.ok(!estable.alerts.some((a) => a.ruleId === 'sans_visual_change'));

  // Sin línea base, usa el piso del rango verde (80).
  const sinBase = evaluate([{ indicator: 'visual_acuity', value: 70, sol: 10 }], {}, 'mars_base', { sol: 10, symptoms: borrosa });
  assert.ok(sinBase.alerts.some((a) => a.ruleId === 'sans_visual_change'));
});

test('mergeLevel: la IA puede subir el nivel, nunca bajarlo', () => {
  assert.equal(mergeLevel('orange', 'yellow'), 'orange');
  assert.equal(mergeLevel('orange', 'green'), 'orange');
  assert.equal(mergeLevel('orange', 'orange'), 'orange');
  assert.equal(mergeLevel('orange', 'red'), 'red');
  assert.equal(mergeLevel('green', 'yellow'), 'yellow');
  assert.equal(mergeLevel('red', undefined), 'red');
  assert.throws(() => mergeLevel('orange', 'morado'), /Nivel desconocido/);
});

test('toda regla de rules.json declara el origen de su umbral (basis) y la alerta lo expone', async () => {
  const reglas = (await import('../lib/motor/rules.json', { with: { type: 'json' } })).default;
  const TIPOS = new Set(['nasa', 'nasa_derived', 'external', 'design']);
  const todas = [
    ...Object.entries(reglas.thresholds).map(([id, r]) => [`thresholds.${id}`, r]),
    ...Object.entries(reglas.baselineDelta).map(([id, r]) => [`baselineDelta.${id}`, r]),
    ...reglas.composite.map((r) => [`composite.${r.id}`, r]),
  ];
  for (const [id, r] of todas) {
    assert.ok(TIPOS.has(r.basis?.type), `${id}: basis.type inválido`);
    assert.ok(r.basis.ref, `${id}: falta basis.ref`);
    if (r.basis.url) assert.match(r.basis.url, /^https:\/\//, `${id}: basis.url debe ser https`);
  }

  // Un umbral clínico no debe presentarse como cifra NASA.
  assert.equal(reglas.thresholds.bp_sys.basis.type, 'external');
  assert.equal(reglas.thresholds.co2_mmhg.basis.type, 'nasa');

  const r = evaluate([{ indicator: 'temp', value: 38.4, sol: 10 }], {}, 'mars_base');
  const alerta = r.alerts.find((a) => a.ruleId === 'threshold:temp');
  assert.equal(alerta.basis.type, 'external');
  assert.equal(r.indicators.temp.basis.type, 'external');

  // Si dispara la línea base, el origen es el del delta, no el del umbral absoluto.
  const porBase = evaluate([{ indicator: 'hr_rest', value: 74, sol: 10 }], { hr_rest: 64 }, 'mars_base');
  assert.equal(porBase.alerts.find((a) => a.ruleId === 'threshold:hr_rest').basis.type, 'design');
});
