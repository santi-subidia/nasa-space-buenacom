import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { esChequeoFacialCompletado } from '../lib/checkin.js';
import {
  getCheckinPorSol,
  getDb,
  getReadings,
  getSymptoms,
  guardarCheckinPorSol,
  guardarChequeoFacial,
  listAiResults,
  resetDb,
} from '../lib/db.js';
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

test('generarTareasJornada genera las 13 tareas diarias y las semanales según el día', () => {
  const jueves = generarTareasJornada({ astronautId: 'ana', sol: 42, diaSemana: 'jueves' });
  const diarias = jueves.filter((t) => t.recurrence === 'daily');
  assert.equal(diarias.length, 13);
  assert.equal(diarias[0].missionTime, '06:30');
  assert.equal(diarias[0].ruta, '/');
  assert.ok(diarias.some((t) => t.missionTime === '09:30' && t.ruta === '/actividad/cognitivos'));
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
        t.ruta === '/actividad/cognitivos#vision',
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

test('sincroniza check-in parcial/foto, tests cognitivos/visuales, cara, agua, ejercicio, voz, enlace y tareas guardadas sin doble checkeo', () => {
  const tareas = generarTareasJornada({
    astronautId: 'ana',
    sol: 42,
    diaSemana: 'miercoles',
    checkinCompletado: true,
    caraCompletada: true,
    enlaceCompletado: true,
    lecturasHoy: [
      { id: 'demo-ana-42-glucose', sol: 42, source: 'manual', indicator: 'glucose', value: 91 },
      { sol: 42, source: 'watch_sim', indicator: 'sleep_h', value: 6.4 },
      { sol: 42, source: 'manual', indicator: 'water_ml', value: 1200 },
      { sol: 42, source: 'manual', indicator: 'reaction_ms', value: 265, ts: '2026-11-15T10:00:00.000Z' },
      { sol: 42, source: 'manual', indicator: 'visual_acuity', value: 2, ts: '2026-11-15T10:05:00.000Z' },
      { sol: 42, source: 'camera', indicator: 'exercise_min', value: 45, ts: '2026-11-15T14:00:00.000Z' },
      { sol: 42, source: 'manual', indicator: 'bp_sys', value: 118, ts: '2026-11-15T15:10:00.000Z' },
      { sol: 42, source: 'voice', indicator: 'mood', value: 4, ts: '2026-11-15T20:30:00.000Z' },
    ],
    tareasGuardadas: [
      { id: 'demo-task-bp', astronautId: 'ana', kind: 'measure', title: 'Medir presión arterial matutina', missionTime: '08:00', recurrence: 'daily', done: false },
      { id: 'demo-task-watch', astronautId: 'ana', kind: 'measure', title: 'Sincronizar Watch nocturno', missionTime: '07:00', recurrence: 'daily', done: false },
      { id: 'demo-task-exercise', astronautId: 'ana', kind: 'exercise', title: 'Completar rutina de fuerza y aeróbico (90 min)', missionTime: '17:00', recurrence: 'daily', done: false },
      { id: 'db-hisopado', astronautId: 'ana', kind: 'measure', title: 'Hisopado nasal de control (Sol 44)', missionTime: '19:15', recurrence: 'event', done: false },
    ],
  });

  const porHora = (h) => tareas.find((t) => t.missionTime === h);
  assert.equal(porHora('06:30').done, true);
  assert.equal(porHora('06:45').done, true);
  assert.equal(porHora('07:00').done, true);
  assert.equal(porHora('07:30').done, true);
  assert.equal(porHora('09:00').done, true);
  assert.equal(porHora('09:30').done, true);
  assert.equal(porHora('10:00').done, true);
  assert.equal(porHora('13:30').done, true);
  assert.equal(porHora('15:00').done, true);
  assert.equal(porHora('16:40').done, true);
  assert.equal(porHora('20:30').done, true);

  assert.equal(tareas.find((t) => t.id === 'demo-task-bp').done, true);
  assert.equal(tareas.find((t) => t.id === 'demo-task-watch').done, true);
  assert.equal(tareas.find((t) => t.id === 'demo-task-exercise').done, true);
  assert.equal(tareas.find((t) => t.id === 'db-hisopado').done, false);

  const lunesSoloDemo = generarTareasJornada({
    astronautId: 'ana',
    sol: 42,
    diaSemana: 'lunes',
    lecturasHoy: [
      { id: 'demo-ana-42-glucose', sol: 42, source: 'manual', indicator: 'glucose', value: 91 },
      { id: 'demo-ana-42-stress', sol: 42, source: 'watch_sim', indicator: 'stress', value: 8 },
    ],
  });
  assert.equal(lunesSoloDemo.find((t) => t.missionTime === '06:30').done, false);
  assert.equal(lunesSoloDemo.find((t) => t.title === 'Glucosa en ayunas').done, false);
});

test('controles de temperatura por evento no se marcan con la fiebre inicial y sí con mediciones posteriores', () => {
  const evaluacionFiebre = { indicators: { temp: { value: 37.8 } }, alerts: [] };

  const trasFiebreInicial = generarTareasJornada({
    sol: 42,
    evaluacion: evaluacionFiebre,
    lecturasHoy: [{ sol: 42, indicator: 'temp', value: 37.8 }],
  });
  assert.equal(trasFiebreInicial.find((t) => t.missionTime === '14:45').done, false);
  assert.equal(trasFiebreInicial.find((t) => t.missionTime === '22:00').done, false);

  const trasControlTarde = generarTareasJornada({
    sol: 42,
    evaluacion: evaluacionFiebre,
    lecturasHoy: [
      { sol: 42, indicator: 'temp', value: 37.8 },
      { sol: 42, indicator: 'temp', value: 37.4 },
    ],
  });
  assert.equal(trasControlTarde.find((t) => t.missionTime === '14:45').done, true);
  assert.equal(trasControlTarde.find((t) => t.missionTime === '22:00').done, false);

  const trasControlNoche = generarTareasJornada({
    sol: 42,
    evaluacion: evaluacionFiebre,
    lecturasHoy: [
      { sol: 42, indicator: 'temp', value: 37.8 },
      { sol: 42, indicator: 'temp', value: 37.4 },
      { sol: 42, indicator: 'temp', value: 36.9 },
    ],
  });
  assert.equal(trasControlNoche.find((t) => t.missionTime === '14:45').done, true);
  assert.equal(trasControlNoche.find((t) => t.missionTime === '22:00').done, true);
});

test('integración IndexedDB: check-in por sol, chequeo facial y transmisión Enlace sincronizan Jornada', async () => {
  await resetDb();
  const ahora = new Date('2026-11-15T09:00:00.000Z');
  await guardarChequeoFacial({
    astronautId: 'ana',
    sol: 42,
    resultado: { ok: true, fatiga: { nivel: 'baja' }, resumen: 'Sin cambios llamativos' },
  });
  await guardarCheckinPorSol(
    {
      astronautId: 'ana',
      sol: 42,
      lecturas: [],
      sintoma: { bodyZone: 'skin', code: 'rash', note: 'Foto solo de check-in' },
    },
    ahora,
  );
  await getDb().transmisionesEnlace.put({
    id: 'tx-sol42-test',
    astronaut_id: 'ana',
    sol: 42,
    enviado_en: ahora.toISOString(),
  });

  const [checkin, lecturas, sintomas, resultadosCara, transmisiones] = await Promise.all([
    getCheckinPorSol('ana', 42),
    getReadings('ana'),
    getSymptoms('ana'),
    listAiResults('face'),
    getDb().transmisionesEnlace.where('astronaut_id').equals('ana').toArray(),
  ]);

  const tareas = generarTareasJornada({
    astronautId: 'ana',
    sol: 42,
    diaSemana: 'jueves',
    lecturasHoy: lecturas,
    sintomasHoy: sintomas,
    checkinCompletado: Boolean(checkin),
    caraCompletada: resultadosCara.some((r) => esChequeoFacialCompletado(r, 'ana', 42)),
    enlaceCompletado: transmisiones.some((t) => t.sol === 42),
  });

  assert.equal(tareas.find((t) => t.missionTime === '06:45').done, true);
  assert.equal(tareas.find((t) => t.missionTime === '07:00').done, true);
  assert.equal(tareas.find((t) => t.missionTime === '16:40').done, true);
  await resetDb();
});
