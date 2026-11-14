import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angulo, crearEntrenamiento } from '../lib/entrenador/ejercicios.js';
import { armarPayloadSerie } from '../lib/entrenador/resumen.js';

// Esqueleto de perfil, con la rodilla flexionada `grados`. Cadera fija, tobillo en el suelo.
function sentadillaConRodilla(grados, { tronco = 0 } = {}) {
  const muslo = 0.25;
  const rad = (grados * Math.PI) / 180;
  const d = 2 * muslo * Math.sin(rad / 2); // distancia cadera–tobillo
  const cadera = { x: 0.5, y: 0.45 };
  const tobillo = { x: 0.5, y: 0.45 + d };
  const rodilla = { x: 0.5 + Math.sqrt(Math.max(0, muslo ** 2 - (d / 2) ** 2)), y: 0.45 + d / 2 };
  const hombro = { x: 0.5 + tronco, y: 0.25 };
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  for (const lado of [{ h: 11, c: 23, r: 25, t: 27 }, { h: 12, c: 24, r: 26, t: 28 }]) {
    lm[lado.h] = { ...hombro, visibility: 1 };
    lm[lado.c] = { ...cadera, visibility: 1 };
    lm[lado.r] = { ...rodilla, visibility: 1 };
    lm[lado.t] = { ...tobillo, visibility: 1 };
  }
  return lm;
}

function hacer(entrenamiento, angulos, extra) {
  let t = 0;
  let estado;
  for (const g of angulos) {
    estado = entrenamiento.procesar(sentadillaConRodilla(g, extra), { t });
    t += 100;
  }
  return estado;
}

// Baja y sube de forma gradual entre dos ángulos.
const rampa = (de, a, pasos = 12) => Array.from({ length: pasos }, (_, i) => de + ((a - de) * (i + 1)) / pasos);
const repeticion = (profundidad) => [...rampa(170, profundidad), ...rampa(profundidad, 170)];

test('angulo: recto y en L', () => {
  assert.ok(Math.abs(angulo({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }) - 180) < 1e-9);
  assert.ok(Math.abs(angulo({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }) - 90) < 1e-9);
});

test('cuenta 10 sentadillas completas', () => {
  const e = crearEntrenamiento('sentadilla');
  const secuencia = [170, 170, ...Array.from({ length: 10 }, () => repeticion(85)).flat()];
  assert.equal(hacer(e, secuencia).reps, 10);
});

test('una sentadilla a medias no cuenta y dice "Bajá más"', () => {
  const e = crearEntrenamiento('sentadilla');
  const estado = hacer(e, [170, 170, ...repeticion(125)]);
  assert.equal(estado.reps, 0);
  assert.equal(e.resumen().correcciones.find((c) => c.texto === 'Bajá más.')?.veces, 1);
});

test('corrige el torso inclinado al bajar', () => {
  const e = crearEntrenamiento('sentadilla');
  hacer(e, [170, 170, ...rampa(170, 90)], { tronco: 0.3 });
  assert.ok(e.resumen().correcciones.some((c) => c.texto.includes('espalda recta')));
});

test('sin cuerpo a la vista no cuenta ni cambia de fase', () => {
  const e = crearEntrenamiento('sentadilla');
  const oculto = sentadillaConRodilla(170).map((p) => ({ ...p, visibility: 0.1 }));
  const estado = e.procesar(oculto, { t: 0 });
  assert.equal(estado.valido, false);
  assert.equal(estado.reps, 0);
});

test('plancha: suma segundos con el cuerpo en línea y corrige cuando la cadera cae', () => {
  const e = crearEntrenamiento('plancha');
  const cuerpo = (caida) => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
    for (const [h, c, t] of [[11, 23, 27], [12, 24, 28]]) {
      lm[h] = { x: 0.2, y: 0.5, visibility: 1 };
      lm[c] = { x: 0.5, y: 0.5 + caida, visibility: 1 };
      lm[t] = { x: 0.8, y: 0.5, visibility: 1 };
    }
    return lm;
  };
  let estado;
  for (let i = 0; i <= 30; i++) estado = e.procesar(cuerpo(0), { t: i * 100 }); // 3 s en línea
  assert.equal(estado.segundos, 3);
  estado = e.procesar(cuerpo(0.08), { t: 3200 });
  assert.equal(estado.correccion, 'Subí la cadera, espalda recta.');
  assert.equal(estado.segundos, 3);
});

test('armarPayloadSerie: resume las series, limita a 3 fotos e incluye el estado de salud', () => {
  const fotos = [1, 2, 3, 4].map((i) => ({ media_type: 'image/jpeg', data: `FOTO${i}` }));
  const payload = armarPayloadSerie({
    series: [
      { ejercicio: 'sentadilla', reps: 10, segundos: 0, correcciones: [{ texto: 'Bajá más.', veces: 2 }] },
      { ejercicio: 'plancha', reps: 0, segundos: 25, correcciones: [] },
    ],
    ejercicioActual: 'plancha',
    minutos: 2.5,
    anguloMin: 86,
    fotos,
    vals: { temp: { valor: 37.6 }, sleep_h: { valor: 5.5 }, hr_rest: { valor: 74 } },
    nivelMotor: 'orange',
    alertaTitulo: 'Posible reactivación viral',
  });
  assert.equal(payload.ejercicio, 'plancha');
  assert.equal(payload.fotos.length, 3);
  assert.equal(payload.metricas.repeticiones, 10);
  assert.equal(payload.metricas.tiempoPlanchaSeg, 25);
  assert.equal(payload.metricas.correccionesEnVivo, 2);
  assert.equal(payload.metricas.anguloMinimo, 86);
  assert.equal(payload.metricas.series.length, 2);
  assert.equal(payload.estado.nivelMotor, 'orange');
  assert.match(payload.estado.resumen, /37,6 °C/);
  assert.match(payload.estado.resumen, /Posible reactivación viral/);
});
