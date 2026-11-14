import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getContext, listarRiesgos, riesgosDeEspecialista, riesgosDeZona } from '../contexto.js';
import { ESPECIALISTAS, ZONAS } from '../fichas/mapa.js';
import { UMBRAL_PRECIO_TOKENS, estimarTokens } from '../tokens.js';
import { INSTRUCCIONES_VEGA } from '../vega.js';

test("getContext(['inmunidad']) devuelve ficha, citas con URL de la NASA y conteo de tokens", () => {
  const r = getContext(['inmunidad']);
  assert.deepEqual(r.riesgos, ['inmunidad']);
  assert.match(r.texto, /<ficha riesgo="inmunidad"/);
  assert.match(r.texto, /Fuentes: \[F1\] \[F2\]/);
  assert.ok(r.citas.length >= 2);
  for (const cita of r.citas) {
    assert.match(cita.id, /^F\d+$/);
    assert.ok(cita.titulo);
    assert.match(cita.url, /^https:\/\/www\.nasa\.gov\//);
    assert.ok(r.texto.includes(`<fuente id="${cita.id}"`));
  }
  assert.equal(r.tokens, estimarTokens(r.texto));
  assert.equal(r.bloques.reduce((s, b) => s + b.tokens, 0) <= r.tokens, true);
});

test('no quedan enlaces relativos del repo dentro del contexto', () => {
  const { texto } = getContext(['inmunidad', 'cardiovascular'], { fuentes: 'todas' });
  assert.doesNotMatch(texto, /\]\(\.\.\//);
});

test('las fuentes compartidas entre riesgos se incluyen una sola vez', () => {
  const r = getContext(['hueso', 'capacidad-fisica'], { fuentes: 'todas' });
  const archivos = r.bloques.filter((b) => b.tipo === 'fuente').map((b) => b.archivo);
  assert.equal(new Set(archivos).size, archivos.length);
  assert.equal(new Set(r.citas.map((c) => c.id)).size, r.citas.length);
});

test("fuentes: 'ninguna' solo manda las fichas", () => {
  const r = getContext(['inmunidad'], { fuentes: 'ninguna' });
  assert.equal(r.citas.length, 0);
  assert.doesNotMatch(r.texto, /<fuentes>/);
});

test('si no entra en el presupuesto baja el nivel de fuentes y lo avisa', () => {
  const completo = getContext(['conducta-psiquiatria'], { fuentes: 'todas' });
  const r = getContext(['conducta-psiquiatria'], { fuentes: 'todas', presupuesto: completo.tokens - 1 });
  assert.equal(r.recortado, true);
  assert.notEqual(r.fuentes, 'todas');
  assert.ok(r.tokens <= completo.tokens - 1);
});

test('si ni las fichas solas entran, falla con un mensaje claro', () => {
  assert.throws(() => getContext(['inmunidad'], { presupuesto: 100 }), /no entra en el presupuesto/);
});

test('rechaza riesgos desconocidos, listas vacías y presupuestos que pasan los 100K', () => {
  assert.throws(() => getContext(['marcianos']), /desconocido.*marcianos/);
  assert.throws(() => getContext([]), /al menos un riesgo/);
  assert.throws(() => getContext(['inmunidad'], { presupuesto: UMBRAL_PRECIO_TOKENS + 1 }), /umbral/);
  assert.throws(() => getContext(['inmunidad'], { fuentes: 'mucho' }), /inválido/);
});

test('ninguna consulta posible pasa de 100K tokens, ni siquiera con los 17 riesgos y todas las fuentes sin límite de nivel', () => {
  const todo = getContext(listarRiesgos(), { fuentes: 'todas', presupuesto: UMBRAL_PRECIO_TOKENS });
  assert.ok(todo.tokens <= UMBRAL_PRECIO_TOKENS);
});

test('cada zona y cada especialista apuntan solo a riesgos que existen', () => {
  const validos = new Set(listarRiesgos());
  for (const [zona, ids] of Object.entries(ZONAS)) {
    for (const id of ids) assert.ok(validos.has(id), `zona ${zona}: riesgo ${id} no existe`);
    assert.ok(getContext(riesgosDeZona(zona)).tokens > 0);
  }
  for (const [esp, ids] of Object.entries(ESPECIALISTAS)) {
    for (const id of ids) assert.ok(validos.has(id), `especialista ${esp}: riesgo ${id} no existe`);
    assert.ok(getContext(riesgosDeEspecialista(esp)).tokens > 0);
  }
  assert.throws(() => riesgosDeZona('rodilla'), /Zona desconocida/);
});

test('todos los riesgos de doc/02-riesgos están indexados', () => {
  assert.equal(listarRiesgos().length, 17);
});

test('las instrucciones de Vega cubren voz corta, citas, no diagnosticar y escalar', () => {
  for (const clave of [/voz alta/, /\[F2\]/, /No diagnostic/, /oficial médico/, /hacerse daño/]) {
    assert.match(INSTRUCCIONES_VEGA, clave);
  }
});
