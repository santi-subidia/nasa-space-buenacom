import assert from 'node:assert/strict';
import { test } from 'node:test';

import Anthropic from '@anthropic-ai/sdk';

import { crearAlmacenEnMemoria } from '../almacen.js';
import { consultarClaude } from '../claude.js';
import { ENTRADA_SOL42 } from '../junta/ejemplo-sol42.js';
import { ESQUEMA_JUNTA, ESPECIALISTAS_JUNTA, revisarSalida } from '../junta/esquema.js';
import { maxNivel, mergeLevel } from '../junta/niveles.js';
import { riesgosParaJunta } from '../junta/tarea.js';
import { armarVistaJunta } from '../junta/vista.js';
import { crearManejador } from '../route.js';
import { construirTarea, ErrorDePeticion } from '../tareas.js';
import { UMBRAL_PRECIO_TOKENS, estimarTokens } from '../tokens.js';

// ---------- niveles ----------

test('mergeLevel: la junta nunca baja el nivel del motor, pero puede subirlo', () => {
  assert.equal(mergeLevel('orange', 'yellow'), 'orange');
  assert.equal(mergeLevel('orange', 'green'), 'orange');
  assert.equal(mergeLevel('orange', 'orange'), 'orange');
  assert.equal(mergeLevel('orange', 'red'), 'red');
  assert.equal(mergeLevel('green', 'yellow'), 'yellow');
  assert.equal(mergeLevel('red', undefined), 'red');
  assert.throws(() => mergeLevel('orange', 'purple'), /Nivel desconocido/);
  assert.equal(maxNivel(['green', 'orange', 'yellow']), 'orange');
  assert.equal(maxNivel([]), 'green');
});

// ---------- esquema ----------

function recorrer(esquema, ruta, revisar) {
  revisar(esquema, ruta);
  if (esquema.type === 'array') recorrer(esquema.items, `${ruta}[]`, revisar);
  if (esquema.type === 'object') for (const [k, v] of Object.entries(esquema.properties)) recorrer(v, `${ruta}.${k}`, revisar);
}

test('el esquema cumple las reglas de salida estructurada: todo required y additionalProperties:false', () => {
  recorrer(ESQUEMA_JUNTA, 'junta', (nodo, ruta) => {
    if (nodo.type !== 'object') return;
    assert.equal(nodo.additionalProperties, false, ruta);
    assert.deepEqual(nodo.required, Object.keys(nodo.properties), ruta);
  });
  // sin restricciones numéricas ni de largo, que la salida estructurada no admite
  assert.doesNotMatch(JSON.stringify(ESQUEMA_JUNTA), /minimum|maximum|minLength|maxLength|minItems|maxItems/);
});

const salidaValida = (extra = {}) => ({
  especialistas: ESPECIALISTAS_JUNTA.map((id) => ({ id, nivel: 'yellow', opinion: `Opinión de ${id}`, fuentes: ['F1'] })),
  desacuerdos: [],
  sintesis: { nivel: 'orange', accion: 'avisar_oficial_medico', decision: 'Avisar al oficial médico.', razones: ['Sueño bajo', 'Herpes'] },
  informe_astronauta: { titulo: 'Hoy conviene descansar', resumen: 'Tu cuerpo está pidiendo descanso.', que_hacer: ['Dormir 8 h'] },
  informe_tecnico: { resumen_clinico: 'Posible reactivación viral.', hallazgos: ['Temp 37,6 °C'], plan: ['Hisopado'], recordatorios: [{ titulo: 'Hisopado', sol: 44, detalle: 'Lesión labial' }] },
  ...extra,
});

test('revisarSalida detecta especialistas faltantes, repetidos o niveles inválidos', () => {
  assert.equal(revisarSalida(salidaValida()), null);
  const sinUno = salidaValida();
  sinUno.especialistas.pop();
  assert.match(revisarSalida(sinUno), /Faltan especialistas/);
  const repetido = salidaValida();
  repetido.especialistas.push({ ...repetido.especialistas[0] });
  assert.match(revisarSalida(repetido), /repetidos/);
  assert.match(revisarSalida(salidaValida({ sintesis: { nivel: 'morado' } })), /nivel válido/);
  assert.match(revisarSalida(null), /no es un objeto/);
});

// ---------- la tarea ----------

test('riesgosParaJunta: las zonas con alertas primero y al menos una ficha por especialista', () => {
  const r = riesgosParaJunta(ENTRADA_SOL42.alertas, ENTRADA_SOL42.sintomas);
  assert.equal(r[0], 'inmunidad');
  assert.ok(r.length <= 8);
  for (const id of ['cardiovascular', 'conducta-psiquiatria', 'hueso', 'soporte-sistemas']) assert.ok(r.includes(id), id);
});

test('tarea board con los datos del sol 42: esfuerzo medium, esquema, fichas y datos en el prompt', () => {
  const t = construirTarea({ tipo: 'board', ...ENTRADA_SOL42 });
  assert.equal(t.kind, 'board');
  assert.equal(t.esfuerzo, 'medium');
  assert.equal(t.formato, ESQUEMA_JUNTA);
  assert.match(t.instrucciones, /PISO/);
  assert.match(t.contexto, /<ficha riesgo="inmunidad"/);
  assert.match(t.variable, /Sol 42/);
  assert.match(t.variable, /viral_reactivation|Posible reactivación viral/);
  assert.match(t.variable, /sleep_h \(h\): S36 06:45: 6 \| S37 06:45: 5.5/);
  assert.match(t.variable, /cold_sore/);
  // lo que cuesta: debe ser mucho menos que el umbral de 100K tokens
  const total = estimarTokens(t.instrucciones) + estimarTokens(t.contexto) + estimarTokens(t.variable);
  assert.ok(total < UMBRAL_PRECIO_TOKENS / 2, `entrada de ${total} tokens`);
});

test('tarea board rechaza entradas mal formadas', () => {
  const malas = [
    { ...ENTRADA_SOL42, astronauta: {} },
    { ...ENTRADA_SOL42, sol: 'cuarenta' },
    { ...ENTRADA_SOL42, nivelMotor: 'morado' },
    { ...ENTRADA_SOL42, lecturas: [] },
    { ...ENTRADA_SOL42, lecturas: [{ indicator: 'temp', value: 'abc' }] },
    { ...ENTRADA_SOL42, alertas: [{ level: 'morado' }] },
  ];
  for (const mala of malas) assert.throws(() => construirTarea({ tipo: 'board', ...mala }), ErrorDePeticion);
});

// ---------- de punta a punta con un cliente simulado ----------

const clienteDevolviendo = (json, stop = 'end_turn') => {
  const pedidos = [];
  return {
    pedidos,
    messages: {
      create: async (p) => {
        pedidos.push(p);
        return { model: 'claude-haiku-5-5', stop_reason: stop, content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 15000, output_tokens: 1800 } };
      },
    },
  };
};

const pedirJunta = (cliente, almacen, cuerpo = { tipo: 'board', ...ENTRADA_SOL42 }) => {
  const POST = crearManejador({ consultar: (p) => consultarClaude(p, { cliente, almacen, env: { ANTHROPIC_API_KEY: 'x' } }) });
  return POST(new Request('http://x/api/claude', { method: 'POST', body: JSON.stringify(cuerpo) })).then((r) => r.json());
};

test('POST board: el consenso del sol 42 es avisar al oficial médico, con el desacuerdo resuelto y fuentes', async () => {
  const salida = salidaValida({
    desacuerdos: [{
      tema: '¿Infección o efecto del poco sueño?',
      posiciones: [{ especialista: 'inmunidad', postura: 'Podría ser una reactivación viral.' }, { especialista: 'conducta-y-sueno', postura: 'El déficit de sueño explica la fatiga.' }],
      resolucion: 'Son compatibles: el poco sueño y el estrés favorecen la reactivación; se avisa al oficial médico.',
    }],
  });
  salida.especialistas.find((e) => e.id === 'inmunidad').fuentes = ['F1', 'F99']; // F99 no existe
  const cliente = clienteDevolviendo(salida);
  const almacen = crearAlmacenEnMemoria();
  const r = await pedirJunta(cliente, almacen);

  assert.equal(r.origen, 'claude');
  assert.equal(r.nivelFinal, 'orange');
  assert.equal(r.accionFinal, 'avisar_oficial_medico');
  assert.equal(r.junta.desacuerdos.length, 1);
  assert.equal(r.junta.desacuerdos[0].posiciones.length, 2);
  const inmunidad = r.junta.especialistas.find((e) => e.id === 'inmunidad');
  assert.equal(inmunidad.citas.length, 1); // F99 se descarta
  assert.ok(inmunidad.citas[0].url.startsWith('https://www.nasa.gov/'));
  assert.equal(cliente.pedidos[0].output_config.effort, 'medium');
  assert.equal(cliente.pedidos[0].output_config.format.type, 'json_schema');
  assert.equal(almacen.listar('board').length, 1); // guardado para la demo
});

test('el motor manda: si la junta propone bajar el nivel, el final no baja y la acción sube', async () => {
  const flojo = salidaValida({ sintesis: { nivel: 'yellow', accion: 'vigilar', decision: 'Vigilar.', razones: [] } });
  const r = await pedirJunta(clienteDevolviendo(flojo), crearAlmacenEnMemoria());
  assert.equal(r.nivelJunta, 'yellow');
  assert.equal(r.nivelMotor, 'orange');
  assert.equal(r.nivelFinal, 'orange');
  assert.equal(r.subioPorMotor, true);
  assert.equal(r.accionFinal, 'avisar_oficial_medico');
});

test('la junta sí puede subir el nivel por encima del motor', async () => {
  const grave = salidaValida({ sintesis: { nivel: 'red', accion: 'contactar_medicos_de_vuelo', decision: 'Contactar.', razones: [] } });
  const r = await pedirJunta(clienteDevolviendo(grave), crearAlmacenEnMemoria());
  assert.equal(r.nivelFinal, 'red');
  assert.equal(r.subioPorMotor, false);
  assert.equal(r.accionFinal, 'contactar_medicos_de_vuelo');
});

test('una salida incompleta no se guarda ni se muestra: se usa la última junta guardada', async () => {
  const almacen = crearAlmacenEnMemoria();
  await pedirJunta(clienteDevolviendo(salidaValida()), almacen);
  const incompleta = salidaValida();
  incompleta.especialistas.pop();
  const r = await pedirJunta(clienteDevolviendo(incompleta), almacen);
  assert.equal(r.origen, 'guardada');
  assert.equal(r.motivo, 'json_invalido');
  assert.match(r.detalle, /Faltan especialistas/);
  assert.equal(almacen.listar('board').length, 1);
});

test('sin red, la junta guardada se muestra igual (y se vuelve a cruzar con el motor de hoy)', async () => {
  const almacen = crearAlmacenEnMemoria();
  await pedirJunta(clienteDevolviendo(salidaValida({ sintesis: { nivel: 'yellow', accion: 'vigilar', decision: 'x', razones: [] } })), almacen);
  const sinRed = { messages: { create: async () => { throw new Anthropic.APIConnectionError({ message: 'wifi apagado' }); } } };
  const r = await pedirJunta(sinRed, almacen, { tipo: 'board', ...ENTRADA_SOL42, nivelMotor: 'red' });
  assert.equal(r.origen, 'guardada');
  assert.equal(r.motivo, 'red');
  assert.equal(r.nivelFinal, 'red'); // el motor de hoy manda sobre lo guardado
  assert.equal(r.accionFinal, 'contactar_medicos_de_vuelo');
});

test('refusal: no lee nada y devuelve lo guardado; sin nada guardado, ok:false sin romper', async () => {
  const refusal = { messages: { create: async () => ({ stop_reason: 'refusal', stop_details: { category: 'bio' }, content: [], usage: {} }) } };
  const r = await pedirJunta(refusal, crearAlmacenEnMemoria());
  assert.equal(r.ok, false);
  assert.equal(r.junta, null);
  assert.equal(armarVistaJunta(r), null);
});

// ---------- vista de la pantalla ----------

test('vista: pestañas "Para Ana" y "Para médicos de vuelo", semáforo por especialista y aviso de respuesta guardada', async () => {
  const r = await pedirJunta(clienteDevolviendo(salidaValida()), crearAlmacenEnMemoria());
  const vista = armarVistaJunta(r, 'Ana');
  assert.deepEqual(vista.pestanas.map((p) => p.etiqueta), ['Para Ana', 'Para médicos de vuelo']);
  assert.equal(vista.especialistas.length, 5);
  assert.equal(vista.especialistas[2].nombre, 'Conducta y sueño');
  assert.equal(vista.accion.texto, 'Avisar al oficial médico');
  assert.equal(vista.guardada, false);
  assert.deepEqual(vista.pestanas[1].recordatorios[0], { titulo: 'Hisopado', sol: 44, detalle: 'Lesión labial' });
});
