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
  lunes: 'Monday',
  martes: 'Tuesday',
  miercoles: 'Wednesday',
  jueves: 'Thursday',
  viernes: 'Friday',
  sabado: 'Saturday',
  domingo: 'Sunday',
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
    case 'cognitive':
      return '/actividad/cognitivos';
    case 'exercise':
      return '/entrenador';
    case 'camera':
      return '/cara';
    case 'comms':
    case 'report':
      return '/enlace';
    case 'voice':
      return '/';
    default:
      return null;
  }
}

const TAREAS_DIARIAS_PLAN = [
  { missionTime: '06:45', kind: 'measure', title: 'Morning check-in', ruta: '/registrar', indicator: 'bp_sys' },
  { missionTime: '07:00', kind: 'camera', title: 'How do I look today?', ruta: '/cara' },
  { missionTime: '07:30', kind: 'hydration', title: 'Breakfast & first water', ruta: '/registrar', indicator: 'water_ml' },
  { missionTime: '09:30', kind: 'cognitive', title: 'Cognitive & balance test (PVT)', ruta: '/actividad/cognitivos', indicator: 'reaction_ms' },
  { missionTime: '10:00', kind: 'hydration', title: 'Mid-morning hydration', ruta: '/registrar', indicator: 'water_ml' },
  { missionTime: '12:30', kind: 'meal', title: 'Lunch', ruta: null },
  { missionTime: '13:30', kind: 'exercise', title: '90 min exercise', ruta: '/entrenador', indicator: 'exercise_min' },
  { missionTime: '15:00', kind: 'measure', title: 'Post-exercise check', ruta: '/registrar' },
  { missionTime: '16:40', kind: 'comms', title: 'Earth comm window', ruta: '/enlace' },
  { missionTime: '18:00', kind: 'rest', title: 'Free time / family call', ruta: null },
  { missionTime: '20:30', kind: 'voice', title: 'Voice mood journal', ruta: '/', indicator: 'mood' },
  { missionTime: '21:30', kind: 'sleep', title: 'Night mode', ruta: null },
];

const TAREAS_SEMANALES_PLAN = {
  lunes: [
    { missionTime: '06:40', kind: 'measure', title: 'Fasting glucose', ruta: '/registrar', indicator: 'glucose' },
  ],
  miercoles: [
    { missionTime: '09:00', kind: 'measure', title: 'SANS visual test', ruta: '/actividad/cognitivos#vision', indicator: 'visual_acuity' },
  ],
  viernes: [
    { missionTime: '12:35', kind: 'measure', title: 'Body mass & meal acceptability', ruta: '/registrar', indicator: 'mass_kg' },
  ],
  domingo: [
    { missionTime: '19:00', kind: 'report', title: 'Team survey', ruta: '/' },
  ],
};

const INDICADORES_CONTROL_POST_EJERCICIO = new Set(['bp_sys', 'hr_rest', 'temp', 'spo2']);

function esRegistroDemo(registro) {
  return String(registro?.id || '').startsWith('demo-');
}

function crearContextoActividades({
  lecturasDelDia = [],
  sintomasDelDia = [],
  checkinCompletado = false,
  caraCompletada = false,
  enlaceCompletado = false,
}) {
  const lecturasActividad = lecturasDelDia.filter((r) => !esRegistroDemo(r));
  const sintomasActividad = sintomasDelDia.filter((s) => !esRegistroDemo(s));
  const tomasAgua = lecturasActividad.filter((r) => r.indicator === 'water_ml' && Number(r.value) > 0);
  const totalAgua = tomasAgua.reduce((acc, r) => acc + Number(r.value || 0), 0);
  const lecturaEjercicio = lecturasActividad.find(
    (r) => r.indicator === 'exercise_min' && Number(r.value) > 0,
  );
  const hayControlPostEjercicio = Boolean(
    lecturaEjercicio &&
      lecturasActividad.some(
        (r) =>
          r !== lecturaEjercicio &&
          r.source !== 'watch_sim' &&
          INDICADORES_CONTROL_POST_EJERCICIO.has(r.indicator) &&
          (!lecturaEjercicio.ts || !r.ts || r.ts >= lecturaEjercicio.ts),
      ),
  );

  return {
    lecturasActividad,
    hayCheckin: Boolean(
      checkinCompletado ||
        lecturasActividad.some((r) => Boolean(r.checkinFecha)) ||
        sintomasActividad.some((s) => Boolean(s.checkinFecha)),
    ),
    hayCara: Boolean(
      caraCompletada ||
        lecturasActividad.some((r) => r.indicator === 'hr_rest' && r.source === 'camera'),
    ),
    hayEnlace: Boolean(enlaceCompletado),
    tomasAgua,
    totalAgua,
    hayEjercicio: Boolean(lecturaEjercicio),
    hayControlPostEjercicio,
    tempsNoDemo: lecturasActividad.filter((r) => r.indicator === 'temp'),
  };
}

/** Determina si una tarea (planificada o guardada) ya fue cumplida por una actividad real del día. */
function tareaCompletadaPorActividad(tarea, ctx) {
  if (!tarea) return false;
  const id = String(tarea.id || '');
  const titulo = normalizarTitulo(tarea.title);
  const kind = tarea.kind;
  const indicator = tarea.indicator;
  const missionTime = tarea.missionTime;

  if (missionTime === '06:45' || titulo.includes('morning check-in') || titulo.includes('chequeo matutino')) {
    return (
      ctx.hayCheckin ||
      ['bp_sys', 'temp', 'mood'].every((ind) => ctx.lecturasActividad.some((r) => r.indicator === ind))
    );
  }
  if (missionTime === '07:00' || kind === 'camera' || titulo.includes('how do i look') || titulo.includes('como me ves')) {
    return ctx.hayCara;
  }
  if (missionTime === '07:30') {
    return ctx.tomasAgua.length >= 1;
  }
  if (missionTime === '10:00') {
    return ctx.tomasAgua.length >= 2 || ctx.totalAgua >= 1000;
  }
  if (kind === 'hydration') {
    return ctx.tomasAgua.length >= 1;
  }
  if (missionTime === '15:00' || titulo.includes('post-exercise') || titulo.includes('post-ejercicio')) {
    return ctx.hayControlPostEjercicio;
  }
  if (kind === 'exercise' || (missionTime === '13:30' && kind !== 'rest')) {
    return ctx.hayEjercicio;
  }
  if (missionTime === '16:40' || kind === 'comms' || titulo.includes('earth comm window') || titulo.includes('ventana con tierra')) {
    return ctx.hayEnlace;
  }
  if (missionTime === '20:30' || kind === 'voice' || titulo.includes('voice mood journal') || titulo.includes('diario de animo por voz')) {
    return ctx.lecturasActividad.some((r) => r.indicator === 'mood' && r.source === 'voice');
  }
  if (
    tarea.recurrence === 'event' &&
    (indicator === 'temp' || id.includes('temp') || titulo.includes('temperature') || titulo.includes('temperatura'))
  ) {
    if (missionTime === '22:00' || titulo.includes('night') || titulo.includes('noche')) {
      return ctx.tempsNoDemo.length >= 3;
    }
    return ctx.tempsNoDemo.length >= 2;
  }
  if (id === 'demo-task-bp' || titulo.includes('blood pressure') || titulo.includes('presion arterial')) {
    return ctx.lecturasActividad.some((r) => r.indicator === 'bp_sys');
  }
  if (indicator === 'reaction_ms' || kind === 'cognitive' || titulo.includes('cognitive') || titulo.includes('cognitivo')) {
    return ctx.lecturasActividad.some((r) => r.indicator === 'reaction_ms');
  }
  if (indicator === 'visual_acuity' || titulo.includes('visual')) {
    return ctx.lecturasActividad.some((r) => r.indicator === 'visual_acuity');
  }
  if (indicator === 'glucose' || titulo.includes('glucose') || titulo.includes('glucosa')) {
    return ctx.lecturasActividad.some((r) => r.indicator === 'glucose');
  }
  if (indicator === 'mass_kg' || titulo.includes('body mass') || titulo.includes('masa corporal')) {
    return ctx.lecturasActividad.some((r) => r.indicator === 'mass_kg' || r.indicator === 'kcal');
  }
  if (indicator) {
    return ctx.lecturasActividad.some((r) => r.indicator === indicator);
  }
  return false;
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
  sintomasHoy = [],
  checkinCompletado = false,
  caraCompletada = false,
  enlaceCompletado = false,
} = {}) {
  const diaKey = normalizarDia(diaSemana);
  const lecturasDelDia = (lecturasHoy || []).filter((r) => r && (r.sol == null || r.sol === sol));
  const sintomasDelDia = (sintomasHoy || []).filter((s) => s && (s.sol == null || s.sol === sol));
  const ctx = crearContextoActividades({
    lecturasDelDia,
    sintomasDelDia,
    checkinCompletado,
    caraCompletada,
    enlaceCompletado,
  });
  const guardadasDelTripulante = (tareasGuardadas || []).filter(
    (t) =>
      t &&
      t.title &&
      t.id !== 'demo-task-exercise' &&
      t.id !== 'demo-task-watch' &&
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
      const etiquetaIntensidad = {
        normal: 'normal',
        moderada: 'moderate',
        liviana: 'light',
        reposo: 'rest',
      }[planEjercicios.intensidad] || planEjercicios.intensidad;
      const tarea = {
        id: `${astronautId}-sol${sol}-daily-${item.missionTime.replace(':', '')}`,
        astronautId,
        kind: planEjercicios.reposo ? 'rest' : 'exercise',
        title: planEjercicios.reposo
          ? 'Physical rest ordered'
          : `Exercise: ${etiquetaIntensidad} (${planEjercicios.minutosObjetivo} min): ${nombresSugeridos}`,
        missionTime: item.missionTime,
        horaMin,
        recurrence: 'daily',
        ruta: planEjercicios.reposo ? null : (planEjercicios.sugeridos[0]?.ruta || '/entrenador'),
        ...(!planEjercicios.reposo && item.indicator ? { indicator: item.indicator } : {}),
        ejerciciosSugeridos: planEjercicios.sugeridos,
        intensidad: planEjercicios.intensidad,
        minutosObjetivo: planEjercicios.minutosObjetivo,
        motivoPlan: planEjercicios.motivo,
      };
      base.push({
        ...tarea,
        done: planEjercicios.reposo ? false : tareaCompletadaPorActividad(tarea, ctx),
      });
      continue;
    }

    const tarea = {
      id: `${astronautId}-sol${sol}-daily-${item.missionTime.replace(':', '')}`,
      astronautId,
      kind: item.kind,
      title: item.title,
      missionTime: item.missionTime,
      horaMin,
      recurrence: 'daily',
      ruta: item.ruta,
      ...(item.indicator ? { indicator: item.indicator } : {}),
    };
    base.push({
      ...tarea,
      done: tareaCompletadaPorActividad(tarea, ctx),
    });
  }

  for (const item of TAREAS_SEMANALES_PLAN[diaKey] || []) {
    const horaMin = parsearHoraMision(item.missionTime);
    const tarea = {
      id: `${astronautId}-sol${sol}-weekly-${diaKey}-${item.missionTime.replace(':', '')}`,
      astronautId,
      kind: item.kind,
      title: item.title,
      missionTime: item.missionTime,
      horaMin,
      recurrence: 'weekly',
      ruta: item.ruta,
      ...(item.indicator ? { indicator: item.indicator } : {}),
    };
    base.push({
      ...tarea,
      done: tareaCompletadaPorActividad(tarea, ctx),
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
      { missionTime: '14:45', title: 'Temperature check every 8 h (afternoon)' },
      { missionTime: '22:00', title: 'Temperature check every 8 h (night)' },
    ];
    for (const c of controles) {
      const tarea = {
        id: `${astronautId}-sol${sol}-event-temp-${c.missionTime.replace(':', '')}`,
        astronautId,
        kind: 'measure',
        title: c.title,
        missionTime: c.missionTime,
        horaMin: parsearHoraMision(c.missionTime),
        recurrence: 'event',
        ruta: '/registrar',
        indicator: 'temp',
      };
      base.push({
        ...tarea,
        done: tareaCompletadaPorActividad(tarea, ctx),
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

    const tareaGuardada = {
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
      guardada: true,
    };
    const aplicaSolActual = saved.sol == null || saved.sol === sol;
    resultado.push({
      ...tareaGuardada,
      done: Boolean(
        saved.done ||
          (esEjercicioGuardado && planEjercicios.reposo) ||
          (aplicaSolActual && tareaCompletadaPorActividad(tareaGuardada, ctx)),
      ),
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
