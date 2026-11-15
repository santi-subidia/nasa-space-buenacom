// Reloj de misión marciano (sol de 24 h 37 min) y generador de jornada (#11).
// Sin imports `@/` ni APIs de navegador para poder correr directo en `node --test`.

import { planificarEjerciciosDelDia } from '../entrenador/planificacion.js';

export const DURACION_SOL_MIN = 24 * 60 + 37; // 1477 min
export const INICIO_SUENO_MIN = 22 * 60; // 22:00 (1320)
export const FIN_SUENO_MIN = 6 * 60 + 30; // 06:30 (390)

export const DIAS_SEMANA = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
];

export const ETIQUETAS_DIA = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

/** Avanza (o retrocede) el día de la semana según `deltaSoles`. */
export function avanzarDiaSemana(diaSemana = 'jueves', deltaSoles = 1) {
  const actual = normalizarDia(diaSemana);
  const idx = DIAS_SEMANA.indexOf(actual);
  const paso = Number.isFinite(deltaSoles) ? Math.trunc(deltaSoles) : 0;
  const nuevoIdx = ((idx + paso) % DIAS_SEMANA.length + DIAS_SEMANA.length) % DIAS_SEMANA.length;
  return DIAS_SEMANA[nuevoIdx];
}

/** Normaliza minutos dentro de un sol marciano (`0 .. 1476`). */
export function normalizarMinutosSol(min) {
  if (!Number.isFinite(min)) return 0;
  const entero = Math.floor(min);
  return ((entero % DURACION_SOL_MIN) + DURACION_SOL_MIN) % DURACION_SOL_MIN;
}

/**
 * Avanza (o retrocede) el reloj marciano en `deltaMin`, haciendo rollover
 * de `24:36` -> `00:00` del sol siguiente al superar 1477 minutos.
 */
export function avanzarTiempoMision(sol = 42, minutos = 0, deltaMin = 0) {
  const solBase = Number.isFinite(sol) ? Math.max(1, Math.floor(sol)) : 1;
  const minBase = Number.isFinite(minutos) ? Math.floor(minutos) : 0;
  const delta = Number.isFinite(deltaMin) ? Math.trunc(deltaMin) : 0;

  const total = minBase + delta;
  const solesDelta = Math.floor(total / DURACION_SOL_MIN);
  const nuevoSol = solBase + solesDelta;

  if (nuevoSol < 1) {
    return { sol: 1, minutos: 0, cambioSol: solBase !== 1 };
  }

  const nuevosMin = normalizarMinutosSol(total);
  return {
    sol: nuevoSol,
    minutos: nuevosMin,
    cambioSol: nuevoSol !== solBase,
  };
}

/** Formatea minutos del sol (`0..1476`) como `'HH:MM'`, soportando `'24:00'`..`'24:36'`. */
export function formatearHoraMision(min) {
  const m = normalizarMinutosSol(min);
  const horas = String(Math.floor(m / 60)).padStart(2, '0');
  const mins = String(m % 60).padStart(2, '0');
  return `${horas}:${mins}`;
}

/**
 * Convierte `'HH:MM'` (o un timestamp ISO 8601) a minutos desde el inicio del sol.
 */
export function parsearHoraMision(hhmm) {
  if (typeof hhmm === 'number') return normalizarMinutosSol(hhmm);
  if (typeof hhmm !== 'string') return 0;

  const texto = hhmm.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(texto);
  if (match) {
    const h = Number(match[1]);
    const m = Number(match[2]);
    return normalizarMinutosSol(h * 60 + m);
  }

  const ms = Date.parse(texto);
  if (!Number.isNaN(ms)) {
    const fecha = new Date(ms);
    return normalizarMinutosSol(fecha.getUTCHours() * 60 + fecha.getUTCMinutes());
  }

  return 0;
}

/** Devuelve `true` durante la ventana de sueño protegido (`22:00–06:30` en sol marciano). */
export function esSuenoProtegido(min) {
  const m = normalizarMinutosSol(min);
  return m >= INICIO_SUENO_MIN || m < FIN_SUENO_MIN;
}

function normalizarDia(diaSemana = 'jueves') {
  return String(diaSemana)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizarTitulo(titulo = '') {
  return String(titulo).trim().toLowerCase().replace(/\s+/g, ' ');
}

function rutaPorKind(kind) {
  switch (kind) {
    case 'measure':
    case 'hydration':
      return '/registrar';
    case 'exercise':
      return '/entrenador';
    case 'camera':
      return '/cara';
    case 'comms':
    case 'report':
      return '/enlace';
    case 'voice':
      return '/';
    case 'watch':
      return '/';
    default:
      return null;
  }
}

const TAREAS_DIARIAS_PLAN = [
  { missionTime: '06:30', kind: 'watch', title: 'Sincronizar Watch', ruta: '/' },
  { missionTime: '06:45', kind: 'measure', title: 'Chequeo matutino', ruta: '/registrar', indicator: 'bp_sys' },
  { missionTime: '07:00', kind: 'camera', title: '¿Cómo me ves hoy?', ruta: '/cara' },
  { missionTime: '07:30', kind: 'hydration', title: 'Desayuno y primer agua', ruta: '/registrar', indicator: 'water_ml' },
  { missionTime: '10:00', kind: 'hydration', title: 'Agua media mañana', ruta: '/registrar', indicator: 'water_ml' },
  { missionTime: '12:30', kind: 'meal', title: 'Almuerzo', ruta: null },
  { missionTime: '13:30', kind: 'exercise', title: 'Ejercicio de 90 min', ruta: '/entrenador', indicator: 'exercise_min' },
  { missionTime: '15:00', kind: 'measure', title: 'Control post-ejercicio', ruta: '/registrar' },
  { missionTime: '16:40', kind: 'comms', title: 'Ventana con Tierra', ruta: '/enlace' },
  { missionTime: '18:00', kind: 'rest', title: 'Tiempo libre / llamada familiar', ruta: null },
  { missionTime: '20:30', kind: 'voice', title: 'Diario de ánimo por voz', ruta: '/', indicator: 'mood' },
  { missionTime: '21:30', kind: 'sleep', title: 'Modo noche', ruta: null },
];

const TAREAS_SEMANALES_PLAN = {
  lunes: [
    { missionTime: '06:40', kind: 'measure', title: 'Glucosa en ayunas', ruta: '/registrar', indicator: 'glucose' },
  ],
  miercoles: [
    { missionTime: '09:00', kind: 'measure', title: 'Test visual SANS', ruta: '/registrar#vision', indicator: 'visual_acuity' },
  ],
  viernes: [
    { missionTime: '12:35', kind: 'measure', title: 'Masa corporal y aceptabilidad de comida', ruta: '/registrar', indicator: 'mass_kg' },
  ],
  domingo: [
    { missionTime: '19:00', kind: 'report', title: 'Encuesta de equipo', ruta: '/' },
  ],
};

function autocompletadoPorLecturas(missionTime, lecturasDelDia) {
  if (!lecturasDelDia.length) return false;
  switch (missionTime) {
    case '06:30':
      return lecturasDelDia.some((r) => r.source === 'watch_sim');
    case '06:45':
      return ['bp_sys', 'temp', 'mood'].every((ind) =>
        lecturasDelDia.some((r) => r.indicator === ind),
      );
    case '07:30':
      return lecturasDelDia.some((r) => r.indicator === 'water_ml' && Number(r.value) > 0);
    case '13:30':
      return lecturasDelDia.some((r) => r.indicator === 'exercise_min' && Number(r.value) > 0);
    default:
      return false;
  }
}

/**
 * Estado relativo de una tarea respecto a la hora actual de misión.
 * @returns {'hecha'|'ahora'|'pendiente'|'pasada'}
 */
export function estadoTareaRespectoAHora(tarea, minutosActuales) {
  if (tarea?.done) return 'hecha';
  const m = normalizarMinutosSol(minutosActuales);
  const ventana = tarea?.kind === 'exercise' ? 90 : 25;
  if (m >= tarea.horaMin && m < tarea.horaMin + ventana) return 'ahora';
  if (m > tarea.horaMin) return 'pasada';
  return 'pendiente';
}

/**
 * Genera la línea de tiempo completa de la jornada del astronauta para un sol y día semanal,
 * integrando alertas clínicas por evento, autocompletado por lecturas del día y tareas de IndexedDB.
 */
export function generarTareasJornada({
  astronautId = 'ana',
  sol = 42,
  diaSemana = 'jueves',
  evaluacion = null,
  lecturasHoy = [],
  tareasGuardadas = [],
  entorno = 'mars_base',
} = {}) {
  const diaKey = normalizarDia(diaSemana);
  const lecturasDelDia = (lecturasHoy || []).filter((r) => r && (r.sol == null || r.sol === sol));
  const guardadasDelTripulante = (tareasGuardadas || []).filter(
    (t) =>
      t &&
      t.title &&
      t.id !== 'demo-task-exercise' &&
      (t.sol == null || t.sol === sol) &&
      (!t.astronautId || t.astronautId === astronautId),
  );

  const planEjercicios = planificarEjerciciosDelDia({
    diaSemana: diaKey,
    sol,
    evaluacion,
    lecturasHoy: lecturasDelDia,
    entorno,
  });

  const guardadaPorId = new Map();
  const guardadaPorTitulo = new Map();
  for (const t of guardadasDelTripulante) {
    if (t.id) guardadaPorId.set(t.id, t);
    const clave = normalizarTitulo(t.title);
    if (!guardadaPorTitulo.has(clave)) guardadaPorTitulo.set(clave, t);
  }

  const base = [];

  for (const item of TAREAS_DIARIAS_PLAN) {
    const horaMin = parsearHoraMision(item.missionTime);
    if (item.missionTime === '13:30') {
      const nombresSugeridos = planEjercicios.sugeridos.map((e) => e.nombre).join(', ');
      base.push({
        id: `${astronautId}-sol${sol}-daily-${item.missionTime.replace(':', '')}`,
        astronautId,
        kind: planEjercicios.reposo ? 'rest' : 'exercise',
        title: planEjercicios.reposo
          ? 'Reposo físico indicado'
          : `Ejercicio ${planEjercicios.intensidad} (${planEjercicios.minutosObjetivo} min): ${nombresSugeridos}`,
        missionTime: item.missionTime,
        horaMin,
        recurrence: 'daily',
        ruta: planEjercicios.reposo ? null : (planEjercicios.sugeridos[0]?.ruta || '/entrenador'),
        ...(!planEjercicios.reposo && item.indicator ? { indicator: item.indicator } : {}),
        ejerciciosSugeridos: planEjercicios.sugeridos,
        intensidad: planEjercicios.intensidad,
        minutosObjetivo: planEjercicios.minutosObjetivo,
        motivoPlan: planEjercicios.motivo,
        done: planEjercicios.reposo ? false : autocompletadoPorLecturas(item.missionTime, lecturasDelDia),
      });
      continue;
    }

    base.push({
      id: `${astronautId}-sol${sol}-daily-${item.missionTime.replace(':', '')}`,
      astronautId,
      kind: item.kind,
      title: item.title,
      missionTime: item.missionTime,
      horaMin,
      recurrence: 'daily',
      ruta: item.ruta,
      ...(item.indicator ? { indicator: item.indicator } : {}),
      done: autocompletadoPorLecturas(item.missionTime, lecturasDelDia),
    });
  }

  for (const item of TAREAS_SEMANALES_PLAN[diaKey] || []) {
    const horaMin = parsearHoraMision(item.missionTime);
    base.push({
      id: `${astronautId}-sol${sol}-weekly-${diaKey}-${item.missionTime.replace(':', '')}`,
      astronautId,
      kind: item.kind,
      title: item.title,
      missionTime: item.missionTime,
      horaMin,
      recurrence: 'weekly',
      ruta: item.ruta,
      ...(item.indicator ? { indicator: item.indicator } : {}),
      done: false,
    });
  }

  const tempActual = evaluacion?.indicators?.temp?.value;
  const hayFiebre = typeof tempActual === 'number' && tempActual >= 37.3;
  const hayReactivacionViral = Boolean(
    evaluacion?.alerts?.some(
      (a) => a?.ruleId === 'viral_reactivation' || a?.id === 'viral_reactivation',
    ),
  );

  if (hayFiebre || hayReactivacionViral) {
    const controles = [
      { missionTime: '14:45', title: 'Control de temperatura cada 8 h (tarde)' },
      { missionTime: '22:00', title: 'Control de temperatura cada 8 h (noche)' },
    ];
    for (const c of controles) {
      base.push({
        id: `${astronautId}-sol${sol}-event-temp-${c.missionTime.replace(':', '')}`,
        astronautId,
        kind: 'measure',
        title: c.title,
        missionTime: c.missionTime,
        horaMin: parsearHoraMision(c.missionTime),
        recurrence: 'event',
        ruta: '/registrar',
        indicator: 'temp',
        done: false,
      });
    }
  }

  const titulosIncluidos = new Set();
  const resultado = [];

  for (const tarea of base) {
    const claveTitulo = normalizarTitulo(tarea.title);
    const guardada = guardadaPorId.get(tarea.id) || guardadaPorTitulo.get(claveTitulo);
    titulosIncluidos.add(claveTitulo);
    resultado.push({
      ...tarea,
      ...(guardada?.id ? { dbId: guardada.id } : {}),
      done: Boolean(tarea.done || guardada?.done),
    });
  }

  for (const saved of guardadasDelTripulante) {
    const claveTitulo = normalizarTitulo(saved.title);
    if (titulosIncluidos.has(claveTitulo)) continue;
    titulosIncluidos.add(claveTitulo);

    const horaMin =
      typeof saved.horaMin === 'number'
        ? normalizarMinutosSol(saved.horaMin)
        : parsearHoraMision(saved.missionTime);

    const esEjercicioGuardado = (saved.kind || 'event') === 'exercise';
    const rutaBase = saved.ruta !== undefined ? saved.ruta : rutaPorKind(saved.kind);
    const rutaFinal = esEjercicioGuardado && (!rutaBase || rutaBase === '/entrenador')
      ? (planEjercicios.sugeridos[0]?.ruta || '/entrenador')
      : rutaBase;

    resultado.push({
      id: saved.id || `${astronautId}-sol${sol}-saved-${horaMin}`,
      dbId: saved.id,
      astronautId: saved.astronautId || astronautId,
      kind: saved.kind || 'event',
      title: saved.title,
      missionTime: formatearHoraMision(horaMin),
      horaMin,
      recurrence: saved.recurrence || 'event',
      ruta: rutaFinal,
      ...(saved.indicator ? { indicator: saved.indicator } : {}),
      ...(esEjercicioGuardado
        ? {
            ejerciciosSugeridos: planEjercicios.sugeridos,
            intensidad: planEjercicios.intensidad,
            motivoPlan: planEjercicios.motivo,
          }
        : {}),
      done: esEjercicioGuardado
        ? Boolean(saved.done || planEjercicios.reposo || autocompletadoPorLecturas('13:30', lecturasDelDia))
        : Boolean(saved.done),
      guardada: true,
    });
  }

  const ordenRecurrencia = { daily: 0, weekly: 1, event: 2 };
  return resultado.sort((a, b) => {
    if (a.horaMin !== b.horaMin) return a.horaMin - b.horaMin;
    const recDiff = (ordenRecurrencia[a.recurrence] ?? 9) - (ordenRecurrencia[b.recurrence] ?? 9);
    if (recDiff !== 0) return recDiff;
    return a.title.localeCompare(b.title);
  });
}
