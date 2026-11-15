import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  armarInformeParaTierra,
  calcularEstadoEnvio,
  construirRecordatoriosDeRespuesta,
  DURACION_TOTAL_MIN,
  HITOS_ENLACE,
  INFORME_TECNICO_RESPALDO_SOL42,
  RESPUESTA_MEDICA_SOL42,
  RETRASO_SOLO_IDA_MIN,
  TRADUCCION_VEGA_SOL42,
} from '../lib/enlace/logicaEnlace.js';

test('constantes de retraso e hitos de enlace Tierra–Marte', () => {
  assert.equal(RETRASO_SOLO_IDA_MIN, 14);
  assert.equal(DURACION_TOTAL_MIN, 30);
  assert.equal(HITOS_ENLACE.length, 4);
  assert.deepEqual(
    HITOS_ENLACE.map((h) => h.etiqueta),
    [
      'Sent from Mars Base',
      'Arrives in Houston',
      'Flight Surgeon Review',
      'Arrives at Mars Base',
    ],
  );
});

test('calcularEstadoEnvio cubre las 5 etapas del recorrido con retraso de 14 min', () => {
  const enColaNull = calcularEstadoEnvio(null);
  assert.equal(enColaNull.etapa, 'en_cola');
  assert.equal(enColaNull.progresoPct, 0);
  assert.equal(enColaNull.minutosRestantes, 30);
  assert.equal(enColaNull.respuestaDisponible, false);
  assert.ok(enColaNull.hitos.every((h) => h.estado === 'pendiente'));

  const enColaNeg = calcularEstadoEnvio(-3);
  assert.equal(enColaNeg.etapa, 'en_cola');
  assert.equal(enColaNeg.respuestaDisponible, false);

  const idaInicio = calcularEstadoEnvio(0);
  assert.equal(idaInicio.etapa, 'viajando_ida');
  assert.equal(idaInicio.progresoPct, 0);
  assert.equal(idaInicio.minutosRestantes, 30);
  assert.equal(idaInicio.respuestaDisponible, false);
  assert.equal(idaInicio.hitos[0].estado, 'completado');
  assert.equal(idaInicio.hitos[1].estado, 'activo');

  const idaMitad = calcularEstadoEnvio(7);
  assert.equal(idaMitad.etapa, 'viajando_ida');
  assert.equal(idaMitad.minutosRestantes, 23);
  assert.equal(idaMitad.respuestaDisponible, false);

  const enHouston = calcularEstadoEnvio(14);
  assert.equal(enHouston.etapa, 'en_houston');
  assert.equal(enHouston.minutosRestantes, 16);
  assert.equal(enHouston.respuestaDisponible, false);
  assert.equal(enHouston.hitos[1].estado, 'completado');
  assert.equal(enHouston.hitos[2].estado, 'activo');

  const enHoustonMin15 = calcularEstadoEnvio(15);
  assert.equal(enHoustonMin15.etapa, 'en_houston');
  assert.equal(enHoustonMin15.respuestaDisponible, false);

  const vuelta = calcularEstadoEnvio(16);
  assert.equal(vuelta.etapa, 'viajando_vuelta');
  assert.equal(vuelta.minutosRestantes, 14);
  assert.equal(vuelta.respuestaDisponible, false);
  assert.equal(vuelta.hitos[2].estado, 'completado');
  assert.equal(vuelta.hitos[3].estado, 'activo');

  const vueltaCasi = calcularEstadoEnvio(29);
  assert.equal(vueltaCasi.etapa, 'viajando_vuelta');
  assert.equal(vueltaCasi.minutosRestantes, 1);
  assert.equal(vueltaCasi.respuestaDisponible, false);

  const recibido = calcularEstadoEnvio(30);
  assert.equal(recibido.etapa, 'recibido');
  assert.equal(recibido.progresoPct, 100);
  assert.equal(recibido.minutosRestantes, 0);
  assert.equal(recibido.respuestaDisponible, true);
  assert.ok(recibido.hitos.every((h) => h.estado === 'completado' && h.completado));

  const recibidoExcedido = calcularEstadoEnvio(45);
  assert.equal(recibidoExcedido.etapa, 'recibido');
  assert.equal(recibidoExcedido.progresoPct, 100);
  assert.equal(recibidoExcedido.minutosRestantes, 0);
  assert.equal(recibidoExcedido.respuestaDisponible, true);
});

test('RESPUESTA_MEDICA_SOL42 y TRADUCCION_VEGA_SOL42 tienen contenido clínico y simple del Sol 42', () => {
  assert.equal(RESPUESTA_MEDICA_SOL42.remitente, 'Dr. Elena Vance · Flight Surgeon (Houston)');
  assert.equal(RESPUESTA_MEDICA_SOL42.sol, 42);
  assert.equal(RESPUESTA_MEDICA_SOL42.nivelRecomendado, 'orange');
  assert.ok(RESPUESTA_MEDICA_SOL42.asunto.length > 0);
  assert.ok(RESPUESTA_MEDICA_SOL42.resumenTecnico.includes('viral reactivation'));
  assert.ok(Array.isArray(RESPUESTA_MEDICA_SOL42.indicaciones) && RESPUESTA_MEDICA_SOL42.indicaciones.length >= 3);

  assert.ok(TRADUCCION_VEGA_SOL42.titulo.length > 0);
  assert.ok(TRADUCCION_VEGA_SOL42.resumenSimple.length > 0);
  assert.ok(TRADUCCION_VEGA_SOL42.textoVoz.length > 20);
  assert.ok(Array.isArray(TRADUCCION_VEGA_SOL42.pasos) && TRADUCCION_VEGA_SOL42.pasos.length >= 3);
});

test('construirRecordatoriosDeRespuesta genera 3 Task válidas con recurrence event e ISO 8601', () => {
  const tareas = construirRecordatoriosDeRespuesta('ana', 42);
  assert.equal(tareas.length, 3);

  for (const tarea of tareas) {
    assert.equal(tarea.astronautId, 'ana');
    assert.equal(tarea.recurrence, 'event');
    assert.equal(tarea.done, false);
    assert.ok(typeof tarea.id === 'string' && tarea.id.length > 0);
    assert.ok(typeof tarea.kind === 'string' && tarea.kind.length > 0);
    assert.ok(typeof tarea.title === 'string' && tarea.title.length > 0);
    assert.ok(typeof tarea.missionTime === 'string');
    const ms = Date.parse(tarea.missionTime);
    assert.ok(Number.isFinite(ms));
    assert.equal(new Date(ms).toISOString(), tarea.missionTime);
  }

  assert.ok(tareas.some((t) => /temperature/i.test(t.title)));
  assert.ok(tareas.some((t) => /light exercise/i.test(t.title)));
  assert.ok(tareas.some((t) => /sol 44/i.test(t.title)));
});

test('armarInformeParaTierra usa resultado de Junta cuando existe y respaldo Sol 42 si no', () => {
  const respaldo = armarInformeParaTierra(undefined);
  assert.deepEqual(respaldo, INFORME_TECNICO_RESPALDO_SOL42);

  const desdeJunta = armarInformeParaTierra({
    kind: 'board',
    ts: '2026-11-14T12:00:00.000Z',
    input: { astronauta: 'ana', sol: 42, nivelMotor: 'orange' },
    output: {
      json: {
        sintesis: { nivel: 'orange' },
        informe_tecnico: {
          resumen_clinico: 'Resumen clínico generado por la Junta.',
          hallazgos: ['Hallazgo 1'],
          plan: ['Plan 1'],
        },
      },
    },
  });

  assert.equal(desdeJunta.origen, 'junta');
  assert.equal(desdeJunta.nivel, 'orange');
  assert.equal(desdeJunta.resumen, 'Resumen clínico generado por la Junta.');
  assert.deepEqual(desdeJunta.hallazgos, ['Hallazgo 1']);
  assert.deepEqual(desdeJunta.plan, ['Plan 1']);
});
