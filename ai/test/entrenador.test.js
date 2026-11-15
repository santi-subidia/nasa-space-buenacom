import assert from 'node:assert/strict';
import { test } from 'node:test';

import Anthropic from '@anthropic-ai/sdk';

import { crearAlmacenEnMemoria } from '../almacen.js';
import { consultarClaude } from '../claude.js';
import { comentarioLocal, limitarPlan, PLAN_NORMAL } from '../entrenador/plan.js';
import { crearComentarioDeSerie } from '../entrenador/serie.js';
import { crearManejador } from '../route.js';
import { construirTarea, ErrorDePeticion } from '../tareas.js';

const FOTO = { media_type: 'image/jpeg', data: 'AAAABBBB' };
const SERIE = {
  ejercicio: 'sentadilla',
  metricas: { repeticiones: 12, anguloRodillaMin: 88, correccionesEnVivo: 2 },
  fotos: [FOTO, FOTO],
  estado: { nivelMotor: 'orange', resumen: 'Febrícula de 37,6 °C y herpes labial; sueño de 5,3 h.' },
};

// ---------- el techo del estado de salud ----------

test('limitarPlan: el nivel del motor pone el techo y la IA solo puede bajar la carga', () => {
  assert.deepEqual(limitarPlan({ minutos: 90, intensidad: 'normal', motivo: 'ok' }, 'green'), { minutos: 90, intensidad: 'normal', motivo: 'ok', limitadoPorMotor: false });
  assert.equal(limitarPlan({ minutos: 90, intensidad: 'normal' }, 'yellow').intensidad, 'moderada');
  assert.equal(limitarPlan({ minutos: 90, intensidad: 'normal' }, 'yellow').minutos, 60);
  const naranja = limitarPlan({ minutos: 90, intensidad: 'normal' }, 'orange');
  assert.deepEqual([naranja.intensidad, naranja.minutos, naranja.limitadoPorMotor], ['liviana', 30, true]);
  const rojo = limitarPlan({ minutos: 45, intensidad: 'moderada' }, 'red');
  assert.deepEqual([rojo.intensidad, rojo.minutos], ['reposo', 0]);
  // la IA baja más que el techo: se respeta lo que bajó
  const ia = limitarPlan({ minutos: 20, intensidad: 'liviana', motivo: 'Tenés febrícula, hoy 20 min livianos' }, 'orange');
  assert.deepEqual([ia.intensidad, ia.minutos, ia.limitadoPorMotor, ia.motivo], ['liviana', 20, false, 'Tenés febrícula, hoy 20 min livianos']);
  // la IA nunca puede pasar los minutos del plan actual
  assert.equal(limitarPlan({ minutos: 200, intensidad: 'normal' }, 'green', { minutos: 90, intensidad: 'normal' }).minutos, 90);
});

test('limitarPlan sin propuesta de la IA parte del plan actual; rechaza niveles desconocidos', () => {
  assert.equal(limitarPlan(null, 'orange').minutos, 30);
  assert.equal(limitarPlan({ minutos: 10, intensidad: 'extrema' }, 'green').intensidad, 'normal'); // intensidad inválida → plan actual
  assert.throws(() => limitarPlan(null, 'morado'), /Unknown level/);
});

test('comentarioLocal usa las métricas y refleja el ajuste', () => {
  const orange = limitarPlan(null, 'orange');
  assert.equal(comentarioLocal(SERIE, orange), 'You finished 12 reps of squats. Based on your status today, keep going with 30 light minutes.');
  assert.match(comentarioLocal({ ejercicio: 'plancha', metricas: { tiempoPlanchaSeg: 45 } }, limitarPlan(null, 'green')), /45 seconds of plank/);
  assert.match(comentarioLocal(SERIE, limitarPlan(null, 'red')), /rest/i);
});

// ---------- la tarea ----------

test('tarea exercise: fotos antes del texto, esfuerzo low, esquema y estado de salud en el prompt', () => {
  const t = construirTarea({ tipo: 'exercise', ...SERIE });
  assert.equal(t.kind, 'exercise');
  assert.equal(t.esfuerzo, 'low');
  assert.equal(t.imagenes.length, 2);
  assert.equal(t.formato.required.join(), 'comentario,correccion,plan');
  assert.match(t.variable, /rule engine level: orange/);
  assert.match(t.variable, /repeticiones: 12/);
  assert.match(t.variable, /Key set photos: 2/);
  assert.doesNotMatch(JSON.stringify(t.entrada), /AAAA/); // las fotos no entran en la clave
});

test('tarea exercise rechaza fotos, métricas y estados inválidos', () => {
  const malos = [
    { ...SERIE, fotos: [FOTO, FOTO, FOTO, FOTO] },
    { ...SERIE, fotos: [{ media_type: 'image/gif', data: 'AAAA' }] },
    { ...SERIE, fotos: [{ media_type: 'image/png', data: 'esto no es base64!' }] },
    { ...SERIE, metricas: {} },
    { ...SERIE, metricas: 'mucho' },
    { ...SERIE, estado: { nivelMotor: 'morado' } },
    { ...SERIE, ejercicio: '' },
    { ...SERIE, planActual: { minutos: 'x', intensidad: 'normal' } },
  ];
  for (const malo of malos) assert.throws(() => construirTarea({ tipo: 'exercise', ...malo }), ErrorDePeticion);
});

// ---------- de punta a punta con un cliente simulado ----------

const clienteDevolviendo = (json) => {
  const pedidos = [];
  return {
    pedidos,
    messages: { create: async (p) => { pedidos.push(p); return { model: 'claude-haiku-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 1500, output_tokens: 90 } }; } },
  };
};

const pedir = (cliente, almacen, cuerpo = { tipo: 'exercise', ...SERIE }) =>
  crearManejador({ consultar: (p) => consultarClaude(p, { cliente, almacen, env: { ANTHROPIC_API_KEY: 'x' } }) })(
    new Request('http://x/api/claude', { method: 'POST', body: JSON.stringify(cuerpo) }),
  ).then((r) => r.json());

test('POST exercise: comenta la técnica, manda las fotos y adapta el plan al estado del sol 42', async () => {
  const cliente = clienteDevolviendo({
    comentario: 'Muy bien, doce repeticiones. Al subir, mantené la espalda recta. Tenés febrícula: hoy 20 minutos livianos.',
    correccion: 'Mantené la espalda recta al subir.',
    plan: { minutos: 20, intensidad: 'liviana', motivo: 'Tenés febrícula, hoy 20 min livianos.' },
  });
  const r = await pedir(cliente, crearAlmacenEnMemoria());
  assert.equal(r.origen, 'claude');
  assert.equal(r.comentarioDeIA, true);
  assert.match(r.comentario, /espalda recta/);
  assert.deepEqual([r.plan.minutos, r.plan.intensidad], [20, 'liviana']);
  const contenido = cliente.pedidos[0].messages[0].content;
  assert.deepEqual(contenido.map((b) => b.type), ['image', 'image', 'text']);
  assert.equal(cliente.pedidos[0].output_config.effort, 'low');
});

test('si la IA propone entrenar de más, el servidor lo corta al techo del estado de salud', async () => {
  const cliente = clienteDevolviendo({ comentario: 'Genial, dale con todo.', correccion: '', plan: { minutos: 90, intensidad: 'normal', motivo: 'Todo bien.' } });
  const r = await pedir(cliente, crearAlmacenEnMemoria());
  assert.deepEqual([r.plan.minutos, r.plan.intensidad, r.plan.limitadoPorMotor], [30, 'liviana', true]);
});

test('en rojo el plan es reposo aunque la IA diga otra cosa', async () => {
  const cliente = clienteDevolviendo({ comentario: 'Seguí.', correccion: '', plan: { minutos: 60, intensidad: 'moderada', motivo: 'x' } });
  const r = await pedir(cliente, crearAlmacenEnMemoria(), { tipo: 'exercise', ...SERIE, estado: { nivelMotor: 'red' } });
  assert.deepEqual([r.plan.minutos, r.plan.intensidad], [0, 'reposo']);
});

test('sin red: comentario local con las métricas de ESTA serie y plan limitado, no el comentario viejo de otra', async () => {
  const almacen = crearAlmacenEnMemoria();
  await pedir(clienteDevolviendo({ comentario: 'Comentario de otra serie distinta.', correccion: 'x', plan: { minutos: 20, intensidad: 'liviana', motivo: 'm' } }), almacen,
    { tipo: 'exercise', ...SERIE, metricas: { repeticiones: 5 } });
  const sinRed = { messages: { create: async () => { throw new Anthropic.APIConnectionError({ message: 'sin red' }); } } };
  const r = await pedir(sinRed, almacen); // otras métricas
  assert.equal(r.origen, 'guardada');
  assert.equal(r.comentarioDeIA, false);
  assert.match(r.comentario, /You finished 12 reps of squat/);
  assert.equal(r.plan.intensidad, 'liviana');
});

// ---------- el cliente del navegador ----------

const vozFalsa = () => ({ dichas: [], hablar(t) { this.dichas.push(t); return Promise.resolve(); } });

test('cliente: lee el comentario en voz alta y devuelve el plan ajustado', async () => {
  const voz = vozFalsa();
  const pedidos = [];
  const fetchFn = async (url, init) => {
    pedidos.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ ok: true, origen: 'claude', comentarioDeIA: true, comentario: 'Buena técnica.', correccion: '', plan: { minutos: 20, intensidad: 'liviana', motivo: 'm', limitadoPorMotor: false } }) };
  };
  const r = await crearComentarioDeSerie({ voz, fetchFn }).comentar(SERIE);
  assert.equal(pedidos[0].tipo, 'exercise');
  assert.deepEqual(pedidos[0].planActual, PLAN_NORMAL);
  assert.equal(r.origen, 'claude');
  assert.deepEqual(voz.dichas, ['Buena técnica.']);
});

test('cliente: si el servidor no responde, comenta con las métricas y aplica el techo del día', async () => {
  const voz = vozFalsa();
  const r = await crearComentarioDeSerie({ voz, fetchFn: async () => { throw new TypeError('sin servidor'); } }).comentar(SERIE);
  assert.equal(r.origen, 'local');
  assert.equal(r.plan.intensidad, 'liviana');
  assert.equal(r.plan.minutos, 30);
  assert.match(voz.dichas[0], /12 reps/);
});
