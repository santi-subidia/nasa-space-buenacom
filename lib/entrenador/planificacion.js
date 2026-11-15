import { EJERCICIOS } from './ejercicios.js';

export const EJERCICIO_IDS = Object.freeze(Object.keys(EJERCICIOS));

const RUTINA_SEMANAL = {
  lunes: { enfoque: 'Leg & core strength', ejercicios: ['sentadilla', 'plancha', 'flexion'] },
  martes: { enfoque: 'Upper body & balance', ejercicios: ['flexion', 'zancada', 'plancha'] },
  miercoles: { enfoque: 'Mixed functional endurance', ejercicios: ['sentadilla', 'flexion', 'plancha'] },
  jueves: { enfoque: 'Bone loading & posture', ejercicios: ['sentadilla', 'plancha', 'zancada'] },
  viernes: { enfoque: 'Power & stability', ejercicios: ['flexion', 'sentadilla', 'zancada'] },
  sabado: { enfoque: 'Balance & core control', ejercicios: ['zancada', 'plancha', 'flexion'] },
  domingo: { enfoque: 'Mobility & light activation', ejercicios: ['plancha', 'sentadilla'] },
};

const NOMBRE_DIA = {
  lunes: 'Monday',
  martes: 'Tuesday',
  miercoles: 'Wednesday',
  jueves: 'Thursday',
  viernes: 'Friday',
  sabado: 'Saturday',
  domingo: 'Sunday',
};

const METAS_POR_INTENSIDAD = {
  normal: { sentadilla: 20, flexion: 15, zancada: 16, plancha: 45 },
  moderada: { sentadilla: 14, flexion: 10, zancada: 12, plancha: 35 },
  liviana: { sentadilla: 10, flexion: 6, zancada: 8, plancha: 20 },
  reposo: { sentadilla: 0, flexion: 0, zancada: 0, plancha: 0 },
};

const ALIAS_EJERCICIO = {
  sentadilla: 'sentadilla',
  sentadillas: 'sentadilla',
  squat: 'sentadilla',
  squats: 'sentadilla',
  flexion: 'flexion',
  flexiones: 'flexion',
  pushup: 'flexion',
  pushups: 'flexion',
  'push-up': 'flexion',
  'push-ups': 'flexion',
  zancada: 'zancada',
  zancadas: 'zancada',
  lunge: 'zancada',
  lunges: 'zancada',
  plancha: 'plancha',
  planchas: 'plancha',
  plank: 'plancha',
  planks: 'plancha',
};

const ALIAS_DIA = {
  monday: 'lunes',
  tuesday: 'martes',
  wednesday: 'miercoles',
  thursday: 'jueves',
  friday: 'viernes',
  saturday: 'sabado',
  sunday: 'domingo',
};

function normalizarDia(diaSemana = 'jueves') {
  const limpio = String(diaSemana || 'jueves')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const canonical = ALIAS_DIA[limpio] || limpio;
  return RUTINA_SEMANAL[canonical] ? canonical : 'jueves';
}

export function normalizarIdEjercicio(valor) {
  if (!valor) return null;
  const clave = String(valor)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (EJERCICIOS[clave]) return clave;
  if (ALIAS_EJERCICIO[clave]) return ALIAS_EJERCICIO[clave];
  for (const [alias, id] of Object.entries(ALIAS_EJERCICIO)) {
    if (clave.includes(alias)) return id;
  }
  return null;
}

export function extraerEjerciciosRealizados(lecturasHoy = []) {
  const realizados = new Set();
  let minutosHechos = 0;

  for (const r of lecturasHoy) {
    if (r?.indicator !== 'exercise_min') continue;
    minutosHechos += Number(r.value) || 0;

    const metaEjercicios = r.meta?.ejercicios;
    if (Array.isArray(metaEjercicios)) {
      for (const item of metaEjercicios) {
        const id = normalizarIdEjercicio(item);
        if (id) realizados.add(id);
      }
    } else if (metaEjercicios && typeof metaEjercicios === 'object') {
      for (const [clave, cantidad] of Object.entries(metaEjercicios)) {
        const id = normalizarIdEjercicio(clave);
        if (id && Number(cantidad) > 0) realizados.add(id);
      }
    }

    const nota = String(r.note || '').toLowerCase();
    for (const [alias, id] of Object.entries(ALIAS_EJERCICIO)) {
      if (nota.includes(alias)) realizados.add(id);
    }
  }

  return { realizados, minutosHechos: Math.round(minutosHechos) };
}

function resumenLecturas(lecturasHoy = []) {
  const mapa = {};
  for (const r of lecturasHoy) {
    if (r?.indicator && r.value != null) mapa[r.indicator] = Number(r.value);
  }
  return mapa;
}

function detectarRestricciones(evaluacion, lecturasHoy = []) {
  const alertIds = new Set((evaluacion?.alerts || []).map((a) => a?.id || a?.ruleId).filter(Boolean));
  const nivel = evaluacion?.globalLevel || 'green';
  const vals = resumenLecturas(lecturasHoy);

  const fiebre = Number.isFinite(vals.temp_c) && vals.temp_c >= 38;
  const hipoxia = alertIds.has('hypoxia_co2') || (Number.isFinite(vals.spo2) && vals.spo2 < 90);
  const ortostatico = alertIds.has('orthostatic_pre_landing');
  const trombosis = alertIds.has('jugular_vte');
  const viral = alertIds.has('viral_reactivation') || fiebre;
  const vestibular = alertIds.has('vestibular_instability');
  const suenoBajo = alertIds.has('sleep_deficit_streak') || (Number.isFinite(vals.sleep_h) && vals.sleep_h < 5.5);
  const animoBajo = alertIds.has('mood_low_streak');
  const deficitSemanal = alertIds.has('exercise_deficit_week');
  const cognitivoFatiga = alertIds.has('pvt_cognitive_fatigue') || alertIds.has('sans_visual_change');

  const esReposo = nivel === 'red' || hipoxia || ortostatico || trombosis;
  const esLiviana = !esReposo && (nivel === 'orange' || viral);
  const esModerada = !esReposo && !esLiviana && (nivel === 'yellow' || vestibular || suenoBajo || animoBajo);

  return {
    nivel,
    alertIds,
    esReposo,
    esLiviana,
    esModerada,
    vestibular,
    viral,
    hipoxia,
    ortostatico,
    trombosis,
    suenoBajo,
    animoBajo,
    deficitSemanal,
    cognitivoFatiga,
    vals,
  };
}

function ordenarPorNecesidad(idsBase, restriccion, entorno) {
  const excluidos = new Set();
  if (restriccion.esLiviana || restriccion.vestibular) {
    excluidos.add('zancada');
  }

  let lista = idsBase.filter((id) => EJERCICIOS[id] && !excluidos.has(id));

  if (restriccion.esLiviana) {
    lista = ['plancha', 'sentadilla'];
  } else if (restriccion.vestibular) {
    lista = ['plancha', 'flexion', 'sentadilla'];
  } else if (restriccion.deficitSemanal) {
    const prioridad = ['sentadilla', 'flexion', 'zancada'];
    lista = [...new Set([...prioridad, ...lista])].filter((id) => !excluidos.has(id)).slice(0, 3);
  } else if (entorno === 'zero_g') {
    const prioridad = ['sentadilla', 'plancha', 'flexion'];
    lista = [...new Set([...prioridad, ...lista])].filter((id) => !excluidos.has(id)).slice(0, 3);
  }

  if (!lista.length) {
    lista = ['plancha', 'sentadilla'];
  }
  return lista.slice(0, 3);
}

function construirMotivo({ restriccion, rutina, dia }) {
  const diaEn = NOMBRE_DIA[dia] || dia;
  if (restriccion.esReposo) {
    if (restriccion.hipoxia) return 'Mandatory rest due to cabin respiratory/CO₂ alert.';
    if (restriccion.ortostatico || restriccion.trombosis) return 'Physical rest indicated due to vascular/orthostatic alert.';
    return 'Clinical rest indicated for current health status.';
  }
  if (restriccion.esLiviana) {
    return 'Light load (max 30 min) with no lunges or exertion spikes due to signs of fatigue/reactivation.';
  }
  if (restriccion.vestibular) {
    return 'Stable core & support routine (no lunges) to protect vestibular balance.';
  }
  if (restriccion.suenoBajo) {
    return 'Moderate intensity (60 min) adapted for recent sleep deficit.';
  }
  if (restriccion.deficitSemanal) {
    return `${diaEn} strength and bone-loading priority to catch up on weekly volume.`;
  }
  if (dia === 'domingo') {
    return 'Gentle Sunday activation focused on mobility and stability.';
  }
  return `${diaEn} routine: ${rutina.enfoque.toLowerCase()}.`;
}

export function planificarEjerciciosDelDia({
  diaSemana = 'jueves',
  sol = 42,
  evaluacion = null,
  lecturasHoy = [],
  entorno = 'mars_base',
  tareaEjercicioDone = false,
} = {}) {
  const dia = normalizarDia(diaSemana);
  const rutina = RUTINA_SEMANAL[dia];
  const restriccion = detectarRestricciones(evaluacion, lecturasHoy);
  const { realizados, minutosHechos } = extraerEjerciciosRealizados(lecturasHoy);

  let intensidad = 'normal';
  let minutosObjetivo = 90;
  let limitadoPorSalud = false;

  if (restriccion.esReposo) {
    intensidad = 'reposo';
    minutosObjetivo = 0;
    limitadoPorSalud = true;
  } else if (restriccion.esLiviana) {
    intensidad = 'liviana';
    minutosObjetivo = 30;
    limitadoPorSalud = true;
  } else if (restriccion.esModerada) {
    intensidad = 'moderada';
    minutosObjetivo = 60;
    limitadoPorSalud = true;
  } else if (dia === 'domingo') {
    intensidad = 'moderada';
    minutosObjetivo = 45;
    limitadoPorSalud = false;
  }

  const motivo = construirMotivo({ restriccion, rutina, dia });
  const idsSugeridos = restriccion.esReposo ? [] : ordenarPorNecesidad(rutina.ejercicios, restriccion, entorno);
  const metas = METAS_POR_INTENSIDAD[intensidad] || METAS_POR_INTENSIDAD.normal;
  const minutosRestantes = Math.max(0, minutosObjetivo - minutosHechos);
  const cumplidoGeneral = !restriccion.esReposo && (Boolean(tareaEjercicioDone) || (minutosObjetivo > 0 && minutosHechos >= minutosObjetivo));

  const sugeridos = idsSugeridos.map((id) => {
    const def = EJERCICIOS[id];
    const done = cumplidoGeneral || realizados.has(id);
    return {
      id,
      nombre: def.nombre,
      unidad: def.unidad,
      icono: def.icono,
      consejo: def.consejo,
      meta: metas[id],
      minutosSugeridos: Math.max(10, Math.round(minutosObjetivo / idsSugeridos.length)),
      intensidad,
      motivo,
      done,
      ruta: `/entrenador?ejercicio=${id}`,
    };
  });

  const pendientes = restriccion.esReposo
    ? []
    : sugeridos.filter((item) => !item.done);

  const cognitivosPendientes = [];
  const faltaPvt = restriccion.vals.reaction_ms == null;
  const faltaSnellen = restriccion.vals.visual_acuity == null;
  if ((restriccion.cognitivoFatiga || dia === 'martes' || dia === 'jueves' || dia === 'sabado') && faltaPvt) {
    cognitivosPendientes.push({ id: 'pvt', nombre: 'Reaction test (PVT)', ruta: '/actividad/cognitivos' });
  }
  if ((restriccion.alertIds.has('sans_visual_change') || dia === 'lunes' || dia === 'jueves') && faltaSnellen) {
    cognitivosPendientes.push({ id: 'snellen', nombre: 'Visual acuity (Snellen)', ruta: '/actividad/cognitivos' });
  }

  return {
    sol,
    diaSemana: dia,
    enfoque: rutina.enfoque,
    intensidad,
    minutosObjetivo,
    minutosHechos,
    minutosRestantes,
    reposo: restriccion.esReposo,
    limitadoPorSalud,
    motivo,
    sugeridos,
    pendientes,
    cognitivosPendientes,
    ejerciciosDisponibles: EJERCICIO_IDS,
  };
}

export function filtrarEjerciciosSugeridos(propuestos, contexto = {}) {
  const plan = planificarEjerciciosDelDia(contexto);
  if (plan.reposo) return [];

  const bloqueados = new Set();
  const restriccion = detectarRestricciones(contexto.evaluacion, contexto.lecturasHoy);
  if (restriccion.esLiviana || restriccion.vestibular) {
    bloqueados.add('zancada');
  }

  const validos = [];
  for (const item of Array.isArray(propuestos) ? propuestos : []) {
    const id = normalizarIdEjercicio(item);
    if (id && EJERCICIOS[id] && !bloqueados.has(id) && !validos.includes(id)) {
      validos.push(id);
    }
  }

  if (validos.length) return validos.slice(0, 3);
  return plan.sugeridos.map((item) => item.id);
}
