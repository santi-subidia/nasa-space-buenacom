import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsearHoraMision } from '../lib/reloj/relojMision.js';
import {
  HITOS_NOTIFICACION_SOL,
  TIPOS_NOTIFICACION,
  construirNotificacionAviso,
  construirNotificacionMotivacion,
  construirNotificacionTierra,
  evaluarHitosHorario,
  obtenerAspectoNotificacion,
  puedeNotificar,
} from '../lib/notificaciones/logicaNotificaciones.js';

test('TIPOS_NOTIFICACION y obtenerAspectoNotificacion cubren los 4 tipos y símbolos ●, ◆, ■, ✦', () => {
  assert.deepEqual(TIPOS_NOTIFICACION.rutina, {
    id: 'rutina',
    etiqueta: 'Rutina',
    color: 'blue',
    simbolo: '●',
  });
  assert.deepEqual(TIPOS_NOTIFICACION.alerta, {
    id: 'alerta',
    etiqueta: 'Alerta',
    color: 'orange',
    simbolo: '◆',
  });
  assert.deepEqual(TIPOS_NOTIFICACION.tierra, {
    id: 'tierra',
    etiqueta: 'Tierra',
    color: 'violet',
    simbolo: '✦',
  });
  assert.deepEqual(TIPOS_NOTIFICACION.motivacion, {
    id: 'motivacion',
    etiqueta: 'Motivación',
    color: 'green',
    simbolo: '●',
  });

  assert.deepEqual(obtenerAspectoNotificacion('alerta', 'orange'), {
    id: 'alerta',
    etiqueta: 'Alerta',
    color: 'orange',
    simbolo: '◆',
  });
  assert.deepEqual(obtenerAspectoNotificacion('alerta', 'red'), {
    id: 'alerta',
    etiqueta: 'Alerta',
    color: 'red',
    simbolo: '■',
  });
  assert.deepEqual(obtenerAspectoNotificacion('alerta', 'critica'), {
    id: 'alerta',
    etiqueta: 'Alerta',
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
  assert.equal(despertar.emitidas[0].titulo, 'Despertar · Sincronizar Watch');
  assert.equal(despertar.emitidas[0].mensaje, 'Tu noche llegó: 5 h 20. Hoy tu chequeo tiene 4 pasos.');
  assert.equal(despertar.emitidas[0].ruta, '/');

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
    '/vega',
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
  assert.equal(viernes.emitidas[0].titulo, 'Almuerzo de viernes');
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
  assert.equal(avisoCriticoSueno.ruta, '/junta');
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
  assert.match(motivacion.titulo, /12 días/);
  assert.equal(motivacion.permitido, true);
});
