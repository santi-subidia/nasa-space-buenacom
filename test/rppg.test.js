import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  calcularCajasRoi,
  estimarPulsoRppg,
  extraerSenalPos,
  filtrarPasaBanda,
  remuestrearUniforme,
} from '../lib/cara/rppg.js';

function generarMuestrasRppg({ bpm, duracionMs = 14_000, fps = 25, jitter = true, ruido = 0.08, movimientoComun = 1.5, motion = 0.003 }) {
  const f = bpm / 60;
  const muestras = [];
  let t = 0;
  let k = 0;
  while (t <= duracionMs) {
    const s = t / 1000;
    const pulso = Math.sin(2 * Math.PI * f * s);
    // Componente común de brillo / movimiento que afecta proporcionalmente a los tres canales (debe cancelarse en POS)
    const deriva = movimientoComun * Math.sin(2 * Math.PI * 0.25 * s) + (k % 7) * 0.03 * ruido;
    // La absorción hemoglobina es mayor en G, menor en B y muy leve en R
    const r = 175 * (1 + 0.002 * pulso + 0.01 * deriva);
    const g = 135 * (1 + 0.012 * pulso + 0.01 * deriva + ruido * 0.004 * Math.sin(k * 1.9));
    const b = 115 * (1 + 0.004 * pulso + 0.01 * deriva);

    muestras.push({ t, r, g, b, motion });
    const pasoBase = 1000 / fps;
    const delta = jitter ? pasoBase * (0.8 + 0.4 * ((k % 3) / 2)) : pasoBase;
    t += delta;
    k += 1;
  }
  return muestras;
}

test('calcularCajasRoi devuelve cajas válidas dentro del frame desde landmarks normalizados', () => {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (idx, x, y) => { landmarks[idx] = { x, y, z: 0 }; };

  // Frente baja / glabela
  set(107, 0.44, 0.30);
  set(336, 0.56, 0.30);
  set(151, 0.50, 0.26);
  set(9, 0.50, 0.33);

  // Mejilla izq
  set(50, 0.35, 0.50);
  set(101, 0.42, 0.50);
  set(118, 0.37, 0.46);
  set(123, 0.33, 0.53);
  set(205, 0.40, 0.56);

  // Mejilla der
  set(280, 0.65, 0.50);
  set(330, 0.58, 0.50);
  set(347, 0.63, 0.46);
  set(352, 0.67, 0.53);
  set(425, 0.60, 0.56);

  set(1, 0.50, 0.52);
  set(33, 0.41, 0.41);
  set(263, 0.59, 0.41);

  const info = calcularCajasRoi(landmarks, 960, 540);
  assert.ok(info);
  assert.equal(info.cajas.length, 3);
  for (const c of info.cajas) {
    assert.ok(c.sx >= 0 && c.sy >= 0);
    assert.ok(c.sx + c.sw <= 960);
    assert.ok(c.sy + c.sh <= 540);
    assert.ok(c.sw >= 4 && c.sh >= 4);
  }
  assert.ok(info.centro && info.centro.escala > 0.15);
});

test('estimarPulsoRppg requiere mínimo 8 segundos antes de estimar', () => {
  const cortas = generarMuestrasRppg({ bpm: 72, duracionMs: 5_000 });
  const res = estimarPulsoRppg(cortas);
  assert.equal(res.listo, false);
  assert.equal(res.bpm, null);
  assert.equal(res.motivo, 'poca_duracion');
});

test('estimarPulsoRppg recupera 54, 72 y 110 lpm con FPS variable y deriva de brillo', () => {
  for (const objetivo of [54, 72, 110]) {
    const muestras = generarMuestrasRppg({ bpm: objetivo, duracionMs: 14_000, fps: 24, jitter: true });
    const res = estimarPulsoRppg(muestras);
    assert.equal(res.listo, true);
    assert.ok(res.bpm !== null, `Se esperaba BPM para ${objetivo}`);
    assert.ok(Math.abs(res.bpm - objetivo) <= 2, `Objetivo ${objetivo} lpm, obtenido ${res.bpm} lpm`);
    assert.notEqual(res.confianza, 'baja');
    assert.ok(res.onda.length > 30);
  }
});

test('estimarPulsoRppg rechaza ruido puro y movimiento excesivo sin inventar BPM', () => {
  // Ruido pseudoaleatorio determinista sin componente cardíaca
  const ruido = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let t = 0; t <= 12_000; t += 33) {
    ruido.push({
      t,
      r: 140 + (rand() - 0.5) * 20,
      g: 120 + (rand() - 0.5) * 20,
      b: 100 + (rand() - 0.5) * 20,
      motion: 0.002,
    });
  }
  const resRuido = estimarPulsoRppg(ruido);
  assert.equal(resRuido.confianza, 'baja');
  assert.equal(resRuido.bpm, null);

  const movido = generarMuestrasRppg({ bpm: 72, motion: 0.05 });
  const resMov = estimarPulsoRppg(movido);
  assert.equal(resMov.confianza, 'baja');
  assert.equal(resMov.bpm, null);
  assert.equal(resMov.motivo, 'mucho_movimiento');
});

test('estimarPulsoRppg recupera pulso bajo luz cálida con canal azul muy bajo (B < 6)', () => {
  const muestras = [];
  const f = 76 / 60;
  for (let t = 0; t <= 14_000; t += 40) {
    const s = t / 1000;
    const pulso = Math.sin(2 * Math.PI * f * s);
    const deriva = Math.sin(2 * Math.PI * 0.2 * s);
    muestras.push({
      t,
      r: 95 * (1 + 0.002 * pulso + 0.015 * deriva),
      g: 55 * (1 + 0.012 * pulso + 0.015 * deriva),
      b: 3 * (1 + 0.004 * pulso + 0.015 * deriva),
      motion: 0.002,
    });
  }
  const res = estimarPulsoRppg(muestras);
  assert.equal(res.listo, true);
  assert.ok(res.bpm !== null && Math.abs(res.bpm - 76) <= 2, `Esperado ~76 lpm, obtenido ${res.bpm}`);
  assert.ok(res.onda.some((v) => Math.abs(v) > 0.1));
});

test('remuestrearUniforme, extraerSenalPos y filtrarPasaBanda preservan longitud y fase estable', () => {
  const muestras = generarMuestrasRppg({ bpm: 68, duracionMs: 10_000, fps: 20, jitter: true });
  const uni = remuestrearUniforme(muestras, 30);
  assert.ok(uni && uni.r.length >= 290);
  const pos = extraerSenalPos(uni);
  const filt = filtrarPasaBanda(pos, 30);
  assert.equal(filt.length, uni.r.length);
  assert.ok(filt.every((v) => Number.isFinite(v)));
});
