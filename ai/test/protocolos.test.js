// Triaje local de VYTA basado en la checklist médica de la ISS (ai/vega/protocolos.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getContext } from '../contexto.js';
import { elegirRiesgos } from '../vega/riesgos.js';
import {
  cierreSegunEnlace,
  esMalestarVago,
  mensajeDeProtocolo,
  pideAviso,
  PREGUNTA_TRIAJE,
  PROTOCOLOS,
  triar,
} from '../vega/protocolos.js';
import { crearSesionVega } from '../vega/sesion.js';
import { detectarUrgencia } from '../vega/urgencia.js';

const nivel = (texto) => triar(texto)?.nivel ?? null;
const id = (texto) => triar(texto)?.protocolo.id ?? null;

test('triar: emergencias de la checklist de la ISS (1.101 a 1.108)', () => {
  assert.equal(id('mi compañero no responde y no respira'), 'paro');
  assert.equal(id('se está atragantando con la comida'), 'atragantamiento');
  assert.equal(id('se me está cerrando la garganta, creo que es alergia'), 'anafilaxia');
  assert.equal(id('está convulsionando'), 'convulsion');
  assert.equal(id('hay olor a amoníaco en el módulo'), 'toxico');
  assert.equal(id('me falta el aire'), 'dificultad-respiratoria');
  assert.equal(id('tiene la cara torcida y habla raro'), 'acv');
  for (const t of ['no responde', 'me falta el aire', 'hay humo', 'quiero morir']) assert.equal(nivel(t), 'emergencia', t);
});

test('triar: urgencias y avisos leves', () => {
  assert.equal(nivel('tengo dolor en el pecho'), 'urgente');
  assert.equal(id('se me hinchó el cuello'), 'trombosis');
  assert.equal(id('me duele muchísimo la panza'), 'dolor-abdominal');
  assert.equal(id('después de la EVA tengo hormigueo en el brazo'), 'descompresion');
  assert.equal(nivel('tengo 39 de fiebre'), 'urgente');
  assert.equal(nivel('tengo fiebre de 38'), 'aviso');
  assert.equal(nivel('tengo náuseas'), 'aviso');
  assert.equal(nivel('me duele la cabeza'), 'aviso');
  assert.equal(nivel('el peor dolor de cabeza de mi vida'), 'emergencia'); // lo grave gana
});

test('triar: negaciones explícitas y falsos positivos no disparan nada', () => {
  assert.equal(triar('no tengo dolor de pecho'), null);
  assert.equal(triar('no tengo fiebre ni tos'), null);
  assert.equal(triar('estoy de mal humor'), null); // "humo" solo como palabra
  assert.equal(triar('el sistema no responde'), null); // no es una persona
  assert.equal(triar('¿Puedo hacer la EVA de mañana?'), null);
  assert.equal(triar('Explicame mi sueño'), null);
  // ...pero un "no" suelto o un "pero" no apagan la señal.
  assert.equal(nivel('no sé, me duele el pecho'), 'urgente');
  assert.equal(nivel('no tengo fiebre pero me duele el pecho'), 'urgente');
});

test('protocolos: todos citan una fuente de la NASA, tienen pasos y nunca dosis en miligramos', () => {
  for (const p of PROTOCOLOS) {
    assert.ok(p.pasos.length > 0, p.id);
    assert.ok(p.fuentes.length > 0 && p.fuentes.every((f) => /nasa|governmentattic/.test(f.url)), p.id);
    assert.doesNotMatch(p.pasos.join(' '), /\bmg\b|miligram|mililitro|\bml\b/i, p.id);
  }
});

test('mensaje: en una emergencia con demora a Tierra, no se espera a Houston', () => {
  const texto = mensajeDeProtocolo(triar('no respira').protocolo, { retrasoMin: 14 });
  assert.match(texto, /treinta compresiones/);
  assert.match(texto, /desfibrilador/);
  assert.match(texto, /30 minutos: no la esperes/);
  assert.match(cierreSegunEnlace('emergencia', 0), /conferencia médica privada/); // órbita baja: hay enlace en vivo
});

test('detectarUrgencia: emergencia → crítica y urgente → alta, con la cita del procedimiento', () => {
  const paro = detectarUrgencia('no respira');
  assert.equal(paro.nivel, 'critica');
  assert.equal(paro.triaje, 'emergencia');
  assert.ok(paro.citas.some((c) => c.id === 'ISS 1.102'));
  assert.equal(detectarUrgencia('me duele el pecho').nivel, 'alta');
  assert.equal(detectarUrgencia('tengo náuseas'), null); // los avisos leves no alertan solos
});

test('malestar vago y pedido de aviso', () => {
  assert.equal(esMalestarVago('me siento mal'), true);
  assert.equal(esMalestarVago('me siento mal, me falta el aire'), false); // ya es una emergencia
  assert.equal(pideAviso('avisá al oficial médico'), true);
  assert.equal(pideAviso('avisale a Houston'), true);
  assert.equal(pideAviso('¿cuándo tengo que avisar al oficial médico?'), false);
});

test('elegirRiesgos trae la ficha de emergencias y cabe en el presupuesto', () => {
  assert.equal(elegirRiesgos('me siento mal y me duele el pecho')[0], 'emergencias-medicas');
  const ctx = getContext(['emergencias-medicas']);
  assert.ok(ctx.citas.some((c) => c.tipo === 'protocolo'));
  assert.ok(ctx.tokens < 20_000);
});

// ---------- sesión ----------

const respuestaFetch = (texto, llamadas = []) => async (url, init) => {
  llamadas.push(JSON.parse(init.body));
  return { ok: true, json: async () => ({ ok: true, origen: 'claude', texto, textoVoz: texto, citasUsadas: [] }) };
};

test('sesión: "me siento mal" pregunta por señales rojas sin IA, y un "sí" lo vuelve urgente', async () => {
  const avisos = [];
  const llamadas = [];
  const vega = crearSesionVega({ voz: null, alAvisarOficial: (a) => avisos.push(a), fetchFn: respuestaFetch('x', llamadas) });
  await vega.preguntar('me siento mal', { hablar: false });
  assert.equal(llamadas.length, 0);
  assert.equal(vega.obtener().mensajes.at(-1).texto, PREGUNTA_TRIAJE);

  await vega.preguntar('sí', { hablar: false });
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].nivel, 'alta');
  assert.equal(avisos[0].categoria, 'senal-roja');
  assert.equal(llamadas.length, 1); // la urgencia también consulta a la IA
  assert.ok(llamadas[0].historial.some((h) => h.text === PREGUNTA_TRIAJE)); // la IA sabe qué se preguntó
});

test('sesión: una emergencia da los pasos de la NASA al instante, con citas, sin consultar a la IA', async () => {
  const avisos = [];
  const llamadas = [];
  const vega = crearSesionVega({
    voz: null,
    alAvisarOficial: (a) => avisos.push(a),
    obtenerRetrasoTierraMin: () => 14,
    fetchFn: respuestaFetch('x', llamadas),
  });
  await vega.preguntar('mi compañero no responde', { hablar: false });
  assert.equal(llamadas.length, 0);
  assert.equal(avisos[0].nivel, 'critica');
  assert.equal(avisos[0].protocolo, 'paro');
  const ultimo = vega.obtener().mensajes.at(-1);
  assert.equal(ultimo.triaje, 'emergencia');
  assert.match(ultimo.texto, /no la esperes/);
  assert.ok(ultimo.citas.length > 0);

  // La pregunta siguiente lleva la emergencia en el historial.
  await vega.preguntar('¿y ahora qué hago?', { hablar: false });
  assert.ok(llamadas[0].historial.some((h) => /reanimación/.test(h.text)));
});

test('sesión: "avisá al oficial médico" registra el aviso con lo que contó, sin IA', async () => {
  const avisos = [];
  const llamadas = [];
  const vega = crearSesionVega({ voz: null, alAvisarOficial: (a) => avisos.push(a), fetchFn: respuestaFetch('Son comunes al adaptarse.', llamadas) });
  await vega.preguntar('tengo náuseas desde ayer', { hablar: false });
  assert.equal(avisos.length, 0); // aviso leve: decide el tripulante
  assert.equal(vega.obtener().sugerirAviso, true);
  await vega.preguntar('avisá al oficial médico', { hablar: false });
  assert.equal(llamadas.length, 1);
  assert.equal(avisos.length, 1);
  assert.match(avisos[0].motivo, /náuseas desde ayer/);
  assert.match(vega.obtener().mensajes.at(-1).texto, /conferencia médica privada/);
});

test('sesión: sin red, un aviso leve recibe el consejo del protocolo local', async () => {
  const vega = crearSesionVega({ voz: null, fetchFn: async () => { throw new TypeError('fetch failed'); } });
  await vega.preguntar('me duele la cabeza', { hablar: false });
  const ultimo = vega.obtener().mensajes.at(-1);
  assert.match(ultimo.texto, /dióxido de carbono/);
  assert.equal(ultimo.origen, 'local');
});
