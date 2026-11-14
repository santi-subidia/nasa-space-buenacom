import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LIMITE_CARRERA_MSV,
  atmosferaDelSol,
  co2Promedio7,
  dosisAcumulada,
  panelCabina,
} from '../lib/cabina/simulador.js';
import { evaluarIndicador, evaluate } from '../lib/motor/evaluar.js';
import { DEMO_DATA } from '../lib/demo/sembrar.js';

test('umbrales de radiación alineados al límite de carrera de 600 mSv (NASA-STD-3001)', () => {
  assert.equal(LIMITE_CARRERA_MSV, 600);
  assert.equal(evaluarIndicador('radiation_msv', 250).level, 'green');
  assert.equal(evaluarIndicador('radiation_msv', 350).level, 'yellow');
  assert.equal(evaluarIndicador('radiation_msv', 550).level, 'orange');
  assert.equal(evaluarIndicador('radiation_msv', 600).level, 'red');
});

test('dosímetro: tránsito de 180 días a 1,8 mSv/día + superficie, con proyección al regreso', () => {
  const ana = dosisAcumulada(42, 'ana');
  assert.equal(ana.transito, 324);
  assert.ok(ana.total > 350 && ana.total < 360, `total ${ana.total}`);
  assert.equal(ana.nivel, 'yellow');
  assert.equal(ana.pctLimite, Math.round((ana.total / 600) * 100));
  assert.ok(ana.proyeccionRegreso > 600, 'una misión a Marte completa supera el límite');
  assert.ok(dosisAcumulada(42, 'marcos').total < ana.total, 'Ana hace más EVA que Marcos');
  assert.ok(dosisAcumulada(43, 'ana').total > ana.total, 'la dosis solo crece');
});

test('atmósfera determinista por sol; el CO₂ supera el objetivo de 2,5 mmHg cerca del sol 42', () => {
  assert.deepEqual(atmosferaDelSol(42), atmosferaDelSol(42));
  assert.ok(atmosferaDelSol(42).co2 > 2.5);
  assert.ok(atmosferaDelSol(20).co2 < 2.5);
  assert.ok(co2Promedio7(42) < 3, 'nunca pasa el límite operativo en la demo');

  const p42 = panelCabina({ sol: 42 });
  assert.equal(p42.atmosfera.find((a) => a.id === 'co2').nivel, 'yellow');
  assert.ok(p42.alertas.some((a) => a.id === 'co2'));
  assert.ok(!panelCabina({ sol: 20 }).alertas.some((a) => a.id === 'co2'));
});

test('tormenta solar: alerta roja fuera del refugio y naranja adentro, con menor tasa', () => {
  const afuera = panelCabina({ sol: 42, tormenta: true });
  const adentro = panelCabina({ sol: 42, tormenta: true, enRefugio: true });
  assert.equal(afuera.nivel, 'red');
  assert.equal(afuera.alertas[0].id, 'spe');
  assert.equal(adentro.alertas[0].nivel, 'orange');
  assert.ok(adentro.tasaActualMSvH < afuera.tasaActualMSvH);
  assert.ok(!panelCabina({ sol: 42 }).alertas.some((a) => a.id === 'spe'));
});

test('la cabina no cambia el semáforo personal del tripulante (riesgo ambiental aparte)', () => {
  const marcos = DEMO_DATA.astronauts.find((a) => a.id === 'marcos');
  const lecturas = DEMO_DATA.readings.filter((r) => r.astronautId === 'marcos');
  assert.equal(evaluate(lecturas, marcos.baseline, 'mars_base', { sol: 42 }).globalLevel, 'green');
});
