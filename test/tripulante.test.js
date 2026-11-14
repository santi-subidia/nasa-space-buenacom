import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SOL_ACTUAL } from '../lib/demo/generador.js';
import { DEMO_DATA } from '../lib/demo/sembrar.js';
import { evaluate } from '../lib/motor/evaluar.js';
import { armarVistaOficialMedico } from '../lib/tripulacion/logicaTripulante.js';

function evaluarTripulacionDemo() {
  const evaluacionesPorId = {};
  for (const t of DEMO_DATA.astronauts) {
    const r = DEMO_DATA.readings.filter((item) => item.astronautId === t.id);
    const s = DEMO_DATA.symptoms.filter((item) => item.astronautId === t.id);
    evaluacionesPorId[t.id] = evaluate(r, t.baseline, DEMO_DATA.mission.env, {
      symptoms: s,
      sol: SOL_ACTUAL,
    });
  }
  return evaluacionesPorId;
}

test('Marcos ve a Ana en orange con Posible reactivación viral y sin mediciones cuando permisosPorId.ana === false', () => {
  const evaluacionesPorId = evaluarTripulacionDemo();
  const vista = armarVistaOficialMedico({
    tripulacion: DEMO_DATA.astronauts,
    evaluacionesPorId,
    permisosPorId: { ana: false, marcos: true },
  });

  const ana = vista.find((v) => v.id === 'ana');
  assert.ok(ana);
  assert.equal(ana.level, 'orange');
  assert.equal(ana.alertaActiva?.title, 'Posible reactivación viral');
  assert.equal(ana.alertaActiva?.escalate, 'cmo');
  assert.equal(ana.compartioDetalles, false);
  assert.deepEqual(ana.indicadoresVisibles, []);
  assert.match(ana.notaPrivacidad, /no compartió/i);
});

test('Cuando permisosPorId.ana === true, Marcos ve los detalles compartidos de Ana', () => {
  const evaluacionesPorId = evaluarTripulacionDemo();
  const vista = armarVistaOficialMedico({
    tripulacion: DEMO_DATA.astronauts,
    evaluacionesPorId,
    permisosPorId: { ana: true, marcos: true },
  });

  const ana = vista.find((v) => v.id === 'ana');
  assert.ok(ana);
  assert.equal(ana.level, 'orange');
  assert.equal(ana.compartioDetalles, true);
  assert.equal(ana.notaPrivacidad, null);
  assert.ok(ana.indicadoresVisibles.length > 0);
  const estres = ana.indicadoresVisibles.find((i) => i.id === 'stress');
  assert.ok(estres);
  assert.equal(estres.value, 8);
});

test('Marcos se ve a sí mismo en green sin alertas', () => {
  const evaluacionesPorId = evaluarTripulacionDemo();
  const vista = armarVistaOficialMedico({
    tripulacion: DEMO_DATA.astronauts,
    evaluacionesPorId,
    permisosPorId: { ana: false, marcos: true },
  });

  const marcos = vista.find((v) => v.id === 'marcos');
  assert.ok(marcos);
  assert.equal(marcos.level, 'green');
  assert.equal(marcos.alertaActiva, null);
  assert.equal(marcos.compartioDetalles, true);
  assert.ok(marcos.indicadoresVisibles.length > 0);
});
