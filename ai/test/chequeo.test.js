import assert from 'node:assert/strict';
import { test } from 'node:test';

import Anthropic from '@anthropic-ai/sdk';

import { crearAlmacenEnMemoria } from '../almacen.js';
import { HERRAMIENTA_REGISTRAR_MEDICION, validarMedicion, describirMedicion, IDS_DE_VOZ } from '../chequeo/indicadores.js';
import { interpretarLocal } from '../chequeo/local.js';
import { crearChequeoPorVoz, PASOS_MATUTINOS } from '../chequeo/sesion.js';
import { consultarClaude } from '../claude.js';
import { crearManejador } from '../route.js';
import { construirTarea, ErrorDePeticion } from '../tareas.js';

// ---------- intérprete local y validación ----------

test('local: "37 con 6 de temperatura" → 37.6 °C, con o sin pista del paso', () => {
  assert.deepEqual(interpretarLocal('Anotá 37 con 6 de temperatura'), [{ indicador: 'temp', valor: 37.6 }]);
  assert.deepEqual(interpretarLocal('37,6', { esperado: ['temp'] }), [{ indicador: 'temp', valor: 37.6 }]);
  assert.deepEqual(interpretarLocal('tengo 38 grados'), [{ indicador: 'temp', valor: 38 }]);
});

test('local: presión en dos valores y otros indicadores', () => {
  const bp = [{ indicador: 'bp_sys', valor: 118 }, { indicador: 'bp_dia', valor: 76 }];
  assert.deepEqual(interpretarLocal('118 sobre 76', { esperado: ['bp_sys', 'bp_dia'] }), bp);
  assert.deepEqual(interpretarLocal('mi presión es 118/76'), bp);
  assert.equal(interpretarLocal('118', { esperado: ['bp_sys', 'bp_dia'] }), null);
  assert.deepEqual(interpretarLocal('un 4', { esperado: ['mood'] }), [{ indicador: 'mood', valor: 4 }]);
  assert.deepEqual(interpretarLocal('dormí 5 horas y media'), [{ indicador: 'sleep_h', valor: 5.5 }]);
  assert.deepEqual(interpretarLocal('tomé 1,5 litros de agua'), [{ indicador: 'water_ml', valor: 1500 }]);
  assert.deepEqual(interpretarLocal('saturación 97'), [{ indicador: 'spo2', valor: 97 }]);
});

test('local: sin números, con varios sin sentido o sin saber el indicador devuelve null (decide Claude)', () => {
  assert.equal(interpretarLocal('treinta y siete con seis', { esperado: ['temp'] }), null);
  assert.equal(interpretarLocal('hola', { esperado: ['temp'] }), null);
  assert.equal(interpretarLocal('37 y 40', { esperado: ['temp'] }), null);
  assert.equal(interpretarLocal('37'), null); // sin pista ni paso: no se sabe qué es
});

test('validarMedicion rechaza lo absurdo, redondea y pone la unidad estándar', () => {
  assert.deepEqual(validarMedicion({ indicador: 'temp', valor: 37.64, unidad: 'x' }), { ok: true, medicion: { indicador: 'temp', valor: 37.6, unidad: '°C' } });
  assert.equal(validarMedicion({ indicador: 'temp', valor: 376 }).motivo, 'rango');
  assert.equal(validarMedicion({ indicador: 'mood', valor: 7 }).motivo, 'rango');
  assert.equal(validarMedicion({ indicador: 'nada', valor: 1 }).motivo, 'indicador');
  assert.equal(validarMedicion({ indicador: 'temp', valor: 'abc' }).motivo, 'valor');
  assert.equal(describirMedicion({ indicador: 'temp', valor: 37.6, unidad: '°C' }), 'temperatura 37,6 °C');
});

test('la herramienta registrar_medicion es estricta y solo permite indicadores conocidos', () => {
  const { input_schema: s } = HERRAMIENTA_REGISTRAR_MEDICION;
  assert.equal(s.additionalProperties, false);
  assert.deepEqual(s.required, ['indicador', 'valor', 'unidad']);
  assert.deepEqual(s.properties.indicador.enum, IDS_DE_VOZ);
});

// ---------- sesión del chequeo ----------

function vozFalsa(frases, { fallos = {} } = {}) {
  const dichas = [];
  const cola = [...frases];
  return {
    dichas,
    soportaReconocimiento: true,
    soportaSintesis: true,
    escuchar: async () => {
      const siguiente = cola.shift();
      if (siguiente === undefined) throw { codigo: 'aborted', mensaje: '' };
      if (typeof siguiente === 'object') throw siguiente;
      return siguiente;
    },
    hablar: async (t) => { dichas.push(t); },
    callar() {},
    pararDeEscuchar() {},
  };
}

const sinServidor = async () => { throw new TypeError('sin servidor'); };

test('el chequeo matutino se completa entero por voz y registra Readings con source "voice"', async () => {
  const voz = vozFalsa(['118 sobre 76', '37 con 6', '4', '5']);
  const registradas = [];
  const chequeo = crearChequeoPorVoz({ voz, astronautId: 'ana', alRegistrar: (r) => registradas.push(r), fetchFn: sinServidor, ahora: () => 'T' });

  const { completo } = await chequeo.iniciar();

  assert.equal(completo, true);
  assert.deepEqual(registradas.map((r) => [r.indicator, r.value, r.unit]), [
    ['bp_sys', 118, 'mmHg'], ['bp_dia', 76, 'mmHg'], ['temp', 37.6, '°C'], ['mood', 4, 'pts'], ['stress', 5, 'pts'],
  ]);
  assert.ok(registradas.every((r) => r.source === 'voice' && r.astronautId === 'ana' && r.ts === 'T' && r.id));
  assert.equal(chequeo.obtener().fase, 'completo');
  assert.match(voz.dichas.at(-1), /Chequeo completo/);
  assert.equal(voz.dichas[0], PASOS_MATUTINOS[0].pregunta);
});

test('"treinta y siete con seis" (en palabras) se resuelve con Claude y se valida', async () => {
  const pedidos = [];
  const fetchFn = async (url, init) => {
    pedidos.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ ok: true, mediciones: [{ indicador: 'temp', valor: 37.6, unidad: '°C' }], rechazadas: [] }) };
  };
  const registradas = [];
  const chequeo = crearChequeoPorVoz({ voz: vozFalsa(['treinta y siete con seis']), pasos: [PASOS_MATUTINOS[1]], alRegistrar: (r) => registradas.push(r), fetchFn });
  assert.equal((await chequeo.iniciar()).completo, true);
  assert.deepEqual(pedidos[0], { tipo: 'check', texto: 'treinta y siete con seis', pendientes: ['temp'] });
  assert.equal(registradas[0].value, 37.6);
});

test('un valor absurdo no se guarda: Vega pide repetir', async () => {
  const voz = vozFalsa(['376', '37 con 6']);
  const registradas = [];
  const chequeo = crearChequeoPorVoz({ voz, pasos: [PASOS_MATUTINOS[1]], alRegistrar: (r) => registradas.push(r), fetchFn: sinServidor });
  await chequeo.iniciar();
  assert.deepEqual(registradas.map((r) => r.value), [37.6]);
  assert.ok(voz.dichas.some((d) => /no parece correcto/.test(d)));
});

test('si falta una de las dos cifras de la presión, Vega pregunta por la que falta', async () => {
  const respuestas = [
    { ok: true, mediciones: [{ indicador: 'bp_sys', valor: 118, unidad: 'mmHg' }], rechazadas: [] },
    { ok: true, mediciones: [{ indicador: 'bp_dia', valor: 76, unidad: 'mmHg' }], rechazadas: [] },
  ];
  const fetchFn = async () => ({ ok: true, json: async () => respuestas.shift() });
  const voz = vozFalsa(['ciento dieciocho', 'setenta y seis']);
  const registradas = [];
  const chequeo = crearChequeoPorVoz({ voz, pasos: [PASOS_MATUTINOS[0]], alRegistrar: (r) => registradas.push(r), fetchFn });
  assert.equal((await chequeo.iniciar()).completo, true);
  assert.deepEqual(registradas.map((r) => r.indicator), ['bp_sys', 'bp_dia']);
  assert.ok(voz.dichas.some((d) => /Me falta presión baja/.test(d)));
});

test('un indicador que el paso no esperaba no se cuela en el registro', async () => {
  const fetchFn = async () => ({ ok: true, json: async () => ({ ok: true, mediciones: [{ indicador: 'spo2', valor: 97, unidad: '%' }], rechazadas: [] }) });
  const registradas = [];
  const chequeo = crearChequeoPorVoz({ voz: vozFalsa(['noventa y siete', 'después']), pasos: [PASOS_MATUTINOS[1]], alRegistrar: (r) => registradas.push(r), fetchFn });
  await chequeo.iniciar();
  assert.equal(registradas.length, 0);
});

test('"después" omite el paso y el chequeo queda incompleto, avisando qué falta', async () => {
  const voz = vozFalsa(['después', '4', '5']);
  const chequeo = crearChequeoPorVoz({ voz, pasos: PASOS_MATUTINOS.slice(1), alRegistrar: () => {}, fetchFn: sinServidor });
  const { completo } = await chequeo.iniciar();
  assert.equal(completo, false);
  assert.deepEqual(chequeo.obtener().omitidos, ['temperatura']);
  assert.match(voz.dichas.at(-1), /Quedó sin anotar: temperatura/);
});

test('sin micrófono o con el permiso denegado no rompe y lo dice', async () => {
  const sin = crearChequeoPorVoz({ voz: { soportaReconocimiento: false }, fetchFn: sinServidor });
  assert.equal((await sin.iniciar()).completo, false);
  assert.match(sin.obtener().error, /teclado/);

  const denegado = crearChequeoPorVoz({ voz: vozFalsa([{ codigo: 'not-allowed', mensaje: 'Sin permiso' }]), fetchFn: sinServidor });
  assert.equal((await denegado.iniciar()).completo, false);
  assert.equal(denegado.obtener().error, 'Sin permiso');
});

test('"Anotá 37 con 6 de temperatura" en cualquier momento registra la medición', async () => {
  const registradas = [];
  const voz = vozFalsa([]);
  const chequeo = crearChequeoPorVoz({ voz, astronautId: 'ana', alRegistrar: (r) => registradas.push(r), fetchFn: sinServidor });
  const hechas = await chequeo.anotar('Anotá 37 con 6 de temperatura');
  assert.equal(hechas.length, 1);
  assert.equal(registradas[0].source, 'voice');
  assert.equal(voz.dichas.at(-1), 'Anoté temperatura 37,6 °C.');
  assert.deepEqual(await chequeo.anotar('blablá'), []);
});

// ---------- servidor: tarea "check" ----------

const llamadaDeHerramienta = (entrada, id = 'tu_1') => ({ type: 'tool_use', id, name: 'registrar_medicion', input: entrada });

function clienteConHerramientas(...llamadas) {
  const pedidos = [];
  return {
    pedidos,
    messages: {
      create: async (params) => {
        pedidos.push(params);
        return { model: 'claude-haiku-5-5', stop_reason: 'tool_use', content: llamadas.map((l, i) => llamadaDeHerramienta(l, `tu_${i}`)), usage: { input_tokens: 200, output_tokens: 30 } };
      },
    },
  };
}

test('tarea check: usa la herramienta estricta con esfuerzo low, sin respaldo ni guardado', () => {
  const t = construirTarea({ tipo: 'check', texto: 'anotá 37 con 6', pendientes: ['temp'] });
  assert.equal(t.sinRespaldo, true);
  assert.equal(t.guardar, false);
  assert.equal(t.esfuerzo, 'low');
  assert.equal(t.herramientas[0].name, 'registrar_medicion');
  assert.match(t.variable, /temp/);
  assert.throws(() => construirTarea({ tipo: 'check' }), ErrorDePeticion);
  assert.throws(() => construirTarea({ tipo: 'check', texto: 'x', pendientes: ['nada'] }), ErrorDePeticion);
});

test('POST check: devuelve las mediciones validadas y aparta las absurdas', async () => {
  const cliente = clienteConHerramientas(
    { indicador: 'temp', valor: 37.6, unidad: '°C' },
    { indicador: 'bp_sys', valor: 1180, unidad: 'mmHg' },
  );
  const POST = crearManejador({ consultar: (p) => consultarClaude(p, { cliente, almacen: crearAlmacenEnMemoria(), env: { ANTHROPIC_API_KEY: 'x' } }) });
  const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ tipo: 'check', texto: 'temperatura 37 con 6 y presión 1180' }) }));
  const cuerpo = await res.json();
  assert.deepEqual(cuerpo.mediciones, [{ indicador: 'temp', valor: 37.6, unidad: '°C' }]);
  assert.equal(cuerpo.rechazadas[0].motivo, 'rango');
  assert.equal(cliente.pedidos[0].tools[0].strict, true);
  assert.equal(cliente.pedidos[0].output_config.effort, 'low');
});

test('POST check con la red caída NO devuelve la medición vieja de otra frase', async () => {
  const almacen = crearAlmacenEnMemoria();
  almacen.guardar({ kind: 'answer', input: 'otra', output: { texto: 'una respuesta cualquiera', json: null, llamadas: [{ nombre: 'registrar_medicion', entrada: { indicador: 'temp', valor: 41, unidad: '°C' } }] } });
  const cliente = { messages: { create: async () => { throw new Anthropic.APIConnectionError({ message: 'sin red' }); } } };
  const POST = crearManejador({ consultar: (p) => consultarClaude(p, { cliente, almacen, env: { ANTHROPIC_API_KEY: 'x' } }) });
  const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ tipo: 'check', texto: 'anotá 37 con 6' }) }));
  const cuerpo = await res.json();
  assert.equal(cuerpo.ok, false);
  assert.deepEqual(cuerpo.mediciones, []);
  assert.equal(almacen.listar('answer').length, 1); // no guardó nada nuevo
});
