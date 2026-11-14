import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import Anthropic from '@anthropic-ai/sdk';

import { claveDeEntrada, crearAlmacenEnArchivo, crearAlmacenEnMemoria } from '../almacen.js';
import { armarParametros, consultarClaude, MODELO } from '../claude.js';
import { crearManejador } from '../route.js';
import { construirTarea, ErrorDePeticion } from '../tareas.js';

const BASE = { kind: 'answer', instrucciones: 'Sos Vega.', contexto: '<fichas>…</fichas>', variable: 'Pregunta: ¿hola?', esfuerzo: 'low' };
const ENV_CON_CLAVE = { ANTHROPIC_API_KEY: 'clave-de-prueba' };

/** Cliente falso: devuelve `respuesta` (o lanza `error`) y guarda lo que se le pidió. */
function clienteFalso({ respuesta, error } = {}) {
  const llamadas = [];
  return {
    llamadas,
    messages: {
      create: async (params) => {
        llamadas.push(params);
        if (error) throw error;
        return respuesta;
      },
    },
  };
}

const respuestaOk = (texto = 'Respuesta de Claude.', extra = {}) => ({
  model: MODELO,
  stop_reason: 'end_turn',
  // Haiku 5.5 piensa por defecto: la respuesta puede empezar con un bloque thinking vacío.
  content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: texto }],
  usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 80 },
  ...extra,
});

const deps = (cliente, almacen = crearAlmacenEnMemoria()) => ({ cliente, almacen, env: ENV_CON_CLAVE });

test('arma la petición como pide Haiku 5.5: sin sampling, esfuerzo explícito y caché en lo fijo', () => {
  const p = armarParametros({ ...BASE, esfuerzo: 'low' });
  assert.equal(p.model, 'claude-haiku-5-5');
  assert.deepEqual(p.output_config, { effort: 'low' });
  for (const prohibido of ['temperature', 'top_p', 'top_k', 'thinking']) assert.equal(prohibido in p, false);
  assert.equal(p.messages.at(-1).role, 'user'); // sin prefill
  assert.equal(p.system.length, 2);
  assert.equal(p.system[0].cache_control, undefined);
  assert.deepEqual(p.system[1].cache_control, { type: 'ephemeral' }); // último bloque fijo
  assert.equal(p.messages[0].content.at(-1).text, BASE.variable); // lo variable, al final
});

test('sin contexto, el caché queda en las instrucciones', () => {
  const p = armarParametros({ ...BASE, contexto: '' });
  assert.equal(p.system.length, 1);
  assert.deepEqual(p.system[0].cache_control, { type: 'ephemeral' });
});

test('las imágenes van antes del texto y las herramientas salen con strict: true', () => {
  const p = armarParametros({
    ...BASE,
    imagenes: [{ media_type: 'image/jpeg', data: 'AAAA' }],
    herramientas: [{ name: 't', description: 'd', input_schema: { type: 'object', additionalProperties: false } }],
  });
  assert.equal(p.messages[0].content[0].type, 'image');
  assert.equal(p.messages[0].content[1].type, 'text');
  assert.equal(p.tools[0].strict, true);
});

test('rechaza un esfuerzo inválido y una petición sin parte variable', () => {
  assert.throws(() => armarParametros({ ...BASE, esfuerzo: 'ultra' }), /Esfuerzo/);
  assert.throws(() => armarParametros({ ...BASE, variable: '' }), /parte variable/);
});

test('respuesta buena: lee el texto por tipo de bloque, devuelve el uso y la guarda', async () => {
  const almacen = crearAlmacenEnMemoria();
  const r = await consultarClaude(BASE, deps(clienteFalso({ respuesta: respuestaOk() }), almacen));
  assert.equal(r.ok, true);
  assert.equal(r.origen, 'claude');
  assert.equal(r.texto, 'Respuesta de Claude.');
  assert.equal(r.uso.cacheEscritura, 80);
  assert.equal(almacen.listar('answer').length, 1);
});

test('refusal: no lee el contenido y devuelve la última respuesta guardada', async () => {
  const almacen = crearAlmacenEnMemoria();
  await consultarClaude({ ...BASE, variable: 'otra pregunta' }, deps(clienteFalso({ respuesta: respuestaOk('Guardada.') }), almacen));
  const refusal = respuestaOk('NO DEBERÍA LEERSE', { stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'bio', explanation: null } });
  const r = await consultarClaude(BASE, deps(clienteFalso({ respuesta: refusal }), almacen));
  assert.equal(r.origen, 'guardada');
  assert.equal(r.motivo, 'refusal');
  assert.equal(r.categoria, 'bio');
  assert.equal(r.texto, 'Guardada.');
  assert.equal(r.exacta, false); // no era la misma pregunta
  assert.equal(almacen.listar('answer').length, 1); // lo rechazado no se guarda
});

test('max_tokens: cae en la respuesta guardada', async () => {
  const almacen = crearAlmacenEnMemoria();
  await consultarClaude(BASE, deps(clienteFalso({ respuesta: respuestaOk('Buena.') }), almacen));
  const r = await consultarClaude(BASE, deps(clienteFalso({ respuesta: respuestaOk('cortada', { stop_reason: 'max_tokens' }) }), almacen));
  assert.equal(r.motivo, 'max_tokens');
  assert.equal(r.texto, 'Buena.');
  assert.equal(r.exacta, true); // misma pregunta
});

test('sin red o con la API caída: respuesta guardada, sin lanzar', async () => {
  const almacen = crearAlmacenEnMemoria();
  await consultarClaude(BASE, deps(clienteFalso({ respuesta: respuestaOk('Guardada.') }), almacen));

  const sinRed = clienteFalso({ error: new Anthropic.APIConnectionError({ message: 'sin internet' }) });
  assert.equal((await consultarClaude(BASE, deps(sinRed, almacen))).motivo, 'red');

  const caida = clienteFalso({ error: new Anthropic.InternalServerError(500, { type: 'error' }, 'boom', new Headers()) });
  const r = await consultarClaude(BASE, deps(caida, almacen));
  assert.equal(r.motivo, 'api');
  assert.equal(r.origen, 'guardada');
});

test('sin ANTHROPIC_API_KEY ni IA: devuelve lo guardado y no llama a la API', async () => {
  const almacen = crearAlmacenEnMemoria();
  almacen.guardar({ kind: 'answer', input: BASE.variable, output: { texto: 'De la demo.', json: null, llamadas: [] } });
  const r = await consultarClaude(BASE, { almacen, env: {} });
  assert.equal(r.origen, 'guardada');
  assert.equal(r.motivo, 'sin_clave');
  assert.equal(r.texto, 'De la demo.');
});

test('IA_APAGADA=1 nunca llama a la API aunque haya clave', async () => {
  const cliente = clienteFalso({ respuesta: respuestaOk() });
  const r = await consultarClaude(BASE, { cliente, almacen: crearAlmacenEnMemoria(), env: { ...ENV_CON_CLAVE, IA_APAGADA: '1' } });
  assert.equal(r.motivo, 'ia_apagada');
  assert.equal(cliente.llamadas.length, 0);
});

test('si no hay nada guardado, responde ok:false en vez de romper', async () => {
  const r = await consultarClaude(BASE, { almacen: crearAlmacenEnMemoria(), env: {} });
  assert.equal(r.ok, false);
  assert.equal(r.origen, 'ninguna');
});

test('salida estructurada: parsea el JSON; si viene roto, usa la guardada', async () => {
  const almacen = crearAlmacenEnMemoria();
  const formato = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false };
  const bueno = await consultarClaude({ ...BASE, formato }, deps(clienteFalso({ respuesta: respuestaOk('{"a":"x"}') }), almacen));
  assert.deepEqual(bueno.json, { a: 'x' });

  const cliente = clienteFalso({ respuesta: respuestaOk('esto no es json') });
  const malo = await consultarClaude({ ...BASE, formato }, deps(cliente, almacen));
  assert.equal(malo.motivo, 'json_invalido');
  assert.deepEqual(malo.json, { a: 'x' });
  assert.deepEqual(cliente.llamadas[0].output_config.format, { type: 'json_schema', schema: formato });
});

test('herramientas: devuelve las llamadas con su entrada ya parseada', async () => {
  const respuesta = respuestaOk('', {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: 'tu_1', name: 'registrar_medicion', input: { indicador: 'temperatura', valor: 37.6, unidad: 'C' } }],
  });
  const r = await consultarClaude(BASE, deps(clienteFalso({ respuesta })));
  assert.deepEqual(r.llamadas, [{ id: 'tu_1', nombre: 'registrar_medicion', entrada: { indicador: 'temperatura', valor: 37.6, unidad: 'C' } }]);
});

test('el almacén en archivo persiste, se recarga y no crece sin límite', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'astrovitals-'));
  try {
    const ruta = join(carpeta, 'sub', 'ai-results.json');
    const a = crearAlmacenEnArchivo(ruta);
    a.guardar({ kind: 'board', input: { n: 1 }, output: { texto: 'uno' } });
    assert.equal(crearAlmacenEnArchivo(ruta).buscar('board').output.texto, 'uno');
    for (let i = 0; i < 40; i++) a.guardar({ kind: 'board', input: { i }, output: { texto: String(i) } });
    assert.equal(crearAlmacenEnArchivo(ruta).listar('board').length, 30);
    assert.throws(() => a.guardar({ kind: 'otro', input: 1, output: 1 }), /kind/);
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});

test('la clave de entrada no depende del orden de las propiedades', () => {
  assert.equal(claveDeEntrada({ a: 1, b: { c: 2, d: 3 } }), claveDeEntrada({ b: { d: 3, c: 2 }, a: 1 }));
  assert.notEqual(claveDeEntrada({ a: 1 }), claveDeEntrada({ a: 2 }));
});

test('construirTarea(answer): instrucciones de Vega, fichas, citas y esfuerzo low por defecto', () => {
  const t = construirTarea({ tipo: 'answer', pregunta: '¿Por qué herpes?', riesgos: ['inmunidad'], datosDelDia: { sueno_horas: 5 } });
  assert.equal(t.kind, 'answer');
  assert.equal(t.esfuerzo, 'low');
  assert.match(t.instrucciones, /Vega/);
  assert.match(t.contexto, /<ficha riesgo="inmunidad"/);
  assert.match(t.variable, /sueno_horas/);
  assert.ok(t.citas.length >= 2);
  assert.equal(construirTarea({ tipo: 'answer', pregunta: 'x', esfuerzo: 'medium' }).esfuerzo, 'medium');
});

test('construirTarea rechaza lo mal formado', () => {
  for (const mal of [null, [], { tipo: 'nada' }, { tipo: 'answer' }, { tipo: 'answer', pregunta: 'x'.repeat(501) },
    { tipo: 'answer', pregunta: 'x', riesgos: ['marcianos'] }, { tipo: 'answer', pregunta: 'x', esfuerzo: 'max' }]) {
    assert.throws(() => construirTarea(mal), ErrorDePeticion);
  }
});

test('POST /api/claude: una pregunta devuelve la respuesta de Claude con sus citas', async () => {
  const cliente = clienteFalso({ respuesta: respuestaOk('Puede ser por el estrés y el poco sueño [F1].') });
  const POST = crearManejador({ consultar: (p) => consultarClaude(p, deps(cliente)) });
  const res = await POST(new Request('http://x/api/claude', {
    method: 'POST',
    body: JSON.stringify({ tipo: 'answer', pregunta: '¿Por qué me salió herpes?', riesgos: ['inmunidad'] }),
  }));
  const cuerpo = await res.json();
  assert.equal(res.status, 200);
  assert.equal(cuerpo.origen, 'claude');
  assert.match(cuerpo.texto, /\[F1\]/);
  assert.ok(cuerpo.citas[0].url.startsWith('https://www.nasa.gov/'));
  assert.equal(cliente.llamadas[0].output_config.effort, 'low');
});

test('POST /api/claude: peticiones mal formadas dan 4xx y nunca llaman a la IA', async () => {
  let llamadas = 0;
  const POST = crearManejador({ consultar: async () => { llamadas++; return {}; } });
  const enviar = (body) => POST(new Request('http://x/api/claude', { method: 'POST', body }));
  assert.equal((await enviar('no es json')).status, 400);
  assert.equal((await enviar(JSON.stringify({ tipo: 'nada' }))).status, 400);
  assert.equal((await POST(new Request('http://x/api/claude', { method: 'POST', body: '{}', headers: { 'content-length': String(9e6) } }))).status, 413);
  assert.equal(llamadas, 0);
});

test('POST /api/claude con la red caída devuelve 200 con la respuesta guardada', async () => {
  const almacen = crearAlmacenEnMemoria();
  const cuerpo = { tipo: 'answer', pregunta: '¿Y el sueño?', riesgos: ['sueno-horarios'] };
  const ok = crearManejador({ consultar: (p) => consultarClaude(p, deps(clienteFalso({ respuesta: respuestaOk('Dormí más.') }), almacen)) });
  await ok(new Request('http://x', { method: 'POST', body: JSON.stringify(cuerpo) }));

  const caida = clienteFalso({ error: new Anthropic.APIConnectionError({ message: 'wifi apagado' }) });
  const POST = crearManejador({ consultar: (p) => consultarClaude(p, deps(caida, almacen)) });
  const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify(cuerpo) }));
  const datos = await res.json();
  assert.equal(res.status, 200);
  assert.equal(datos.origen, 'guardada');
  assert.equal(datos.motivo, 'red');
  assert.equal(datos.texto, 'Dormí más.');
});
