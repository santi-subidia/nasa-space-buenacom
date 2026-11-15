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
    etiqueta: 'Routine',
    color: 'blue',
    simbolo: '●',
  }),
  alerta: Object.freeze({
    id: 'alerta',
    etiqueta: 'Alert',
    color: 'orange',
    simbolo: '◆',
  }),
  tierra: Object.freeze({
    id: 'tierra',
    etiqueta: 'Earth',
    color: 'violet',
    simbolo: '✦',
  }),
  motivacion: Object.freeze({
    id: 'motivacion',
    etiqueta: 'Motivation',
    color: 'green',
    simbolo: '●',
  }),
});

/** Devuelve el aspecto visual (color y símbolo) según tipo y nivel de alerta. */
export function obtenerAspectoNotificacion(tipo = 'rutina', nivel = 'info') {
  if (tipo === 'alerta' && (nivel === 'red' || nivel === 'critica')) {
    return {
      id: 'alerta',
      etiqueta: 'Alert',
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
    titulo: 'Wake-up · Morning check-in',
    mensaje: 'A new sol begins. Complete your morning check-in.',
    construirMensaje: () => 'A new sol begins. Complete your morning check-in.',
    ruta: '/registrar',
  },
  {
    id: 'chequeo-0645',
    horaMin: 6 * 60 + 45, // 405
    hora: '06:45',
    tipo: 'rutina',
    titulo: 'Time for morning check-in',
    mensaje: '90 s check-in: blood pressure, temperature, mood, and reaction.',
    ruta: '/registrar',
  },
  {
    id: 'cara-0700',
    horaMin: 7 * 60, // 420
    hora: '07:00',
    tipo: 'rutina',
    titulo: 'How do I look today?',
    mensaje: 'Capture your morning photo and blink-rate measurement.',
    ruta: '/cara',
  },
  {
    id: 'agua-0800',
    horaMin: 8 * 60, // 480
    hora: '08:00',
    tipo: 'rutina',
    titulo: 'Hydration reminder',
    mensaje: 'Drink water every 2 h during the work block.',
    ruta: '/registrar',
  },
  {
    id: 'agua-1000',
    horaMin: 10 * 60, // 600
    hora: '10:00',
    tipo: 'rutina',
    titulo: 'Hydration reminder',
    mensaje: 'Drink water every 2 h during the work block.',
    ruta: '/registrar',
  },
  {
    id: 'agua-1200',
    horaMin: 12 * 60, // 720
    hora: '12:00',
    tipo: 'rutina',
    titulo: 'Hydration reminder',
    mensaje: 'Drink water every 2 h during the work block.',
    ruta: '/registrar',
  },
  {
    id: 'almuerzo-viernes-1230',
    horaMin: 12 * 60 + 30, // 750
    hora: '12:30',
    tipo: 'rutina',
    soloDia: 'viernes',
    titulo: 'Friday lunch',
    mensaje: 'Log meal acceptability (1–9) and body mass.',
    ruta: '/registrar',
  },
  {
    id: 'ejercicio-1320',
    horaMin: 13 * 60 + 20, // 800
    hora: '13:20',
    tipo: 'rutina',
    titulo: 'Exercise in 10 min',
    mensaje: 'Set up your station for the camera-guided trainer session.',
    ruta: '/entrenador',
  },
  {
    id: 'tierra-1640',
    horaMin: 16 * 60 + 40, // 1000
    hora: '16:40',
    tipo: 'tierra',
    titulo: 'Earth comm window',
    mensaje: 'Report sent. Reply in ~28 min.',
    ruta: '/enlace',
  },
  {
    id: 'animo-2030',
    horaMin: 20 * 60 + 30, // 1230
    hora: '20:30',
    tipo: 'rutina',
    titulo: 'Voice mood journal',
    mensaje: 'Tell Vega how you are wrapping up the sol (1 min, optional).',
    ruta: '/',
  },
  {
    id: 'modo-noche-2130',
    horaMin: 21 * 60 + 30, // 1290
    hora: '21:30',
    tipo: 'rutina',
    titulo: 'Night mode',
    mensaje: 'Bedtime in 30 min. Dim screen brightness.',
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
      return '/';
    case 'junta':
      return '/enlace';
    case 'enlace':
      return '/enlace';
    case 'entrenador':
      return '/entrenador';
    default:
      return '/enlace';
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
    (esCritica ? 'Critical alert · Notify medical officer' : 'Notify medical officer');
  const mensaje =
    aviso?.motivo ||
    aviso?.mensaje ||
    'A clinical finding was recorded that requires Crew Medical Officer review.';

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
    titulo: 'Flight surgeon reply arrived',
    mensaje: `Sol ${solNum} medical reply available at Mars Base with orders from Houston.`,
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
    titulo: `${dias}-day exercise streak`,
    mensaje: `You completed ${dias} sols in a row meeting the crew fitness target.`,
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

/** Normaliza nombres legados del comandante en textos de notificaciones guardadas. */
export function normalizarTextoTripulante(texto) {
  if (typeof texto !== 'string' || !texto) return texto ?? '';
  return texto.replace(/\bAna Ríos\b/g, 'Nicolás Méndez');
}

/** Resuelve el `astronautId` al que pertenece una notificación (o `null` si es general de misión). */
export function resolverAstronautIdNotificacion(notif) {
  if (!notif || typeof notif !== 'object') return null;
  if (typeof notif.astronautId === 'string' && notif.astronautId.trim()) {
    return notif.astronautId.trim();
  }

  const clave = String(notif.clave || notif.id || '');
  const matchSim = /^sim-alerta-([a-z0-9_-]+)-sol\d+/i.exec(clave);
  if (matchSim) return matchSim[1];

  const titulo = String(notif.titulo || '');
  if (/^Marcos Silva\s*·/i.test(titulo)) return 'marcos';
  if (/^(?:Ana Ríos|Nicolás Méndez)\s*·/i.test(titulo)) return 'ana';

  return null;
}

/** Indica si la notificación corresponde al tripulante activo (o es general sin `astronautId`). */
export function perteneceATripulanteActivo(notif, activoId = null) {
  if (!activoId) return true;
  const propietario = resolverAstronautIdNotificacion(notif);
  return !propietario || propietario === activoId;
}

/** Filtra notificaciones visibles para el tripulante que se está viendo actualmente. */
export function filtrarNotificacionesPorTripulante(lista = [], activoId = null) {
  if (!Array.isArray(lista)) return [];
  return lista.filter((notif) => perteneceATripulanteActivo(notif, activoId));
}

/** Selecciona notificaciones de BD pendientes de emitir que correspondan solo al tripulante activo. */
export function filtrarPendientesDbParaTripulante({
  listaDb = [],
  activoId = null,
  clavesEmitidas = new Set(),
} = {}) {
  if (!Array.isArray(listaDb)) return [];
  const emitidas =
    clavesEmitidas instanceof Set ? clavesEmitidas : new Set(Array.isArray(clavesEmitidas) ? clavesEmitidas : []);
  return listaDb.filter(
    (n) => n?.id && !emitidas.has(n.id) && perteneceATripulanteActivo(n, activoId),
  );
}

/** Selecciona avisos locales pendientes que correspondan al tripulante activo. */
export function filtrarAvisosParaTripulante(
  avisos = [],
  activoId = null,
  avisosProcesados = new Set(),
) {
  if (!Array.isArray(avisos)) return [];
  const procesados =
    avisosProcesados instanceof Set
      ? avisosProcesados
      : new Set(Array.isArray(avisosProcesados) ? avisosProcesados : []);
  return avisos.filter((aviso) => {
    const claveAviso = aviso?.id || aviso?.ts;
    if (!claveAviso || procesados.has(claveAviso)) return false;
    return perteneceATripulanteActivo(aviso, activoId);
  });
}
