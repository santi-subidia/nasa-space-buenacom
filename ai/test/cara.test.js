import assert from 'node:assert/strict';
import { test } from 'node:test';

import Anthropic from '@anthropic-ai/sdk';

import { crearAlmacenEnMemoria } from '../almacen.js';
import { crearComoMeVes } from '../cara/cliente.js';
import { analizarParpadeos, clasificarFatiga } from '../cara/parpadeo.js';
import { AVISO_NO_DIAGNOSTICO, ASPECTOS, ESQUEMA_CARA } from '../cara/tarea.js';
import { consultarClaude } from '../claude.js';
import { crearManejador } from '../route.js';
import { construirTarea, ErrorDePeticion } from '../tareas.js';

const BASE = { media_type: 'image/jpeg', data: 'QUJDREVGRw==' };
const HOY = { media_type: 'image/jpeg', data: 'SElKS0xNTg==' };
const PEDIDO = { tipo: 'face', fotoBase: BASE, fotoHoy: HOY, consentimiento: true };

// ---------- parpadeo ----------

/** Serie sintética: `parpadeos` cierres de `msCierre` repartidos en `seg` segundos, muestreo cada 100 ms. */
function serie({ seg, parpadeos, msCierre = 200 }) {
  const muestras = [];
  const cada = (seg * 1000) / parpadeos;
  for (let t = 0; t <= seg * 1000; t += 100) {
    const dentro = (t % cada) < msCierre && t > 0;
    muestras.push({ t, cierre: dentro ? 0.9 : 0.05 });
  }
  return muestras;
}

test('analizarParpadeos cuenta parpadeos por minuto y el porcentaje con los ojos cerrados', () => {
  const r = analizarParpadeos(serie({ seg: 60, parpadeos: 15 }));
  assert.ok(r.parpadeosPorMin >= 13 && r.parpadeosPorMin <= 16, `${r.parpadeosPorMin}`);
  assert.ok(r.pctOjosCerrados > 2 && r.pctOjosCerrados < 8, `${r.pctOjosCerrados}`);
  assert.equal(r.cierresLargos, 0);
  assert.equal(r.duracionSeg, 60);
});

test('un cierre largo no es un parpadeo: se cuenta aparte', () => {
  const r = analizarParpadeos(serie({ seg: 60, parpadeos: 6, msCierre: 1800 }));
  assert.equal(r.parpadeos, 0);
  assert.ok(r.cierresLargos >= 5);
  assert.ok(r.pctOjosCerrados > 15);
});

test('con menos de 10 segundos o datos inválidos no concluye nada', () => {
  assert.equal(analizarParpadeos(serie({ seg: 5, parpadeos: 2 })), null);
  assert.equal(analizarParpadeos([]), null);
  assert.equal(analizarParpadeos([{ t: 0, cierre: 'x' }, { t: 20000, cierre: NaN }]), null);
});

test('clasificarFatiga: normal, atención y alto', () => {
  assert.equal(clasificarFatiga({ parpadeosPorMin: 16, pctOjosCerrados: 4 }).nivel, 'normal');
  assert.equal(clasificarFatiga({ parpadeosPorMin: 16, pctOjosCerrados: 9 }).nivel, 'atencion');
  assert.equal(clasificarFatiga({ parpadeosPorMin: 5, pctOjosCerrados: 3 }).nivel, 'atencion');
  assert.equal(clasificarFatiga({ parpadeosPorMin: 16, pctOjosCerrados: 20 }).nivel, 'alto');
  assert.equal(clasificarFatiga({ parpadeosPorMin: 16, pctOjosCerrados: 3, cierresLargos: 3 }).nivel, 'alto');
});

// ---------- la tarea ----------

test('tarea face: consentimiento obligatorio y dos fotos válidas, base primero', () => {
  const t = construirTarea(PEDIDO);
  assert.equal(t.kind, 'face');
  assert.deepEqual(t.imagenes, [BASE, HOY]);
  assert.equal(t.esfuerzo, 'medium');
  assert.match(t.instrucciones, /consent/);
  assert.match(t.instrucciones, /Do not diagnose/);
  assert.match(t.variable, /Image 1: baseline photo/);
  assert.doesNotMatch(JSON.stringify(t.entrada), /QUJD/); // las fotos no se guardan: solo su huella

  for (const consentimiento of [undefined, false, 'si', 1]) {
    assert.throws(() => construirTarea({ ...PEDIDO, consentimiento }), /consentimiento/);
  }
  assert.throws(() => construirTarea({ ...PEDIDO, fotoHoy: undefined }), ErrorDePeticion);
  assert.throws(() => construirTarea({ ...PEDIDO, fotoBase: { media_type: 'image/gif', data: 'AAAA' } }), ErrorDePeticion);
});

test('el esquema solo admite los aspectos de la ficha y tiene todo requerido', () => {
  assert.deepEqual(ESQUEMA_CARA.properties.observaciones.items.properties.aspecto.enum, ASPECTOS);
  assert.deepEqual(ESQUEMA_CARA.required, ['resumen', 'observaciones', 'accion']);
  assert.equal(ESQUEMA_CARA.additionalProperties, false);
});

test('la medición de parpadeo viaja en el prompt', () => {
  const t = construirTarea({ ...PEDIDO, parpadeo: { parpadeosPorMin: 9, pctOjosCerrados: 12 } });
  assert.match(t.variable, /9 blinks per minute, 12 %/);
  assert.match(t.variable, /atencion/);
});

// ---------- de punta a punta con un cliente simulado ----------

const OBSERVACION = {
  resumen: 'Veo ojeras más marcadas y una lesión en el labio que antes no estaba.',
  observaciones: [
    { aspecto: 'ojeras', intensidad: 'moderada', descripcion: 'Más oscuras debajo de los ojos que en la foto base.' },
    { aspecto: 'lesion_piel', intensidad: 'notable', descripcion: 'Una lesión en el labio superior que podría ser herpes labial.' },
  ],
  accion: 'Medí tu temperatura y avisá al oficial médico para que mire el labio.',
};

const clienteDevolviendo = (json) => {
  const pedidos = [];
  return { pedidos, messages: { create: async (p) => { pedidos.push(p); return { model: 'claude-haiku-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 1800, output_tokens: 150 } }; } } };
};

const pedir = (cliente, almacen, cuerpo = PEDIDO) =>
  crearManejador({ consultar: (p) => consultarClaude(p, { cliente, almacen, env: { ANTHROPIC_API_KEY: 'x' } }) })(
    new Request('http://x/api/claude', { method: 'POST', body: JSON.stringify(cuerpo) }),
  ).then((r) => r.json().then((cuerpo) => ({ status: r.status, cuerpo })));

test('POST face: con dos fotos devuelve observaciones, una acción, el aviso fijo y las zonas del mapa', async () => {
  const cliente = clienteDevolviendo(OBSERVACION);
  const { cuerpo } = await pedir(cliente, crearAlmacenEnMemoria());
  assert.equal(cuerpo.origen, 'claude');
  assert.equal(cuerpo.observaciones.length, 2);
  assert.match(cuerpo.accion, /temperatura/);
  assert.equal(cuerpo.aviso, AVISO_NO_DIAGNOSTICO); // lo pone el servidor
  assert.deepEqual(cuerpo.zonas.sort(), ['brain', 'immune']);
  assert.equal(cuerpo.sugerirAvisoAlOficial, true); // hay una observación notable
  const contenido = cliente.pedidos[0].messages[0].content.map((b) => b.type);
  assert.deepEqual(contenido, ['image', 'image', 'text']); // base, hoy, texto
  assert.equal(cliente.pedidos[0].messages[0].content[0].source.data, BASE.data);
});

test('el aviso "no es un diagnóstico" está aunque la IA no lo diga o diga otra cosa', async () => {
  const { cuerpo } = await pedir(clienteDevolviendo({ ...OBSERVACION, resumen: 'Tenés una infección.' }), crearAlmacenEnMemoria());
  assert.equal(cuerpo.aviso, 'This is an observation, not a diagnosis.');
});

test('sin consentimiento responde 400 y no llama a la IA', async () => {
  const cliente = clienteDevolviendo(OBSERVACION);
  const { status, cuerpo } = await pedir(cliente, crearAlmacenEnMemoria(), { ...PEDIDO, consentimiento: false });
  assert.equal(status, 400);
  assert.match(cuerpo.error, /consentimiento/);
  assert.equal(cliente.pedidos.length, 0);
});

test('sin red: solo se reusa lo guardado si son EXACTAMENTE las mismas fotos', async () => {
  const almacen = crearAlmacenEnMemoria();
  await pedir(clienteDevolviendo(OBSERVACION), almacen);
  const sinRed = { messages: { create: async () => { throw new Anthropic.APIConnectionError({ message: 'sin red' }); } } };

  const mismas = (await pedir(sinRed, almacen)).cuerpo;
  assert.equal(mismas.origen, 'guardada');
  assert.equal(mismas.comparacionDeIA, true);
  assert.equal(mismas.observaciones.length, 2);

  const otras = (await pedir(sinRed, almacen, { ...PEDIDO, fotoHoy: { media_type: 'image/jpeg', data: 'T1RSQVM=' } })).cuerpo;
  assert.equal(otras.comparacionDeIA, false); // no se muestra la observación de otras fotos
  assert.deepEqual(otras.observaciones, []);
  assert.equal(otras.aviso, AVISO_NO_DIAGNOSTICO);
});

test('una salida sin resumen no se guarda ni se muestra', async () => {
  const almacen = crearAlmacenEnMemoria();
  const { cuerpo } = await pedir(clienteDevolviendo({ resumen: '', observaciones: [], accion: 'y' }), almacen);
  assert.equal(cuerpo.ok, false);
  assert.equal(almacen.listar('face').length, 0);
});

test('fotos que no permiten comparar: observaciones vacías y el resumen pide otra foto', async () => {
  const salida = { resumen: 'La foto de hoy está muy oscura para comparar.', observaciones: [], accion: 'Sacá otra foto con buena luz, como la base.' };
  const { cuerpo } = await pedir(clienteDevolviendo(salida), crearAlmacenEnMemoria());
  assert.equal(cuerpo.ok, true);
  assert.deepEqual(cuerpo.observaciones, []);
  assert.match(cuerpo.accion, /otra foto/);
  assert.equal(cuerpo.sugerirAvisoAlOficial, false);
  assert.equal(cuerpo.aviso, AVISO_NO_DIAGNOSTICO);
});

// ---------- el cliente del navegador ----------

const vozFalsa = () => ({ dichas: [], hablar(t) { this.dichas.push(t); return Promise.resolve(); } });

test('cliente: sin consentimiento no manda nada', async () => {
  let llamadas = 0;
  const r = await crearComoMeVes({ fetchFn: async () => { llamadas++; } }).observar({ fotoBase: BASE, fotoHoy: HOY, consentimiento: false });
  assert.equal(r.ok, false);
  assert.equal(llamadas, 0);
});

test('cliente: manda el parpadeo medido, lee el resumen, la acción y el aviso en voz alta', async () => {
  const voz = vozFalsa();
  let enviado;
  const fetchFn = async (url, init) => {
    enviado = JSON.parse(init.body);
    return { ok: true, json: async () => ({ ok: true, origen: 'claude', comparacionDeIA: true, aviso: AVISO_NO_DIAGNOSTICO, resumen: 'Veo ojeras.', accion: 'Dormí 8 horas.', observaciones: [], zonas: [] }) };
  };
  const r = await crearComoMeVes({ voz, fetchFn }).observar({ fotoBase: BASE, fotoHoy: HOY, consentimiento: true, muestrasParpadeo: serie({ seg: 30, parpadeos: 8 }) });
  assert.equal(enviado.tipo, 'face');
  assert.equal(enviado.consentimiento, true);
  assert.ok(enviado.parpadeo.parpadeosPorMin > 0);
  assert.equal(r.origen, 'claude');
  assert.equal(voz.dichas[0], 'Veo ojeras. Dormí 8 horas. This is an observation, not a diagnosis.');
});

test('cliente: sin servidor devuelve la lectura de fatiga del parpadeo, con el aviso', async () => {
  const voz = vozFalsa();
  const r = await crearComoMeVes({ voz, fetchFn: async () => { throw new TypeError('sin servidor'); } }).observar({
    fotoBase: BASE, fotoHoy: HOY, consentimiento: true, muestrasParpadeo: serie({ seg: 60, parpadeos: 6, msCierre: 1800 }),
  });
  assert.equal(r.origen, 'local');
  assert.equal(r.fatiga.nivel, 'alto');
  assert.deepEqual(r.zonas, ['brain']);
  assert.match(voz.dichas[0], /not a diagnosis/);
});
