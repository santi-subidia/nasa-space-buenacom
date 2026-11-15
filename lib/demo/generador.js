// Generador determinista de datos de demostración ("60 soles en Marte", issue #4).
// Sin dependencias de navegador para poder usarse en scripts, build y `node --test`.

export const SOL_ACTUAL = 42;
export const SOLES_MISION = 60;
export const SOL_EVENTO = 41;

export const MISION_BASE = {
  id: 'ares-iv',
  nombre: 'Ares IV · Mars Base',
  entorno: 'mars_base',
  solActual: SOL_ACTUAL,
  totalSoles: SOLES_MISION,
  retrasoMin: 14,
};

export const TRIPULANTES = [
  {
    id: 'ana',
    name: 'Nicolás Méndez',
    role: 'crew',
    titulo: 'Mission Commander',
    baseline: {
      bp_sys: 118,
      bp_dia: 76,
      hr_rest: 64,
      glucose: 86,
      temp: 36.7,
      sleep_h: 7.8,
      mood: 4,
      spo2: 98,
      water_ml: 2150,
      exercise_min: 90,
      stress: 3,
      visual_acuity: 92,
      reaction_ms: 265,
      resp_rate: 15,
      muscle_mass_pct: 100,
      bone_density_pct: 100,
      microgravity_adapt: 90,
      isolation_score: 2,
    },
  },
  {
    id: 'marcos',
    name: 'Marcos Silva',
    role: 'cmo',
    titulo: 'Crew Medical Officer (CMO)',
    baseline: {
      bp_sys: 116,
      bp_dia: 74,
      hr_rest: 60,
      glucose: 84,
      temp: 36.6,
      sleep_h: 7.6,
      mood: 5,
      spo2: 98,
      water_ml: 2200,
      exercise_min: 90,
      stress: 2,
      visual_acuity: 94,
      reaction_ms: 250,
      resp_rate: 14,
      muscle_mass_pct: 100,
      bone_density_pct: 100,
      microgravity_adapt: 94,
      isolation_score: 2,
    },
  },
];

// SVG educativo mínimo para adjuntar como foto de ejemplo del herpes labial del sol 41.
export const FOTO_DEMO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220">' +
  '<rect width="320" height="220" rx="18" fill="#1b2232"/>' +
  '<ellipse cx="160" cy="112" rx="76" ry="54" fill="#d9a58b"/>' +
  '<path d="M126 126 Q160 142 194 126" fill="none" stroke="#9e5a52" stroke-width="8" stroke-linecap="round"/>' +
  '<circle cx="190" cy="126" r="10" fill="#e06c4d" opacity="0.9"/>' +
  '<circle cx="190" cy="126" r="16" fill="none" stroke="#ff9f43" stroke-width="2" stroke-dasharray="4 3"/>' +
  '<text x="160" y="196" fill="#cfd8e3" font-family="sans-serif" font-size="13" text-anchor="middle">Sol 41 Sample · Perioral area</text>' +
  '</svg>';

function mulberry32(semilla) {
  let t = semilla >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const r = (n, dec = 1) => Number(n.toFixed(dec));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Fecha ISO sintética pero creciente para los 60 soles de misión (sol 1 = 2026-09-01).
export function missionTs(sol, hora = 7, minuto = 30) {
  const baseMs = Date.UTC(2026, 8, 1, hora, minuto, 0);
  return new Date(baseMs + (sol - 1) * 86_400_000).toISOString();
}

const UNIDAD = {
  bp_sys: 'mmHg',
  bp_dia: 'mmHg',
  hr_rest: 'bpm',
  glucose: 'mg/dL',
  temp: '°C',
  sleep_h: 'h',
  mood: '1–5',
  spo2: '%',
  water_ml: 'ml',
  exercise_min: 'min',
  stress: '1–10',
  reaction_ms: 'ms',
  resp_rate: 'breaths/min',
  muscle_mass_pct: '%',
  bone_density_pct: '%',
  microgravity_adapt: '%',
  isolation_score: '1–10',
};

function generarSolAna(sol, rand) {
  const ruido = (amp) => (rand() - 0.5) * 2 * amp;

  if (sol === 41) {
    return {
      bp_sys: 118,
      bp_dia: 76,
      hr_rest: 74,
      glucose: 92,
      temp: 37.6,
      sleep_h: 5.3,
      mood: 3,
      spo2: 97,
      water_ml: 1850,
      exercise_min: 45,
      stress: 8,
      reaction_ms: 342,
      resp_rate: 18,
      muscle_mass_pct: 96.8,
      bone_density_pct: 98.1,
      microgravity_adapt: 86,
      isolation_score: 3,
    };
  }

  if (sol === 42) {
    // Sol 42 es "hoy": valores de base/seguimiento iniciales antes de la sincronización del Watch y registro manual.
    return {
      stress: 8,
      glucose: 91,
    };
  }

  // Soles 31–40: sobrecarga operativa -> sueño ~5.5 h y estrés 7–8.
  if (sol >= 31 && sol <= 40) {
    const progreso = clamp((sol - 30) / 5, 0.35, 1);
    return {
      bp_sys: Math.round(118 + ruido(3)),
      bp_dia: Math.round(76 + ruido(2)),
      hr_rest: Math.round(66 + progreso * 5 + ruido(1.5)),
      temp: r(36.7 + progreso * 0.25 + ruido(0.1), 1),
      sleep_h: r(clamp(6.4 - progreso * 0.9 + ruido(0.25), 5.1, 6.6), 1),
      mood: sol >= 35 ? 3 : 4,
      spo2: Math.round(clamp(98 + ruido(1), 96, 99)),
      water_ml: Math.round(2050 + ruido(150)),
      exercise_min: Math.round(clamp(75 + ruido(10), 60, 90)),
      stress: clamp(Math.round(6.6 + progreso * 1.4 + ruido(0.5)), 7, 8),
      reaction_ms: Math.round(clamp(285 + progreso * 48 + ruido(10), 265, 345)),
      resp_rate: r(clamp(16 + progreso * 2 + ruido(0.6), 15, 19), 1),
      muscle_mass_pct: r(clamp(97.6 - progreso * 0.6 + ruido(0.2), 96.5, 98.2), 1),
      bone_density_pct: r(clamp(98.5 - progreso * 0.3 + ruido(0.1), 98.0, 98.9), 1),
      microgravity_adapt: Math.round(clamp(84 + progreso * 2 + ruido(1.5), 82, 88)),
      isolation_score: 3,
      ...(sol % 7 === 0 ? { glucose: Math.round(88 + ruido(4)) } : {}),
    };
  }

  // Soles 43–45: recuperación tras intervención del CMO (desbloquea "Ritmo recuperado").
  if (sol >= 43 && sol <= 45) {
    const step = sol - 42; // 1, 2, 3
    return {
      bp_sys: Math.round(118 + ruido(2)),
      bp_dia: Math.round(76 + ruido(2)),
      hr_rest: Math.round(72 - step * 2 + ruido(1)),
      temp: r(37.2 - step * 0.15 + ruido(0.05), 1),
      sleep_h: r(7.1 + step * 0.25 + ruido(0.1), 1),
      mood: step >= 2 ? 4 : 3,
      spo2: 98,
      water_ml: Math.round(2150 + ruido(100)),
      exercise_min: 70 + step * 5,
      stress: Math.max(3, 6 - step),
      reaction_ms: Math.round(315 - step * 15 + ruido(8)),
      resp_rate: r(16.5 - step * 0.4 + ruido(0.4), 1),
      muscle_mass_pct: r(97.0 + step * 0.2 + ruido(0.1), 1),
      bone_density_pct: r(98.2 + ruido(0.1), 1),
      microgravity_adapt: Math.round(87 + step * 1.5),
      isolation_score: step >= 2 ? 2 : 3,
    };
  }

  // Soles 1–30 y 46–60: nominal en verde alrededor de la línea base.
  return {
    bp_sys: Math.round(118 + ruido(3)),
    bp_dia: Math.round(76 + ruido(2)),
    hr_rest: Math.round(64 + ruido(2)),
    temp: r(36.7 + ruido(0.15), 1),
    sleep_h: r(clamp(7.8 + ruido(0.4), 7.1, 8.6), 1),
    mood: rand() > 0.35 ? 5 : 4,
    spo2: Math.round(clamp(98 + ruido(1), 97, 99)),
    water_ml: Math.round(2180 + ruido(140)),
    exercise_min: Math.round(clamp(88 + ruido(8), 75, 98)),
    stress: clamp(Math.round(3 + ruido(1)), 2, 4),
    reaction_ms: Math.round(clamp(265 + ruido(14), 240, 295)),
    resp_rate: r(clamp(15 + ruido(1), 13, 17), 1),
    muscle_mass_pct: r(clamp(98.4 - (sol * 0.02) + ruido(0.2), 97.2, 99.2), 1),
    bone_density_pct: r(clamp(99.0 - (sol * 0.015) + ruido(0.1), 98.1, 99.5), 1),
    microgravity_adapt: Math.round(clamp(82 + Math.min(10, sol * 0.2) + ruido(2), 80, 94)),
    isolation_score: 2,
    ...(sol % 7 === 0 ? { glucose: Math.round(85 + ruido(4)) } : {}),
  };
}

function generarSolMarcos(sol, rand) {
  const ruido = (amp) => (rand() - 0.5) * 2 * amp;
  return {
    bp_sys: Math.round(116 + ruido(3)),
    bp_dia: Math.round(74 + ruido(2)),
    hr_rest: Math.round(60 + ruido(2)),
    temp: r(36.6 + ruido(0.12), 1),
    sleep_h: r(clamp(7.6 + ruido(0.35), 7.1, 8.3), 1),
    mood: rand() > 0.25 ? 5 : 4,
    spo2: 98,
    water_ml: Math.round(2220 + ruido(120)),
    exercise_min: Math.round(clamp(90 + ruido(6), 80, 98)),
    stress: clamp(Math.round(2.5 + ruido(0.7)), 1, 4),
    reaction_ms: Math.round(clamp(250 + ruido(12), 230, 275)),
    resp_rate: r(clamp(14 + ruido(0.8), 12.5, 16), 1),
    muscle_mass_pct: r(clamp(98.9 - sol * 0.01 + ruido(0.15), 98.0, 99.6), 1),
    bone_density_pct: r(clamp(99.2 - sol * 0.008 + ruido(0.1), 98.5, 99.6), 1),
    microgravity_adapt: Math.round(clamp(88 + Math.min(8, sol * 0.15) + ruido(1.5), 85, 96)),
    isolation_score: 2,
    ...(sol % 7 === 0 ? { glucose: Math.round(84 + ruido(3)) } : {}),
  };
}

const FUENTES_WATCH = new Set(['sleep_h', 'hr_rest', 'spo2']);

/**
 * Lecturas que carga el botón "Sincronizar Watch" para la noche del sol dado.
 */
export function lecturasNocheWatch(sol = SOL_ACTUAL, astronautId = 'ana') {
  return [
    {
      astronautId,
      indicator: 'sleep_h',
      value: 5.5,
      unit: 'h',
      sol,
      source: 'watch_sim',
      ts: missionTs(sol, 6, 45),
      note: 'Watch nocturnal log (4 cycles, fragmented sleep)',
    },
    {
      astronautId,
      indicator: 'hr_rest',
      value: 74,
      unit: 'bpm',
      sol,
      source: 'watch_sim',
      ts: missionTs(sol, 6, 45),
      note: 'Resting HR +10 above baseline · HRV 34 ms',
    },
    {
      astronautId,
      indicator: 'spo2',
      value: 97,
      unit: '%',
      sol,
      source: 'watch_sim',
      ts: missionTs(sol, 6, 45),
      note: 'Watch nocturnal oximetry',
    },
    {
      astronautId,
      indicator: 'temp',
      value: 37.6,
      unit: '°C',
      sol,
      source: 'watch_sim',
      ts: missionTs(sol, 6, 45),
      note: 'Wrist temperature (+0.9 °C above baseline)',
    },
  ];
}

/**
 * Genera el conjunto completo de 60 soles deterministas para ambos tripulantes.
 */
export function generarDemo(semilla = 42) {
  const randAna = mulberry32(semilla);
  const randMarcos = mulberry32(semilla + 101);
  const readings = [];

  for (let sol = 1; sol <= SOLES_MISION; sol++) {
    const valoresAna = generarSolAna(sol, randAna);
    for (const [indicator, value] of Object.entries(valoresAna)) {
      const hrvAna = indicator === 'hr_rest'
        ? Math.round(clamp(58 - (valoresAna.stress - 2) * 3.5 - (value - 64) * 0.4, 24, 72))
        : null;
      readings.push({
        id: `demo-ana-${sol}-${indicator}`,
        astronautId: 'ana',
        indicator,
        value,
        unit: UNIDAD[indicator],
        sol,
        source: FUENTES_WATCH.has(indicator) ? 'watch_sim' : 'manual',
        ts: missionTs(sol, indicator === 'exercise_min' ? 17 : 7, 30),
        ...(hrvAna != null ? { note: `Resting HR · HRV ${hrvAna} ms` } : {}),
      });
    }

    const valoresMarcos = generarSolMarcos(sol, randMarcos);
    for (const [indicator, value] of Object.entries(valoresMarcos)) {
      const hrvMarcos = indicator === 'hr_rest'
        ? Math.round(clamp(62 - (valoresMarcos.stress - 2) * 3 - (value - 60) * 0.4, 30, 76))
        : null;
      readings.push({
        id: `demo-marcos-${sol}-${indicator}`,
        astronautId: 'marcos',
        indicator,
        value,
        unit: UNIDAD[indicator],
        sol,
        source: FUENTES_WATCH.has(indicator) ? 'watch_sim' : 'manual',
        ts: missionTs(sol, indicator === 'exercise_min' ? 18 : 7, 45),
        ...(hrvMarcos != null ? { note: `Resting HR · HRV ${hrvMarcos} ms` } : {}),
      });
    }
  }

  const symptoms = [
    {
      id: 'demo-ana-41-cold_sore',
      astronautId: 'ana',
      bodyZone: 'immune',
      code: 'cold_sore',
      severity: 2,
      sol: SOL_EVENTO,
      ts: missionTs(SOL_EVENTO, 8, 30),
      samplePhoto: true,
      note: 'Cold sore-compatible lesion recorded on Sol 41',
    },
  ];

  const tasks = [
    {
      id: 'demo-task-bp',
      astronautId: 'ana',
      kind: 'measure',
      title: 'Measure morning blood pressure',
      missionTime: missionTs(SOL_ACTUAL, 8, 0),
      recurrence: 'daily',
      done: false,
    },
  ];

  return {
    generatedAt: missionTs(SOL_ACTUAL, 6, 0),
    mission: MISION_BASE,
    astronauts: TRIPULANTES,
    readings,
    symptoms,
    tasks,
  };
}
