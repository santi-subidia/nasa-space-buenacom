import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { GRAFOS, alertaConGrafo, armarGrafoCausal } from '../lib/causas/grafos.js';
import { evaluate } from '../lib/motor/evaluar.js';
import { DEMO_DATA } from '../lib/demo/sembrar.js';

// Nodos y aristas del DAG oficial, leídos de la transcripción en doc/fuentes.
function leerDag(ruta) {
  const texto = readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
  const bloque = texto.split('```')[1];
  const aristas = bloque
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes(' -> '))
    .map((l) => l.split(' -> '));
  const nodos = new Set(aristas.flat());
  return { nodos, aristas: new Set(aristas.map(([a, b]) => `${a} -> ${b}`)) };
}

test('cada nodo y arista del grafo existe tal cual en el DAG oficial de la NASA', () => {
  for (const [id, def] of Object.entries(GRAFOS)) {
    const dag = leerDag(def.dag.local);
    const nasaDe = Object.fromEntries(def.nodos.map((n) => [n.id, n.nasa]));
    for (const n of def.nodos) assert.ok(dag.nodos.has(n.nasa), `${id}: nodo "${n.nasa}" no está en el DAG`);
    for (const [de, a] of def.aristas) {
      const arista = `${nasaDe[de]} -> ${nasaDe[a]}`;
      assert.ok(dag.aristas.has(arista), `${id}: arista "${arista}" no está en el DAG`);
    }
  }
});

test('los nodos están en orden topológico (un inferido se calcula después de sus padres)', () => {
  for (const def of Object.values(GRAFOS)) {
    const pos = new Map(def.nodos.map((n, i) => [n.id, i]));
    for (const [de, a] of def.aristas) assert.ok(pos.get(de) < pos.get(a), `${de} debería ir antes que ${a}`);
  }
});

test('sol 42 de Ana: el grafo enciende sueño → estrés → defensas → herpes y lo detecta AstroVitals', () => {
  const ana = DEMO_DATA.astronauts.find((a) => a.id === 'ana');
  const lecturas = DEMO_DATA.readings.filter((r) => r.astronautId === 'ana');
  const sintomas = DEMO_DATA.symptoms.filter((s) => s.astronautId === 'ana');
  const evaluacion = evaluate(lecturas, ana.baseline, 'mars_base', { symptoms: sintomas, sol: 42 });

  assert.equal(alertaConGrafo(evaluacion)?.ruleId, 'viral_reactivation');
  const g = armarGrafoCausal('viral_reactivation', { evaluacion, sintomas, sol: 42 });
  const n = Object.fromEntries(g.nodos.map((x) => [x.id, x]));

  assert.equal(n.isolation.estado, 'contexto');
  assert.equal(n.sleep.estado, 'activo');
  assert.equal(n.stress.estado, 'activo');
  assert.match(n.stress.valor, /^\d+\/10$/);
  assert.equal(n.circadian.estado, 'activo');
  assert.equal(n.subclinical.estado, 'activo');
  assert.equal(n.illness.estado, 'activo');
  assert.match(n.illness.valor, /Herpes labial · sol 41/);
  assert.equal(n.detect.nivel, 'orange');
  assert.match(n.detect.valor, /reactivación viral/);
  assert.equal(n.readiness.estado, 'activo');

  const activa = (de, a) => g.aristas.find((x) => x.de === de && x.a === a).activa;
  assert.ok(activa('sleep', 'stress'));
  assert.ok(activa('isolation', 'stress'));
  assert.ok(activa('stress', 'subclinical'));
  assert.ok(activa('clinical', 'illness'));
  assert.equal(g.camino[0], `Sueño (${n.sleep.valor})`);
});

test('con todo en verde no se enciende la cadena', () => {
  const evaluacion = evaluate(
    [
      { indicator: 'sleep_h', value: 8, sol: 5 },
      { indicator: 'stress', value: 3, sol: 5 },
      { indicator: 'temp', value: 36.6, sol: 5 },
    ],
    {},
    'mars_base',
    { sol: 5 },
  );
  assert.equal(alertaConGrafo(evaluacion), null);
  const g = armarGrafoCausal('viral_reactivation', { evaluacion, sintomas: [], sol: 5 });
  assert.ok(g.nodos.filter((x) => x.tipo !== 'peligro').every((x) => x.estado === 'inactivo'));
  assert.ok(g.aristas.every((x) => !x.activa));
  assert.equal(armarGrafoCausal('no_existe', { evaluacion }), null);
});
