import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addNotificationDb, getNotificationsDb, resetDb } from '../lib/db.js';
import { parsearHoraMision } from '../lib/reloj/relojMision.js';
import {
  HITOS_NOTIFICACION_SOL,
  TIPOS_NOTIFICACION,
  construirNotificacionAviso,
  construirNotificacionMotivacion,
  construirNotificacionTierra,
  evaluarHitosHorario,
  filtrarAvisosParaTripulante,
  filtrarNotificacionesPorTripulante,
  filtrarPendientesDbParaTripulante,
  normalizarTextoTripulante,
  obtenerAspectoNotificacion,
  puedeNotificar,
  resolverAstronautIdNotificacion,
} from '../lib/notificaciones/logicaNotificaciones.js';

test('TIPOS_NOTIFICACION y obtenerAspectoNotificacion cubren los 4 tipos y símbolos ●, ◆, ■, ✦', () => {
  assert.deepEqual(TIPOS_NOTIFICACION.rutina, {
    id: 'rutina',
    etiqueta: 'Routine',
    color: 'blue',
    simbolo: '●',
  });
  assert.deepEqual(TIPOS_NOTIFICACION.alerta, {
    id: 'alerta',
    etiqueta: 'Alert',
    color: 'orange',
    simbolo: '◆',
  });
  assert.deepEqual(TIPOS_NOTIFICACION.tierra, {
    id: 'tierra',
    etiqueta: 'Earth',
    color: 'violet',
    simbolo: '✦',
  });
  assert.deepEqual(TIPOS_NOTIFICACION.motivacion, {
    id: 'motivacion',
    etiqueta: 'Motivation',
    color: 'green',
    simbolo: '●',
  });

  assert.deepEqual(obtenerAspectoNotificacion('alerta', 'orange'), {
    id: 'alerta',
    etiqueta: 'Alert',
    color: 'orange',
    simbolo: '◆',
  });
  assert.deepEqual(obtenerAspectoNotificacion('alerta', 'red'), {
    id: 'alerta',
    etiqueta: 'Alert',
    color: 'red',
    simbolo: '■',
  });
  assert.deepEqual(obtenerAspectoNotificacion('alerta', 'critica'), {
    id: 'alerta',
    etiqueta: 'Alert',
    color: 'red',
    simbolo: '■',
  });
});

test('sueño protegido (22:00–06:30, incl. 22:00, 24:15 y 03:00) bloquea todo salvo alerta roja', () => {
  const horasSueno = [
    parsearHoraMision('22:00'),
    parsearHoraMision('24:15'),
    parsearHoraMision('03:00'),
    parsearHoraMision('06:29'),
  ];

  for (const minutosSol of horasSueno) {
    assert.deepEqual(puedeNotificar({ tipo: 'rutina', minutosSol }), {
      permitido: false,
      conSonido: false,
      motivoBloqueo: 'sueno_protegido',
    });
    assert.deepEqual(puedeNotificar({ tipo: 'tierra', minutosSol }), {
      permitido: false,
      conSonido: false,
      motivoBloqueo: 'sueno_protegido',
    });
    assert.deepEqual(puedeNotificar({ tipo: 'motivacion', minutosSol }), {
      permitido: false,
      conSonido: false,
      motivoBloqueo: 'sueno_protegido',
    });
    assert.deepEqual(puedeNotificar({ tipo: 'alerta', nivel: 'alta', minutosSol }), {
      permitido: false,
      conSonido: false,
      motivoBloqueo: 'sueno_protegido',
    });
    assert.deepEqual(puedeNotificar({ tipo: 'alerta', nivel: 'orange', minutosSol }), {
      permitido: false,
      conSonido: false,
      motivoBloqueo: 'sueno_protegido',
    });

    assert.deepEqual(puedeNotificar({ tipo: 'alerta', nivel: 'red', minutosSol }), {
      permitido: true,
      conSonido: true,
      motivoBloqueo: null,
    });
    assert.deepEqual(puedeNotificar({ tipo: 'alerta', nivel: 'critica', minutosSol }), {
      permitido: true,
      conSonido: true,
      motivoBloqueo: null,
    });
  }

  // Fuera de sueño protegido (06:30 y 21:59) se permiten todas con sonido
  for (const minutosSol of [parsearHoraMision('06:30'), parsearHoraMision('21:59')]) {
    assert.deepEqual(puedeNotificar({ tipo: 'rutina', minutosSol }), {
      permitido: true,
      conSonido: true,
      motivoBloqueo: null,
    });
    assert.deepEqual(puedeNotificar({ tipo: 'alerta', nivel: 'alta', minutosSol }), {
      permitido: true,
      conSonido: true,
      motivoBloqueo: null,
    });
  }
});

test('evaluarHitosHorario detecta todos los hitos del sol (incl. hidratación y viernes) sin duplicar', () => {
  assert.ok(HITOS_NOTIFICACION_SOL.length >= 11);

  const yaEmitidas = new Set();

  // Despertar inicial exacto a las 06:30
  const despertar = evaluarHitosHorario({
    sol: 42,
    minutosAnteriores: null,
    minutosActuales: parsearHoraMision('06:30'),
    diaSemana: 'jueves',
    yaEmitidas,
    horasSueno: '5 h 20',
  });
  assert.equal(despertar.emitidas.length, 1);
  assert.equal(despertar.emitidas[0].horaMision, '06:30');
  assert.equal(despertar.emitidas[0].titulo, 'Wake-up · Morning check-in');
  assert.equal(despertar.emitidas[0].mensaje, 'A new sol begins. Complete your morning check-in.');
  assert.equal(despertar.emitidas[0].ruta, '/registrar');

  // Avance +60 min (06:30 -> 07:30): 06:45 y 07:00
  const manana = evaluarHitosHorario({
    sol: 42,
    minutosAnteriores: parsearHoraMision('06:30'),
    minutosActuales: parsearHoraMision('07:30'),
    diaSemana: 'jueves',
    yaEmitidas,
  });
  assert.deepEqual(
    manana.emitidas.map((n) => n.horaMision),
    ['06:45', '07:00'],
  );
  assert.equal(manana.emitidas[0].ruta, '/registrar');
  assert.equal(manana.emitidas[1].ruta, '/cara');

  // Re-evaluar el mismo rango no duplica emitidas
  const repetida = evaluarHitosHorario({
    sol: 42,
    minutosAnteriores: parsearHoraMision('06:30'),
    minutosActuales: parsearHoraMision('07:30'),
    diaSemana: 'jueves',
    yaEmitidas,
  });
  assert.equal(repetida.emitidas.length, 0);

  // Salto largo (+240 min y más) en jueves: hidratación 08:00, 10:00, 12:00, ejercicio 13:20, Tierra 16:40, 20:30, 21:30 (sin 12:30 viernes)
  const restoJueves = evaluarHitosHorario({
    sol: 42,
    minutosAnteriores: parsearHoraMision('07:30'),
    minutosActuales: parsearHoraMision('21:45'),
    diaSemana: 'jueves',
    yaEmitidas,
  });
  assert.deepEqual(
    restoJueves.emitidas.map((n) => n.horaMision),
    ['08:00', '10:00', '12:00', '13:20', '16:40', '20:30', '21:30'],
  );
  assert.equal(
    restoJueves.emitidas.find((n) => n.horaMision === '16:40')?.tipo,
    'tierra',
  );
  assert.equal(
    restoJueves.emitidas.find((n) => n.horaMision === '13:20')?.ruta,
    '/entrenador',
  );
  assert.equal(
    restoJueves.emitidas.find((n) => n.horaMision === '20:30')?.ruta,
    '/',
  );
  assert.equal(
    restoJueves.emitidas.find((n) => n.horaMision === '21:30')?.ruta,
    '/jornada',
  );

  // Viernes incluye el hito de las 12:30
  const viernes = evaluarHitosHorario({
    sol: 43,
    minutosAnteriores: parsearHoraMision('12:00'),
    minutosActuales: parsearHoraMision('13:00'),
    diaSemana: 'viernes',
    yaEmitidas: new Set(),
  });
  assert.equal(viernes.emitidas.length, 1);
  assert.equal(viernes.emitidas[0].horaMision, '12:30');
  assert.equal(viernes.emitidas[0].titulo, 'Friday lunch');
  assert.equal(viernes.emitidas[0].ruta, '/registrar');

  // Rollover de sol (21:15 Sol 43 -> 06:45 Sol 44): capta 21:30 de Sol 43 y 06:30/06:45 de Sol 44
  const rollover = evaluarHitosHorario({
    sol: 44,
    minutosAnteriores: parsearHoraMision('21:15'),
    minutosActuales: parsearHoraMision('06:45'),
    diaSemana: 'sabado',
    yaEmitidas: new Set(),
  });
  assert.deepEqual(
    rollover.emitidas.map((n) => `${n.sol}-${n.horaMision}`),
    ['43-21:30', '44-06:30', '44-06:45'],
  );
});

test('constructores reactivos: aviso, Tierra y motivación respetan formato y sueño protegido', () => {
  const avisoNaranja = construirNotificacionAviso(
    {
      id: 'av-1',
      nivel: 'alta',
      categoria: 'cara',
      motivo: 'Leve inflamación periocular.',
      origen: 'cara',
    },
    parsearHoraMision('09:15'),
  );
  assert.equal(avisoNaranja.tipo, 'alerta');
  assert.equal(avisoNaranja.color, 'orange');
  assert.equal(avisoNaranja.simbolo, '◆');
  assert.equal(avisoNaranja.ruta, '/cara');
  assert.equal(avisoNaranja.permitido, true);
  assert.equal(avisoNaranja.conSonido, true);

  const avisoNaranjaSueno = construirNotificacionAviso(
    { id: 'av-2', nivel: 'alta', motivo: 'Seguimiento.', origen: 'vega' },
    parsearHoraMision('23:00'),
  );
  assert.equal(avisoNaranjaSueno.permitido, false);
  assert.equal(avisoNaranjaSueno.motivoBloqueo, 'sueno_protegido');

  const avisoCriticoSueno = construirNotificacionAviso(
    { id: 'av-3', nivel: 'critica', motivo: 'Fiebre alta.', origen: 'junta' },
    parsearHoraMision('24:15'),
  );
  assert.equal(avisoCriticoSueno.color, 'red');
  assert.equal(avisoCriticoSueno.simbolo, '■');
  assert.equal(avisoCriticoSueno.ruta, '/enlace');
  assert.equal(avisoCriticoSueno.permitido, true);
  assert.equal(avisoCriticoSueno.conSonido, true);

  const tierra = construirNotificacionTierra({
    sol: 42,
    minutosSol: parsearHoraMision('17:10'),
  });
  assert.equal(tierra.tipo, 'tierra');
  assert.equal(tierra.color, 'violet');
  assert.equal(tierra.simbolo, '✦');
  assert.equal(tierra.ruta, '/enlace');
  assert.equal(tierra.permitido, true);

  const motivacion = construirNotificacionMotivacion({
    rachaDias: 12,
    minutosSol: parsearHoraMision('15:05'),
  });
  assert.equal(motivacion.tipo, 'motivacion');
  assert.equal(motivacion.color, 'green');
  assert.equal(motivacion.simbolo, '●');
  assert.equal(motivacion.ruta, '/entrenador');
  assert.match(motivacion.titulo, /12-day/);
  assert.equal(motivacion.permitido, true);
});

test('al iniciar y en bandeja solo llegan notificaciones del tripulante activo (más las generales)', async () => {
  await resetDb();
  await addNotificationDb({
    id: 'sim-alerta-ana-sol43-viral',
    astronautId: 'ana',
    sol: 43,
    tipo: 'alerta',
    nivel: 'orange',
    titulo: 'Nicolás Méndez · Posible reactivación viral',
    mensaje: 'Alerta de Nicolás',
    ts: '2026-11-15T10:00:00.000Z',
  });
  await addNotificationDb({
    id: 'sim-alerta-marcos-sol43-sleep',
    astronautId: 'marcos',
    sol: 43,
    tipo: 'alerta',
    nivel: 'yellow',
    titulo: 'Marcos Silva · Sueño bajo',
    mensaje: 'Alerta de Marcos',
    ts: '2026-11-15T10:01:00.000Z',
  });
  await addNotificationDb({
    id: 'mision-cabina-sol43',
    astronautId: null,
    sol: 43,
    tipo: 'rutina',
    nivel: 'info',
    titulo: 'Cabina · Control ambiental',
    mensaje: 'General de la misión',
    ts: '2026-11-15T10:02:00.000Z',
  });

  const dbParaNicolas = await getNotificationsDb('ana');
  assert.deepEqual(
    dbParaNicolas.map((n) => n.id),
    ['mision-cabina-sol43', 'sim-alerta-ana-sol43-viral'],
  );

  const pendientesNicolas = filtrarPendientesDbParaTripulante({
    listaDb: dbParaNicolas,
    activoId: 'ana',
    clavesEmitidas: new Set(),
  });
  assert.deepEqual(
    pendientesNicolas.map((n) => n.id),
    ['mision-cabina-sol43', 'sim-alerta-ana-sol43-viral'],
  );

  // Al cambiar a Marcos, solo aparecen las de Marcos (+ generales), no las de Nicolás
  const dbParaMarcos = await getNotificationsDb('marcos');
  assert.deepEqual(
    dbParaMarcos.map((n) => n.id),
    ['mision-cabina-sol43', 'sim-alerta-marcos-sol43-sleep'],
  );

  // Legadas sin astronautId explícito se infieren por clave o título
  assert.equal(
    resolverAstronautIdNotificacion({ id: 'sim-alerta-marcos-sol44-x', titulo: 'Alerta' }),
    'marcos',
  );
  assert.equal(
    resolverAstronautIdNotificacion({ id: 'x', titulo: 'Marcos Silva · Alerta' }),
    'marcos',
  );
  assert.equal(
    resolverAstronautIdNotificacion({ id: 'x', titulo: 'Ana Ríos · Alerta' }),
    'ana',
  );
  assert.equal(
    normalizarTextoTripulante('Ana Ríos · Posible reactivación viral'),
    'Nicolás Méndez · Posible reactivación viral',
  );

  const mezcladas = [
    { id: '1', astronautId: 'ana', titulo: 'Solo Nicolás' },
    { id: '2', astronautId: 'marcos', titulo: 'Solo Marcos' },
    { id: '3', titulo: 'General de misión' },
    { id: '4', clave: 'sim-alerta-marcos-sol45-test', titulo: 'Legada Marcos' },
  ];
  assert.deepEqual(
    filtrarNotificacionesPorTripulante(mezcladas, 'ana').map((n) => n.id),
    ['1', '3'],
  );
  assert.deepEqual(
    filtrarNotificacionesPorTripulante(mezcladas, 'marcos').map((n) => n.id),
    ['2', '3', '4'],
  );

  const avisos = [
    { id: 'av-ana', astronautId: 'ana', motivo: 'Aviso Nicolás' },
    { id: 'av-marcos', astronautId: 'marcos', motivo: 'Aviso Marcos' },
  ];
  assert.deepEqual(
    filtrarAvisosParaTripulante(avisos, 'ana', new Set()).map((a) => a.id),
    ['av-ana'],
  );
});
