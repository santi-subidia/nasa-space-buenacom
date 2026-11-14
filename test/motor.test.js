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

test('mergeLevel: la IA puede subir el nivel, nunca bajarlo', () => {
  assert.equal(mergeLevel('orange', 'yellow'), 'orange');
  assert.equal(mergeLevel('orange', 'green'), 'orange');
  assert.equal(mergeLevel('orange', 'orange'), 'orange');
  assert.equal(mergeLevel('orange', 'red'), 'red');
  assert.equal(mergeLevel('green', 'yellow'), 'yellow');
  assert.equal(mergeLevel('red', undefined), 'red');
  assert.throws(() => mergeLevel('orange', 'morado'), /Nivel desconocido/);
});
