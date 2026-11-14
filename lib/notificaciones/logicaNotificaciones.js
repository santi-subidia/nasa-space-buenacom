// Lógica pura de notificaciones de jornada y sueño protegido (#12).
// Sin imports `@/` ni APIs de DOM/navegador para poder ejecutarse en `node --test`.

import {
  DURACION_SOL_MIN,
  esSuenoProtegido,
  formatearHoraMision,
  normalizarMinutosSol,
} from '../reloj/relojMision.js';

export const TIPOS_NOTIFICACION = Object.freeze({
  rutina: Object.freeze({
    id: 'rutina',
    etiqueta: 'Rutina',
    color: 'blue',
    simbolo: '●',
  }),
  alerta: Object.freeze({
    id: 'alerta',
    etiqueta: 'Alerta',
    color: 'orange',
    simbolo: '◆',
  }),
  tierra: Object.freeze({
    id: 'tierra',
    etiqueta: 'Tierra',
    color: 'violet',
    simbolo: '✦',
  }),
  motivacion: Object.freeze({
    id: 'motivacion',
    etiqueta: 'Motivación',
    color: 'green',
    simbolo: '●',
  }),
});

/** Devuelve el aspecto visual (color y símbolo) según tipo y nivel de alerta. */
export function obtenerAspectoNotificacion(tipo = 'rutina', nivel = 'info') {
  if (tipo === 'alerta' && (nivel === 'red' || nivel === 'critica')) {
    return {
      id: 'alerta',
      etiqueta: 'Alerta',
      color: 'red',
      simbolo: '■',
    };
  }
  return TIPOS_NOTIFICACION[tipo] ?? TIPOS_NOTIFICACION.rutina;
}

/**
 * Evalúa si una notificación puede emitirse según la ventana de sueño protegido (22:00–06:30).
 * Durante sueño protegido solo se permiten alertas rojas (`red` / `critica`).
 */
export function puedeNotificar({ tipo = 'rutina', nivel = 'info', minutosSol } = {}) {
  const enSueno = Number.isFinite(minutosSol) ? esSuenoProtegido(minutosSol) : false;

  if (!enSueno) {
    return {
      permitido: true,
      conSonido: true,
      motivoBloqueo: null,
    };
  }

  const esAlertaRoja = tipo === 'alerta' && (nivel === 'red' || nivel === 'critica');
  if (esAlertaRoja) {
    return {
      permitido: true,
      conSonido: true,
      motivoBloqueo: null,
    };
  }

  return {
    permitido: false,
    conSonido: false,
    motivoBloqueo: 'sueno_protegido',
  };
}

export const HITOS_NOTIFICACION_SOL = Object.freeze([
  {
    id: 'despertar-0630',
    horaMin: 6 * 60 + 30, // 390
    hora: '06:30',
    tipo: 'rutina',
    titulo: 'Despertar · Sincronizar Watch',
    mensaje: 'Tu noche llegó: 5 h 20. Hoy tu chequeo tiene 4 pasos.',
    construirMensaje: ({ horasSueno = '5 h 20' } = {}) =>
      `Tu noche llegó: ${horasSueno}. Hoy tu chequeo tiene 4 pasos.`,
    ruta: '/',
  },
  {
    id: 'chequeo-0645',
    horaMin: 6 * 60 + 45, // 405
    hora: '06:45',
    tipo: 'rutina',
    titulo: 'Toca el chequeo matutino',
    mensaje: 'Chequeo de 90 s: presión, temperatura, ánimo y reacción.',
    ruta: '/registrar',
  },
  {
    id: 'cara-0700',
    horaMin: 7 * 60, // 420
    hora: '07:00',
    tipo: 'rutina',
    titulo: '¿Cómo me ves hoy?',
    mensaje: 'Capturá tu foto matutina y medición de parpadeo.',
    ruta: '/cara',
  },
  {
    id: 'agua-0800',
    horaMin: 8 * 60, // 480
    hora: '08:00',
    tipo: 'rutina',
    titulo: 'Recordatorio de agua',
    mensaje: 'Hidratación cada 2 h durante el bloque de trabajo.',
    ruta: '/registrar',
  },
  {
    id: 'agua-1000',
    horaMin: 10 * 60, // 600
    hora: '10:00',
    tipo: 'rutina',
    titulo: 'Recordatorio de agua',
    mensaje: 'Hidratación cada 2 h durante el bloque de trabajo.',
    ruta: '/registrar',
  },
  {
    id: 'agua-1200',
    horaMin: 12 * 60, // 720
    hora: '12:00',
    tipo: 'rutina',
    titulo: 'Recordatorio de agua',
    mensaje: 'Hidratación cada 2 h durante el bloque de trabajo.',
    ruta: '/registrar',
  },
  {
    id: 'almuerzo-viernes-1230',
    horaMin: 12 * 60 + 30, // 750
    hora: '12:30',
    tipo: 'rutina',
    soloDia: 'viernes',
    titulo: 'Almuerzo de viernes',
    mensaje: 'Registrá aceptabilidad de la comida (1–9) y masa corporal.',
    ruta: '/registrar',
  },
  {
    id: 'ejercicio-1320',
    horaMin: 13 * 60 + 20, // 800
    hora: '13:20',
    tipo: 'rutina',
    titulo: 'Ejercicio en 10 min',
    mensaje: 'Prepará la estación para tu sesión con el entrenador por cámara.',
    ruta: '/entrenador',
  },
  {
    id: 'tierra-1640',
    horaMin: 16 * 60 + 40, // 1000
    hora: '16:40',
    tipo: 'tierra',
    titulo: 'Ventana con Tierra',
    mensaje: 'Informe enviado. Respuesta en ~28 min.',
    ruta: '/enlace',
  },
  {
    id: 'animo-2030',
    horaMin: 20 * 60 + 30, // 1230
    hora: '20:30',
    tipo: 'rutina',
    titulo: 'Diario de ánimo por voz',
    mensaje: 'Contale a Vega cómo cerrás el sol (1 min, opcional).',
    ruta: '/vega',
  },
  {
    id: 'modo-noche-2130',
    horaMin: 21 * 60 + 30, // 1290
    hora: '21:30',
    tipo: 'rutina',
    titulo: 'Modo noche',
    mensaje: 'En 30 min, a dormir. Bajá el brillo de las pantallas.',
    ruta: '/jornada',
  },
]);

function normalizarDiaSemana(diaSemana = 'jueves') {
  return String(diaSemana)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function construirDesdeHito(hito, { sol, horasSueno }) {
  const aspecto = obtenerAspectoNotificacion(hito.tipo, 'info');
  const clave = `sol${sol}-${hito.id}`;
  const mensaje =
    typeof hito.construirMensaje === 'function'
      ? hito.construirMensaje({ horasSueno })
      : hito.mensaje;

  return {
    id: clave,
    clave,
    hitoId: hito.id,
    tipo: hito.tipo,
    nivel: 'info',
    etiqueta: aspecto.etiqueta,
    color: aspecto.color,
    simbolo: aspecto.simbolo,
    titulo: hito.titulo,
    mensaje,
    ruta: hito.ruta,
    sol,
    minutosSol: hito.horaMin,
    horaMision: formatearHoraMision(hito.horaMin),
    origen: 'horario',
  };
}

/**
 * Evalúa qué hitos horarios ocurrieron entre `minutosAnteriores` y `minutosActuales`
 * (incluyendo saltos largos y rollover de sol `24:36 -> 00:00`), sin repetir claves en `yaEmitidas`.
 */
export function evaluarHitosHorario({
  sol = 42,
  minutosAnteriores,
  minutosActuales,
  diaSemana = 'jueves',
  yaEmitidas = new Set(),
  horasSueno = '5 h 20',
} = {}) {
  const solActual = Number.isFinite(sol) && sol >= 1 ? Math.floor(sol) : 42;
  const diaNormalizado = normalizarDiaSemana(diaSemana);
  const emitidasPrevias =
    yaEmitidas instanceof Set ? yaEmitidas : new Set(Array.isArray(yaEmitidas) ? yaEmitidas : []);

  const hitosAplicables = HITOS_NOTIFICACION_SOL.filter(
    (hito) => !hito.soloDia || hito.soloDia === diaNormalizado,
  );

  const candidatos = [];

  if (minutosAnteriores === undefined || minutosAnteriores === null) {
    const actualNorm = normalizarMinutosSol(minutosActuales);
    for (const hito of hitosAplicables) {
      if (hito.horaMin === actualNorm) {
        candidatos.push({ hito, solHito: solActual });
      }
    }
  } else {
    const prevNorm = normalizarMinutosSol(minutosAnteriores);
    const actualNorm = normalizarMinutosSol(minutosActuales);

    if (actualNorm > prevNorm) {
      for (const hito of hitosAplicables) {
        if (hito.horaMin > prevNorm && hito.horaMin <= actualNorm) {
          candidatos.push({ hito, solHito: solActual });
        }
      }
    } else if (actualNorm < prevNorm) {
      // Rollover de sol: primero el tramo restante del sol anterior y luego [0, actualNorm] del nuevo sol.
      const solAnterior = solActual > 1 ? solActual - 1 : solActual;
      for (const hito of hitosAplicables) {
        if (hito.horaMin > prevNorm && hito.horaMin < DURACION_SOL_MIN) {
          candidatos.push({ hito, solHito: solAnterior });
        }
      }
      for (const hito of hitosAplicables) {
        if (hito.horaMin <= actualNorm) {
          candidatos.push({ hito, solHito: solActual });
        }
      }
    }
  }

  const emitidas = [];
  const bloqueadas = [];
  const nuevasClaves = [];

  for (const { hito, solHito } of candidatos) {
    const notif = construirDesdeHito(hito, { sol: solHito, horasSueno });
    if (emitidasPrevias.has(notif.clave)) continue;

    emitidasPrevias.add(notif.clave);
    nuevasClaves.push(notif.clave);

    const permiso = puedeNotificar({
      tipo: notif.tipo,
      nivel: notif.nivel,
      minutosSol: notif.minutosSol,
    });

    if (permiso.permitido) {
      emitidas.push({
        ...notif,
        permitido: true,
        conSonido: permiso.conSonido,
        motivoBloqueo: null,
      });
    } else {
      bloqueadas.push({
        ...notif,
        permitido: false,
        conSonido: false,
        motivoBloqueo: permiso.motivoBloqueo,
      });
    }
  }

  return {
    emitidas,
    bloqueadas,
    nuevasClaves,
  };
}

function rutaPorOrigenAviso(origen) {
  switch (origen) {
    case 'cara':
      return '/cara';
    case 'vega':
      return '/vega';
    case 'junta':
      return '/junta';
    case 'enlace':
      return '/enlace';
    case 'entrenador':
      return '/entrenador';
    default:
      return '/junta';
  }
}

/** Construye una notificación de tipo `alerta` a partir de un aviso en `useAvisos()`. */
export function construirNotificacionAviso(aviso = {}, minutosSol = 420) {
  const nivel = aviso?.nivel || 'alta';
  const esCritica = nivel === 'red' || nivel === 'critica';
  const aspecto = obtenerAspectoNotificacion('alerta', nivel);
  const minNorm = normalizarMinutosSol(minutosSol);
  const permiso = puedeNotificar({
    tipo: 'alerta',
    nivel,
    minutosSol: minNorm,
  });

  const titulo =
    aviso?.titulo ||
    (esCritica ? 'Alerta crítica · Avisar al oficial médico' : 'Avisar al oficial médico');
  const mensaje =
    aviso?.motivo ||
    aviso?.mensaje ||
    'Se registró un hallazgo clínico que requiere revisión del oficial médico.';

  return {
    id: aviso?.id ? `aviso-${aviso.id}` : `aviso-${Date.now()}`,
    tipo: 'alerta',
    nivel,
    etiqueta: aspecto.etiqueta,
    color: aspecto.color,
    simbolo: aspecto.simbolo,
    titulo,
    mensaje,
    ruta: aviso?.ruta || rutaPorOrigenAviso(aviso?.origen),
    categoria: aviso?.categoria || null,
    origen: aviso?.origen || 'aviso',
    minutosSol: minNorm,
    horaMision: formatearHoraMision(minNorm),
    permitido: permiso.permitido,
    conSonido: permiso.conSonido,
    motivoBloqueo: permiso.motivoBloqueo,
  };
}

/** Construye una notificación de tipo `tierra` cuando llega la respuesta desde Houston. */
export function construirNotificacionTierra({ sol = 42, minutosSol = 1028 } = {}) {
  const solNum = Number.isFinite(sol) && sol >= 1 ? Math.floor(sol) : 42;
  const minNorm = normalizarMinutosSol(minutosSol);
  const aspecto = obtenerAspectoNotificacion('tierra', 'info');
  const permiso = puedeNotificar({
    tipo: 'tierra',
    nivel: 'info',
    minutosSol: minNorm,
  });

  return {
    id: `tierra-sol${solNum}-${minNorm}`,
    tipo: 'tierra',
    nivel: 'info',
    etiqueta: aspecto.etiqueta,
    color: aspecto.color,
    simbolo: aspecto.simbolo,
    titulo: 'Llegó la respuesta de la médica de vuelo',
    mensaje: `Respuesta médica del Sol ${solNum} disponible en Base Marte con indicaciones de Houston.`,
    ruta: '/enlace',
    sol: solNum,
    minutosSol: minNorm,
    horaMision: formatearHoraMision(minNorm),
    origen: 'enlace',
    permitido: permiso.permitido,
    conSonido: permiso.conSonido,
    motivoBloqueo: permiso.motivoBloqueo,
  };
}

/** Construye una notificación de tipo `motivacion` (ej. racha de ejercicio). */
export function construirNotificacionMotivacion({ rachaDias = 12, minutosSol = 450 } = {}) {
  const dias = Number.isFinite(rachaDias) && rachaDias > 0 ? Math.floor(rachaDias) : 12;
  const minNorm = normalizarMinutosSol(minutosSol);
  const aspecto = obtenerAspectoNotificacion('motivacion', 'info');
  const permiso = puedeNotificar({
    tipo: 'motivacion',
    nivel: 'info',
    minutosSol: minNorm,
  });

  return {
    id: `motivacion-racha-${dias}-${minNorm}`,
    tipo: 'motivacion',
    nivel: 'info',
    etiqueta: aspecto.etiqueta,
    color: aspecto.color,
    simbolo: aspecto.simbolo,
    titulo: `Racha de ${dias} días de ejercicio`,
    mensaje: `Completaste ${dias} soles seguidos cumpliendo la meta física de la tripulación.`,
    ruta: '/entrenador',
    rachaDias: dias,
    minutosSol: minNorm,
    horaMision: formatearHoraMision(minNorm),
    origen: 'motivacion',
    permitido: permiso.permitido,
    conSonido: permiso.conSonido,
    motivoBloqueo: permiso.motivoBloqueo,
  };
}
