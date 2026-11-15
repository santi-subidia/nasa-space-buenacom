import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  UMBRAL_LAPSO_MS,
  calcularMetricasPvt,
  formatearNotaPvt,
  parsearNotaPvt,
} from '../lib/pvt/metricas.js';
import {
  calcularMetricasVor,
  calcularOrientacionCabeza,
  extraerEstadoOcular,
} from '../lib/pvt/vestibular.js';
import { evaluate } from '../lib/motor/evaluar.js';

test('calcularMetricasPvt calcula mediana, media, deciles, lapsos, No-Go, precisión y score combinado', () => {
  const eventos = [
    { tipo: 'ok', rtMs: 240, precisionPct: 92 },
    { tipo: 'ok', rtMs: 260, precisionPct: 88 },
    { tipo: 'ok', rtMs: 280, precisionPct: 80 },
    { tipo: 'ok', rtMs: 410, precisionPct: 70 }, // lapso (>= 355)
    { tipo: 'anticipado' }, // falso inicio
    { tipo: 'nogo_error' }, // impulsividad en baliza roja
    { tipo: 'nogo_ok' }, // evitó baliza roja correctamente
  ];

  const m = calcularMetricasPvt(eventos, {
    baselineMs: 250,
    modoEntrada: 'camara',
    vor: { estabilidadVor: 90, amplitudYawDeg: 32 },
  });

  assert.equal(m.intentos, 4);
  assert.equal(m.falsosInicios, 1);
  assert.equal(m.erroresNoGo, 1);
  assert.equal(m.aciertosNoGo, 1);
  assert.equal(m.lapsos, 1);
  assert.equal(m.medianaMs, 270);
  assert.equal(m.ms, 270);
  assert.equal(m.precisionPct, 83);
  assert.equal(m.estabilidadVor, 90);
  assert.equal(m.amplitudYawDeg, 32);
  assert.equal(m.modoEntrada, 'camara');
  assert.equal(m.deltaBaseMs, 20);
  // totalEventos = 7, errores = 3 (1 lapso + 1 anticipado + 1 nogo) => scorePvt = round(4/7 * 100) = 57
  // score = round(57 * 0.7 + 90 * 0.3) = round(39.9 + 27) = 67
  assert.equal(m.score, 67);
});

test('calcularMetricasPvt maneja lista vacía o solo anticipaciones sin dividir por cero', () => {
  const vacio = calcularMetricasPvt([]);
  assert.equal(vacio.intentos, 0);
  assert.equal(vacio.ms, null);
  assert.equal(vacio.score, null);

  const soloAnticipado = calcularMetricasPvt([{ tipo: 'anticipado' }, { tipo: 'ok', rtMs: 50 }]);
  assert.equal(soloAnticipado.intentos, 0);
  assert.equal(soloAnticipado.falsosInicios, 2);
  assert.equal(soloAnticipado.ms, null);
  assert.equal(soloAnticipado.score, 0);
});

test('formatearNotaPvt y parsearNotaPvt hacen round-trip limpio con campos combinados', () => {
  const m = calcularMetricasPvt(
    [
      { tipo: 'ok', rtMs: 250, precisionPct: 95 },
      { tipo: 'ok', rtMs: UMBRAL_LAPSO_MS, precisionPct: 85 },
      { tipo: 'nogo_ok' },
    ],
    { vor: { estabilidadVor: 84, amplitudYawDeg: 28 }, modoEntrada: 'camara' },
  );
  const nota = formatearNotaPvt(m);
  const parsed = parsearNotaPvt(nota);

  assert.ok(parsed);
  assert.equal(parsed.tipo, 'pvt');
  assert.equal(parsed.modoEntrada, 'camara');
  assert.equal(parsed.estabilidadVor, 84);
  assert.equal(parsed.precisionPct, 90);
  assert.equal(parsed.lapsos, 1);
  assert.equal(parsearNotaPvt('texto cualquiera'), null);
});

test('vestibular.js calcula orientación de cabeza, estado ocular y estabilidad VOR', () => {
  const lm = Array.from({ length: 270 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  lm[33] = { x: 0.4, y: 0.4, z: 0 };
  lm[263] = { x: 0.6, y: 0.4, z: 0 };
  lm[10] = { x: 0.5, y: 0.2, z: 0 };
  lm[152] = { x: 0.5, y: 0.8, z: 0 };
  lm[1] = { x: 0.46, y: 0.52, z: 0 }; // giro positivo

  const ori = calcularOrientacionCabeza(lm);
  assert.ok(ori && ori.yawDeg > 15);

  const ojo = extraerEstadoOcular([
    {
      categories: [
        { categoryName: 'eyeBlinkLeft', score: 0.1 },
        { categoryName: 'eyeBlinkRight', score: 0.1 },
        { categoryName: 'eyeLookOutLeft', score: 0.4 },
        { categoryName: 'eyeLookInRight', score: 0.4 },
      ],
    },
  ]);
  assert.equal(ojo.ojosAbiertos, true);
  assert.ok(ojo.miradaHoriz < 0);

  const vorBueno = calcularMetricasVor([
    { tMs: 0, yawDeg: -16, objetivoYawDeg: -18, ojosAbiertos: true },
    { tMs: 250, yawDeg: 0, objetivoYawDeg: 0, ojosAbiertos: true },
    { tMs: 500, yawDeg: 17, objetivoYawDeg: 18, ojosAbiertos: true },
    { tMs: 750, yawDeg: 19, objetivoYawDeg: 18, ojosAbiertos: true },
  ]);
  assert.ok(vorBueno.estabilidadVor >= 85);
  assert.equal(vorBueno.amplitudYawDeg, 35);

  const vorQuieto = calcularMetricasVor([
    { tMs: 0, yawDeg: 0, objetivoYawDeg: -18, ojosAbiertos: false },
    { tMs: 250, yawDeg: 1, objetivoYawDeg: 18, ojosAbiertos: false },
    { tMs: 500, yawDeg: 0, objetivoYawDeg: -18, ojosAbiertos: false },
  ]);
  assert.ok(vorQuieto.estabilidadVor < 50);
});

test('evaluate dispara pvt_cognitive_fatigue y vestibular_instability según métricas combinadas', () => {
  const m = calcularMetricasPvt(
    [
      { tipo: 'ok', rtMs: 320 },
      { tipo: 'ok', rtMs: 380 },
      { tipo: 'ok', rtMs: 410 },
      { tipo: 'ok', rtMs: 430 },
    ],
    { vor: { estabilidadVor: 45, amplitudYawDeg: 10 }, modoEntrada: 'camara' },
  );
  const res = evaluate(
    [
      { indicator: 'sleep_h', value: 5, sol: 10 },
      { indicator: 'reaction_ms', value: m.medianaMs, note: formatearNotaPvt(m), sol: 10 },
    ],
    { reaction_ms: 245 },
    'mars_base',
    { sol: 10 },
  );
  assert.ok(res.alerts.some((a) => a.ruleId === 'pvt_cognitive_fatigue'));
  const vorAlerta = res.alerts.find((a) => a.ruleId === 'vestibular_instability');
  assert.ok(vorAlerta);
  assert.equal(vorAlerta.zone, 'inner_ear');
  assert.equal(vorAlerta.level, 'yellow');
});
