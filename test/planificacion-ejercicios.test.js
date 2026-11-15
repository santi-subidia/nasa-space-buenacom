import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EJERCICIO_IDS,
  extraerEjerciciosRealizados,
  filtrarEjerciciosSugeridos,
  planificarEjerciciosDelDia,
} from '../lib/entrenador/planificacion.js';
import { avanzarDiaSemana, generarTareasJornada } from '../lib/reloj/relojMision.js';
import { DEMO_DATA } from '../lib/demo/sembrar.js';
import { sugerirEjerciciosPlan } from '../ai/entrenador/plan.js';
import { construirTarea } from '../ai/tareas.js';

const SET_REGISTRADOS = new Set(EJERCICIO_IDS);

test('todos los ejercicios sugeridos y pendientes pertenecen exclusivamente a los 4 registrados', () => {
  assert.deepEqual(EJERCICIO_IDS, ['sentadilla', 'flexion', 'zancada', 'plancha']);

  for (const dia of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']) {
    const plan = planificarEjerciciosDelDia({ diaSemana: dia, evaluacion: { globalLevel: 'green', alerts: [] } });
    assert.ok(plan.sugeridos.length >= 2);
    for (const item of [...plan.sugeridos, ...plan.pendientes]) {
      assert.ok(SET_REGISTRADOS.has(item.id), `Ejercicio no registrado: ${item.id}`);
    }
  }
});

test('los ejercicios pendientes cambian según el día de la semana', () => {
  const lunes = planificarEjerciciosDelDia({ diaSemana: 'lunes' });
  const martes = planificarEjerciciosDelDia({ diaSemana: 'martes' });
  const domingo = planificarEjerciciosDelDia({ diaSemana: 'domingo' });

  assert.notDeepEqual(
    lunes.sugeridos.map((e) => e.id),
    martes.sugeridos.map((e) => e.id),
  );
  assert.equal(lunes.intensidad, 'normal');
  assert.equal(lunes.minutosObjetivo, 90);
  assert.equal(domingo.intensidad, 'moderada');
  assert.equal(domingo.minutosObjetivo, 45);
});

test('adapta intensidad, duración y selección de ejercicios a las necesidades clínicas', () => {
  const viral = planificarEjerciciosDelDia({
    diaSemana: 'jueves',
    evaluacion: { globalLevel: 'orange', alerts: [{ id: 'viral_reactivation' }] },
  });
  assert.equal(viral.intensidad, 'liviana');
  assert.equal(viral.minutosObjetivo, 30);
  assert.equal(viral.limitadoPorSalud, true);
  assert.equal(viral.pendientes.some((e) => e.id === 'zancada'), false);
  assert.deepEqual(viral.pendientes.map((e) => e.id), ['plancha', 'sentadilla']);

  const vestibular = planificarEjerciciosDelDia({
    diaSemana: 'martes',
    evaluacion: { globalLevel: 'yellow', alerts: [{ id: 'vestibular_instability' }] },
  });
  assert.equal(vestibular.pendientes.some((e) => e.id === 'zancada'), false);
  assert.ok(vestibular.pendientes.every((e) => SET_REGISTRADOS.has(e.id)));

  const rojo = planificarEjerciciosDelDia({
    diaSemana: 'lunes',
    evaluacion: { globalLevel: 'red', alerts: [{ id: 'hypoxia_co2' }] },
  });
  assert.equal(rojo.reposo, true);
  assert.equal(rojo.intensidad, 'reposo');
  assert.equal(rojo.minutosObjetivo, 0);
  assert.equal(rojo.sugeridos.length, 0);
  assert.equal(rojo.pendientes.length, 0);
});

test('descuenta ejercicios realizados registrados en lecturasHoy por meta o nota', () => {
  const parcial = planificarEjerciciosDelDia({
    diaSemana: 'lunes',
    lecturasHoy: [
      {
        sol: 42,
        indicator: 'exercise_min',
        value: 20,
        note: '15 sentadillas',
        meta: { ejercicios: { sentadilla: 15 } },
      },
    ],
  });
  const idsPendientes = parcial.pendientes.map((e) => e.id);
  assert.equal(idsPendientes.includes('sentadilla'), false);
  assert.deepEqual(idsPendientes, ['plancha', 'flexion']);

  const completo = planificarEjerciciosDelDia({
    diaSemana: 'lunes',
    lecturasHoy: [
      {
        sol: 42,
        indicator: 'exercise_min',
        value: 90,
        note: 'rutina completa',
      },
    ],
  });
  assert.equal(completo.pendientes.length, 0);

  const extraido = extraerEjerciciosRealizados([
    { indicator: 'exercise_min', value: 15, note: '30 s de plancha, 10 flexiones' },
  ]);
  assert.equal(extraido.realizados.has('plancha'), true);
  assert.equal(extraido.realizados.has('flexion'), true);
});

test('filtrarEjerciciosSugeridos y sugerirEjerciciosPlan descartan ejercicios fuera de los 4 registrados', () => {
  const filtrados = filtrarEjerciciosSugeridos(
    ['correr', 'yoga', 'Plancha', 'burpees', 'sentadillas'],
    { diaSemana: 'lunes', evaluacion: { globalLevel: 'green', alerts: [] } },
  );
  assert.deepEqual(filtrados, ['plancha', 'sentadilla']);

  const respaldo = sugerirEjerciciosPlan(['bicicleta', 'natacion'], {
    diaSemana: 'martes',
    nivelMotor: 'green',
    intensidad: 'normal',
  });
  assert.ok(respaldo.length > 0);
  assert.ok(respaldo.every((id) => SET_REGISTRADOS.has(id)));

  const naranjaSinZancada = sugerirEjerciciosPlan(['zancada', 'correr', 'flexion'], {
    diaSemana: 'martes',
    nivelMotor: 'orange',
    intensidad: 'liviana',
    alertas: ['viral_reactivation'],
  });
  assert.deepEqual(naranjaSinZancada, ['flexion']);
});

test('generarTareasJornada sincroniza la tarea 13:30 con día, salud y sin demo-task-exercise obsoleto', () => {
  assert.equal(
    DEMO_DATA.tasks.some((t) => t.id === 'demo-task-exercise'),
    false,
  );

  const anaViral = generarTareasJornada({
    astronautId: 'ana',
    sol: 42,
    diaSemana: 'jueves',
    evaluacion: { globalLevel: 'orange', alerts: [{ id: 'viral_reactivation' }], indicators: {} },
    tareasGuardadas: [
      { id: 'demo-task-exercise', astronautId: 'ana', kind: 'exercise', title: 'Completar rutina de fuerza y aeróbico (90 min)' },
    ],
  });
  const ejercicioAna = anaViral.filter((t) => t.kind === 'exercise');
  assert.equal(ejercicioAna.length, 1);
  assert.match(ejercicioAna[0].title, /30 min/);
  assert.ok(ejercicioAna[0].ejerciciosSugeridos.every((e) => SET_REGISTRADOS.has(e.id)));

  const rojo = generarTareasJornada({
    astronautId: 'ana',
    sol: 43,
    diaSemana: 'viernes',
    evaluacion: { globalLevel: 'red', alerts: [{ id: 'hypoxia_co2' }], indicators: {} },
  });
  assert.equal(rojo.filter((t) => t.kind === 'exercise').length, 0);
  assert.ok(rojo.some((t) => t.missionTime === '13:30' && t.kind === 'rest'));

  assert.equal(avanzarDiaSemana('jueves', 1), 'viernes');
  assert.equal(avanzarDiaSemana('domingo', 1), 'lunes');
});

test('tareaEntrenador devuelve plan.ejerciciosSugeridos únicamente de los 4 registrados', () => {
  const t = construirTarea({
    tipo: 'exercise',
    ejercicio: 'sentadilla',
    diaSemana: 'jueves',
    metricas: { repeticiones: 10 },
    estado: { nivelMotor: 'orange', alertas: ['viral_reactivation'] },
  });
  const salida = t.procesar({
    origen: 'claude',
    json: {
      comentario: 'Bien.',
      correccion: '',
      plan: {
        minutos: 90,
        intensidad: 'normal',
        motivo: 'test',
        ejerciciosSugeridos: ['correr', 'plancha', 'zancada'],
      },
    },
  });
  assert.equal(salida.plan.minutos, 30);
  assert.equal(salida.plan.intensidad, 'liviana');
  assert.deepEqual(salida.plan.ejerciciosSugeridos, ['plancha']);
});
