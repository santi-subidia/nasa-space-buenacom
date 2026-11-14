import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DURACION_SOL_MIN,
  avanzarTiempoMision,
  esSuenoProtegido,
  estadoTareaRespectoAHora,
  formatearHoraMision,
  generarTareasJornada,
  parsearHoraMision,
} from '../lib/reloj/relojMision.js';

test('sol marciano dura 1477 minutos y hace rollover de 24:36 a 00:00 del sol siguiente', () => {
  assert.equal(DURACION_SOL_MIN, 1477);
  assert.equal(formatearHoraMision(0), '00:00');
  assert.equal(formatearHoraMision(390), '06:30');
  assert.equal(formatearHoraMision(1440), '24:00');
  assert.equal(formatearHoraMision(1476), '24:36');
  assert.equal(formatearHoraMision(1477), '00:00');

  assert.equal(parsearHoraMision('06:30'), 390);
  assert.equal(parsearHoraMision('24:36'), 1476);
  assert.equal(parsearHoraMision('2026-10-12T16:40:00.000Z'), 16 * 60 + 40);

  const rollover = avanzarTiempoMision(42, parsearHoraMision('24:36'), 1);
  assert.deepEqual(rollover, { sol: 43, minutos: 0, cambioSol: true });
  assert.equal(formatearHoraMision(rollover.minutos), '00:00');
});

test('esSuenoProtegido marca la ventana 22:00–06:30 incluyendo 24:00–24:36', () => {
  assert.equal(esSuenoProtegido(parsearHoraMision('21:59')), false);
  assert.equal(esSuenoProtegido(parsearHoraMision('22:00')), true);
  assert.equal(esSuenoProtegido(parsearHoraMision('24:00')), true);
  assert.equal(esSuenoProtegido(parsearHoraMision('24:36')), true);
  assert.equal(esSuenoProtegido(parsearHoraMision('00:00')), true);
  assert.equal(esSuenoProtegido(parsearHoraMision('06:29')), true);
  assert.equal(esSuenoProtegido(parsearHoraMision('06:30')), false);
  assert.equal(esSuenoProtegido(parsearHoraMision('13:30')), false);
});

test('generarTareasJornada genera las 12 tareas diarias y las semanales según el día', () => {
  const jueves = generarTareasJornada({ astronautId: 'ana', sol: 42, diaSemana: 'jueves' });
  const diarias = jueves.filter((t) => t.recurrence === 'daily');
  assert.equal(diarias.length, 12);
  assert.equal(diarias[0].missionTime, '06:30');
  assert.equal(diarias[0].ruta, '/');
  assert.equal(diarias[diarias.length - 1].missionTime, '21:30');
  assert.equal(jueves.filter((t) => t.recurrence === 'weekly').length, 0);

  const lunes = generarTareasJornada({ diaSemana: 'lunes' });
  assert.ok(
    lunes.some(
      (t) =>
        t.recurrence === 'weekly' &&
        t.title === 'Glucosa en ayunas' &&
        t.ruta === '/registrar',
    ),
  );

  const miercoles = generarTareasJornada({ diaSemana: 'miercoles' });
  assert.ok(
    miercoles.some(
      (t) =>
        t.recurrence === 'weekly' &&
        t.title === 'Test visual SANS' &&
        t.ruta === '/registrar#vision',
    ),
  );

  const viernes = generarTareasJornada({ diaSemana: 'viernes' });
  assert.ok(
    viernes.some(
      (t) =>
        t.recurrence === 'weekly' &&
        t.title.includes('Masa corporal y aceptabilidad de comida'),
    ),
  );

  const domingo = generarTareasJornada({ diaSemana: 'domingo' });
  assert.ok(
    domingo.some(
      (t) => t.recurrence === 'weekly' && t.title === 'Encuesta de equipo',
    ),
  );
});

test('agrega controles de temperatura cada 8 h (14:45 y 22:00) ante fiebre o reactivación viral', () => {
  const porFiebre = generarTareasJornada({
    evaluacion: { indicators: { temp: { value: 37.6 } }, alerts: [] },
  });
  const eventosFiebre = porFiebre.filter((t) => t.recurrence === 'event');
  assert.equal(eventosFiebre.length, 2);
  assert.deepEqual(
    eventosFiebre.map((t) => t.missionTime),
    ['14:45', '22:00'],
  );

  const porAlerta = generarTareasJornada({
    evaluacion: { indicators: {}, alerts: [{ ruleId: 'viral_reactivation' }] },
  });
  assert.equal(porAlerta.filter((t) => t.recurrence === 'event').length, 2);

  const normal = generarTareasJornada({
    evaluacion: { indicators: { temp: { value: 36.7 } }, alerts: [] },
  });
  assert.equal(normal.filter((t) => t.recurrence === 'event').length, 0);
});

test('integra y preserva tareasGuardadas de IndexedDB sin duplicar por título', () => {
  const tareasGuardadas = [
    {
      id: 'db-watch',
      astronautId: 'ana',
      kind: 'watch',
      title: '  sincronizar watch  ',
      missionTime: '06:30',
      recurrence: 'daily',
      done: true,
    },
    {
      id: 'db-hisopado',
      astronautId: 'ana',
      kind: 'measure',
      title: 'Hisopado nasal de control (Sol 44)',
      missionTime: '2026-10-12T19:15:00.000Z',
      recurrence: 'event',
      done: false,
    },
    {
      id: 'db-otro-tripulante',
      astronautId: 'marcos',
      kind: 'measure',
      title: 'Tarea exclusiva de Marcos',
      missionTime: '09:00',
      recurrence: 'event',
      done: false,
    },
  ];

  const tareas = generarTareasJornada({
    astronautId: 'ana',
    sol: 42,
    tareasGuardadas,
  });

  const coincidenciasWatch = tareas.filter(
    (t) => t.title.trim().toLowerCase() === 'sincronizar watch',
  );
  assert.equal(coincidenciasWatch.length, 1);
  assert.equal(coincidenciasWatch[0].done, true);
  assert.equal(coincidenciasWatch[0].dbId, 'db-watch');

  const hisopado = tareas.find((t) => t.id === 'db-hisopado');
  assert.ok(hisopado);
  assert.equal(hisopado.missionTime, '19:15');
  assert.equal(hisopado.ruta, '/registrar');
  assert.equal(hisopado.recurrence, 'event');

  assert.equal(
    tareas.some((t) => t.id === 'db-otro-tripulante'),
    false,
  );
});

test('autocompleta tareas con lecturasHoy y calcula estado respecto a la hora', () => {
  const parcial = generarTareasJornada({
    sol: 42,
    lecturasHoy: [
      { sol: 42, source: 'watch_sim', indicator: 'sleep_h', value: 5.5 },
      { sol: 42, source: 'manual', indicator: 'bp_sys', value: 118 },
      { sol: 42, source: 'manual', indicator: 'temp', value: 37.6 },
    ],
  });

  const watch = parcial.find((t) => t.missionTime === '06:30');
  const chequeo = parcial.find((t) => t.missionTime === '06:45');
  assert.equal(watch.done, true);
  assert.equal(chequeo.done, false);

  const completo = generarTareasJornada({
    sol: 42,
    lecturasHoy: [
      { sol: 42, source: 'watch_sim', indicator: 'sleep_h', value: 5.5 },
      { sol: 42, source: 'manual', indicator: 'bp_sys', value: 118 },
      { sol: 42, source: 'manual', indicator: 'temp', value: 37.6 },
      { sol: 42, source: 'manual', indicator: 'mood', value: 3 },
      { sol: 42, source: 'manual', indicator: 'water_ml', value: 350 },
      { sol: 42, source: 'camera', indicator: 'exercise_min', value: 30 },
    ],
  });

  assert.equal(completo.find((t) => t.missionTime === '06:30').done, true);
  assert.equal(completo.find((t) => t.missionTime === '06:45').done, true);
  assert.equal(completo.find((t) => t.missionTime === '07:30').done, true);
  assert.equal(completo.find((t) => t.missionTime === '13:30').done, true);

  assert.equal(estadoTareaRespectoAHora(completo[0], parsearHoraMision('06:30')), 'hecha');
  assert.equal(estadoTareaRespectoAHora(completo[2], parsearHoraMision('07:05')), 'ahora');
  assert.equal(estadoTareaRespectoAHora(completo[2], parsearHoraMision('06:30')), 'pendiente');
  assert.equal(estadoTareaRespectoAHora(completo[2], parsearHoraMision('09:00')), 'pasada');
});
