// Motor determinista de reglas clínicas (issue #3).
// Implementa el algoritmo de doc/proyecto/plan/prototipo.md §3 y los umbrales de
// doc/proyecto/sintesis/catalogo-indicadores.md. Sin dependencias de React ni Next (`@/`)
// para poder correr directo con `node --test`.

import rules from './rules.json' with { type: 'json' };
import { INDICADORES, NIVELES, ZONAS, gravedad, nivelMaximo } from '../tipos.js';
import { parsearNotaPvt } from '../pvt/metricas.js';

export const REGLAS = rules;

const DAY_MS = 86_400_000;

function orden(nivel) {
  const idx = NIVELES.indexOf(nivel);
  if (idx === -1) throw new Error(`Nivel desconocido "${nivel}". Válidos: ${NIVELES.join(', ')}`);
  return idx;
}

/**
 * Regla de oro: la IA puede subir un nivel, nunca bajarlo.
 * Si `ia` no aporta nivel, manda el motor.
 * @param {import('../tipos.js').Level} motor
 * @param {import('../tipos.js').Level | null | undefined} ia
 * @returns {import('../tipos.js').Level}
 */
export function mergeLevel(motor, ia) {
  const m = orden(motor);
  if (!ia) return motor;
  return orden(ia) > m ? ia : motor;
}

function inAnyRange(value, ranges = []) {
  if (!ranges.length) return false;
  const normalized = typeof ranges[0] === 'number' ? [ranges] : ranges;
  return normalized.some(([min, max]) => value >= min && value <= max);
}

/**
 * Evalúa un único indicador contra sus umbrales y su línea base personal.
 * @param {string} indicator
 * @param {number} value
 * @param {Record<string, number>} [baseline]
 */
export function evaluarIndicador(indicator, value, baseline = {}) {
  const cfg = rules.thresholds[indicator];
  let thresholdLevel = 'green';

  if (cfg && typeof value === 'number' && !Number.isNaN(value)) {
    if (
      (cfg.red_gte != null && value >= cfg.red_gte) ||
      (cfg.red_gt != null && value > cfg.red_gt) ||
      (cfg.red_lt != null && value < cfg.red_lt) ||
      (cfg.red_lte != null && value <= cfg.red_lte)
    ) {
      thresholdLevel = 'red';
    } else if (cfg.orange && inAnyRange(value, cfg.orange)) {
      thresholdLevel = 'orange';
    } else if (cfg.yellow && inAnyRange(value, cfg.yellow)) {
      thresholdLevel = 'yellow';
    } else if (cfg.green && inAnyRange(value, cfg.green)) {
      thresholdLevel = 'green';
    }
  }

  let baselineDiff = null;
  let baselineLevel = 'green';
  const baseCfg = rules.baselineDelta[indicator];
  const baseVal = baseline?.[indicator];
  if (baseCfg && typeof baseVal === 'number' && typeof value === 'number' && !Number.isNaN(value)) {
    baselineDiff = Number((value - baseVal).toFixed(2));
    const delta = baseCfg.direction === 'down' ? baseVal - value : value - baseVal;
    if (baseCfg.orange != null && delta >= baseCfg.orange) baselineLevel = 'orange';
    else if (baseCfg.yellow != null && delta >= baseCfg.yellow) baselineLevel = 'yellow';
  }

  const level = nivelMaximo(thresholdLevel, baselineLevel);
  return {
    level,
    thresholdLevel,
    baselineLevel,
    baselineDiff,
  };
}

function sortRecords(items) {
  return [...items].sort((a, b) => {
    const solDiff = (a.sol ?? 0) - (b.sol ?? 0);
    if (solDiff !== 0) return solDiff;
    return String(a.ts || '').localeCompare(String(b.ts || ''));
  });
}

function referenceSol(readings, symptoms, explicitSol) {
  if (Number.isInteger(explicitSol)) return explicitSol;
  let maxSol = null;
  for (const item of [...readings, ...symptoms]) {
    if (Number.isInteger(item?.sol)) {
      maxSol = maxSol == null ? item.sol : Math.max(maxSol, item.sol);
    }
  }
  return maxSol;
}

function referenceTsMs(readings, symptoms) {
  let maxMs = 0;
  for (const item of [...readings, ...symptoms]) {
    const ms = Date.parse(item?.ts || '');
    if (!Number.isNaN(ms) && ms > maxMs) maxMs = ms;
  }
  return maxMs || Date.now();
}

function inWindow(items, days, solRef, tsRefMs) {
  if (solRef != null) {
    const minSol = solRef - days + 1;
    const withSol = items.filter((item) => Number.isInteger(item.sol) && item.sol >= minSol && item.sol <= solRef);
    if (withSol.length > 0 || items.some((item) => Number.isInteger(item.sol))) return withSol;
  }
  const minMs = tsRefMs - days * DAY_MS;
  return items.filter((item) => {
    if (!item.ts) return true;
    const ms = Date.parse(item.ts);
    return Number.isNaN(ms) ? true : ms >= minMs && ms <= tsRefMs;
  });
}

function latestPerDay(items) {
  const byDay = new Map();
  for (const item of sortRecords(items)) {
    const key = Number.isInteger(item.sol) ? `s:${item.sol}` : String(item.ts || '').slice(0, 10) || item.id || byDay.size;
    byDay.set(key, item);
  }
  return [...byDay.values()];
}

function avg(items) {
  if (!items.length) return null;
  return items.reduce((sum, item) => sum + item.value, 0) / items.length;
}

function computeTrend(items) {
  const sorted = sortRecords(items);
  if (sorted.length < 2) return 0;
  return Number((sorted[sorted.length - 1].value - sorted[0].value).toFixed(2));
}

function hasSymptom(symptoms, codes, days, solRef, tsRefMs) {
  const list = days ? inWindow(symptoms, days, solRef, tsRefMs) : symptoms;
  return list.filter((s) => codes.includes(s.code));
}

function hasEnvEvent(missionEvents, kind, withinHours = 72) {
  return missionEvents.some((ev) => {
    if (typeof ev === 'string') return ev === kind;
    if (ev?.type !== kind && ev?.kind !== kind) return false;
    return ev.withinHours == null ? true : ev.withinHours <= withinHours;
  });
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1)));
}

function escalateForLevel(level) {
  if (level === 'red') return 'flight_surgeon';
  if (level === 'orange') return 'cmo';
  return 'self';
}

function evaluateCompositeRules({ readingsByIndicator, symptoms, baseline = {}, solRef, tsRefMs, missionEvents }) {
  const fired = [];
  const defs = Object.fromEntries(rules.composite.map((r) => [r.id, r]));

  const recentSleep = latestPerDay(inWindow(readingsByIndicator.get('sleep_h') || [], 3, solRef, tsRefMs));
  const recentStress = latestPerDay(inWindow(readingsByIndicator.get('stress') || [], 3, solRef, tsRefMs));
  const viralSymptoms = hasSymptom(symptoms, ['rash', 'cold_sore'], 3, solRef, tsRefMs);

  const avgSleep3 = avg(recentSleep);
  const avgStress3 = avg(recentStress);
  if (avgSleep3 != null && avgSleep3 < 6 && avgStress3 != null && avgStress3 >= 7 && viralSymptoms.length > 0) {
    const def = defs.viral_reactivation;
    const tempItems = sortRecords(readingsByIndicator.get('temp') || []);
    const tempVal = tempItems.length ? tempItems[tempItems.length - 1].value : null;
    const symLabel = viralSymptoms.some((s) => s.code === 'cold_sore') ? 'cold sore' : 'skin rash';
    fired.push({
      ...def,
      ruleId: def.id,
      why: `Average sleep of ${fmt(avgSleep3)} h (< 6 h) + stress ${fmt(avgStress3)}/10 + ${symLabel}${tempVal != null ? ` and temperature ${fmt(tempVal)} °C` : ''}.`,
      nasaSource: def.source,
    });
  }

  const bpSys5 = latestPerDay(inWindow(readingsByIndicator.get('bp_sys') || [], 5, solRef, tsRefMs));
  const water2 = latestPerDay(inWindow(readingsByIndicator.get('water_ml') || [], 2, solRef, tsRefMs));
  const avgWater2 = avg(water2);
  const bpTrend5 = computeTrend(bpSys5);
  const dizzy = hasSymptom(symptoms, ['dizzy_standing'], 3, solRef, tsRefMs);
  if (
    (hasEnvEvent(missionEvents, 'landing', 72) && bpSys5.length >= 2 && bpTrend5 < 0 && avgWater2 != null && avgWater2 < 1500) ||
    (dizzy.length > 0 && bpSys5.length > 0 && bpSys5[bpSys5.length - 1].value < 90)
  ) {
    const def = defs.orthostatic_pre_landing;
    fired.push({
      ...def,
      ruleId: def.id,
      why:
        dizzy.length > 0
          ? 'Low systolic blood pressure (< 90 mmHg) accompanied by dizziness on standing.'
          : `Drop in systolic blood pressure (${fmt(bpTrend5)} mmHg over 5 days) with low water intake (${fmt(avgWater2)} ml/d) before landing.`,
      nasaSource: def.source,
    });
  }

  const vteSymptoms = hasSymptom(symptoms, ['neck_swelling', 'arm_swelling'], 7, solRef, tsRefMs);
  if (vteSymptoms.length > 0) {
    const def = defs.jugular_vte;
    const sitio = vteSymptoms.some((s) => s.code === 'neck_swelling') ? 'neck' : 'arm';
    fired.push({
      ...def,
      ruleId: def.id,
      why: `Unilateral ${sitio} swelling or pain reported during prolonged microgravity/flight.`,
      nasaSource: def.source,
    });
  }

  if (recentSleep.length >= 3 && recentSleep.slice(-3).every((r) => r.value < 6)) {
    const def = defs.sleep_deficit_streak;
    fired.push({
      ...def,
      ruleId: def.id,
      why: `Three consecutive nights under 6 h (average ${fmt(avgSleep3)} h).`,
      nasaSource: def.source,
    });
  }

  const recentMood = latestPerDay(inWindow(readingsByIndicator.get('mood') || [], 3, solRef, tsRefMs));
  if (recentMood.length >= 3 && recentMood.slice(-3).every((r) => r.value <= 2)) {
    const def = defs.mood_low_streak;
    fired.push({
      ...def,
      ruleId: def.id,
      why: 'Mood reported ≤ 2/5 for three consecutive days.',
      nasaSource: def.source,
    });
  }

  const exercise7 = latestPerDay(inWindow(readingsByIndicator.get('exercise_min') || [], 7, solRef, tsRefMs));
  const avgEx7 = avg(exercise7);
  if (exercise7.length >= 3 && avgEx7 != null && avgEx7 < 45) {
    const def = defs.exercise_deficit_week;
    fired.push({
      ...def,
      ruleId: def.id,
      why: `Weekly exercise average at ${fmt(avgEx7)} min/day (< 50% of 90 min plan).`,
      nasaSource: def.source,
    });
  }

  // SANS: visión borrosa + agudeza peor que la base (o bajo el rango verde si no hay base).
  // doc/proyecto/sintesis/catalogo-indicadores.md §Reglas compuestas.
  const blurSymptoms = hasSymptom(symptoms, ['blurred_vision'], 7, solRef, tsRefMs);
  const acuity7 = sortRecords(inWindow(readingsByIndicator.get('visual_acuity') || [], 7, solRef, tsRefMs));
  const latestAcuity = acuity7.length ? acuity7[acuity7.length - 1].value : null;
  const baseAcuity = typeof baseline?.visual_acuity === 'number' ? baseline.visual_acuity : null;
  const sansDrop = rules.baselineDelta.visual_acuity?.yellow ?? 10;
  const sansGreenMin = rules.thresholds.visual_acuity?.green?.[0] ?? 80;
  const acuityWorse =
    latestAcuity != null && (baseAcuity != null ? baseAcuity - latestAcuity >= sansDrop : latestAcuity < sansGreenMin);
  if (blurSymptoms.length > 0 && acuityWorse) {
    const def = defs.sans_visual_change;
    fired.push({
      ...def,
      ruleId: def.id,
      why:
        baseAcuity != null
          ? `Blurred vision reported + visual acuity of ${fmt(latestAcuity)} pts (${fmt(latestAcuity - baseAcuity)} vs. your baseline of ${fmt(baseAcuity)}).`
          : `Blurred vision reported + visual acuity of ${fmt(latestAcuity)} pts (< ${sansGreenMin}).`,
      nasaSource: def.source,
    });
  }

  const flankSymptoms = hasSymptom(symptoms, ['flank_pain'], 3, solRef, tsRefMs);
  if (flankSymptoms.length > 0 && avgWater2 != null && avgWater2 < 1500) {
    const def = defs.renal_stone_risk;
    fired.push({
      ...def,
      ruleId: def.id,
      why: `Flank pain combined with low hydration (${fmt(avgWater2)} ml/day).`,
      nasaSource: def.source,
    });
  }

  const headache = hasSymptom(symptoms, ['headache'], 2, solRef, tsRefMs);
  const spo2Items = sortRecords(readingsByIndicator.get('spo2') || []);
  const latestSpo2 = spo2Items.length ? spo2Items[spo2Items.length - 1].value : null;
  if (headache.length > 0 && latestSpo2 != null && latestSpo2 < 94) {
    const def = defs.hypoxia_co2;
    fired.push({
      ...def,
      ruleId: def.id,
      why: `Headache reported with SpO₂ at ${fmt(latestSpo2)}% (< 94%).`,
      nasaSource: def.source,
    });
  }

  const pvtItems = sortRecords(inWindow(readingsByIndicator.get('reaction_ms') || [], 2, solRef, tsRefMs));
  const latestPvt = pvtItems.at(-1);
  if (latestPvt) {
    const pvtMeta = parsearNotaPvt(latestPvt.note);
    const lapsos = pvtMeta?.lapsos ?? 0;
    const erroresNoGo = pvtMeta?.erroresNoGo ?? 0;
    const estabilidadVor = pvtMeta?.estabilidadVor ?? null;
    const fatigaSuenoOEstres = (avgSleep3 != null && avgSleep3 < 6) || (avgStress3 != null && avgStress3 >= 7);
    if (lapsos >= 4 || erroresNoGo >= 2 || ((lapsos >= 3 || latestPvt.value >= 350) && fatigaSuenoOEstres)) {
      const def = defs.pvt_cognitive_fatigue;
      const detalles = [`median ${fmt(latestPvt.value)} ms`];
      if (lapsos > 0) detalles.push(`${lapsos} lapses ≥ 355 ms`);
      if (erroresNoGo > 0) detalles.push(`${erroresNoGo} No-Go errors`);
      if (avgSleep3 != null && avgSleep3 < 6) detalles.push(`sleep ${fmt(avgSleep3)} h`);
      if (avgStress3 != null && avgStress3 >= 7) detalles.push(`stress ${fmt(avgStress3)}/10`);
      fired.push({
        ...def,
        ruleId: def.id,
        why: `Degraded performance on PVT test (${detalles.join(', ')}).`,
        nasaSource: def.source,
      });
    }
    if (estabilidadVor != null && estabilidadVor < 60) {
      const def = defs.vestibular_instability;
      fired.push({
        ...def,
        ruleId: def.id,
        why: `VOR vestibular stability at ${estabilidadVor}% (< 60%) during head and gaze check.`,
        nasaSource: def.source,
      });
    }
  }

  return fired;
}

/**
 * Evalúa el estado completo de un tripulante a partir de lecturas, síntomas,
 * línea base personal y entorno de misión.
 *
 * Acepta tanto un objeto `{ readings, symptoms, baseline, env, sol, missionEvents }`
 * como la firma posicional `evaluate(readings, baseline, env, extra)`.
 */
export function evaluate(inputOrReadings, baselineArg = {}, envArg = 'mars_base', extraArg = {}) {
  const isArrayInput = Array.isArray(inputOrReadings);
  const opts = isArrayInput
    ? {
        readings: inputOrReadings,
        baseline: baselineArg,
        env: envArg,
        ...extraArg,
      }
    : (inputOrReadings ?? {});

  const {
    readings: rawReadings = [],
    symptoms: rawSymptoms = [],
    baseline = {},
    env = 'mars_base',
    sol = null,
    missionEvents = [],
  } = opts;

  const solRef = referenceSol(rawReadings, rawSymptoms, sol);
  const readings = solRef != null
    ? rawReadings.filter((r) => r?.sol == null || r.sol <= solRef)
    : rawReadings;
  const symptoms = solRef != null
    ? rawSymptoms.filter((s) => s?.sol == null || s.sol <= solRef)
    : rawSymptoms;

  const tsRefMs = referenceTsMs(readings, symptoms);
  const readingsByIndicator = new Map();
  for (const r of readings) {
    if (!r || !r.indicator || typeof r.value !== 'number') continue;
    if (!readingsByIndicator.has(r.indicator)) readingsByIndicator.set(r.indicator, []);
    readingsByIndicator.get(r.indicator).push(r);
  }

  const indicators = {};
  const indicatorLevels = {};
  const zoneBuckets = Object.fromEntries(ZONAS.map((z) => [z, []]));
  const thresholdAlerts = [];

  for (const [id, list] of readingsByIndicator.entries()) {
    const sorted = sortRecords(list);
    const latest = sorted[sorted.length - 1];
    const window7 = inWindow(sorted, 7, solRef, tsRefMs);
    const trend7d = computeTrend(window7);
    const ev = evaluarIndicador(id, latest.value, baseline);
    const cfg = rules.thresholds[id];
    const baseCfg = rules.baselineDelta[id];
    const zone = cfg?.zone || baseCfg?.zone || 'whole';
    const alsoZones = cfg?.alsoZones || [];
    const meta = INDICADORES[id] || { etiqueta: id, unidad: cfg?.unit || '' };

    indicators[id] = {
      indicator: id,
      label: meta.etiqueta,
      unit: latest.unit || meta.unidad || cfg?.unit || '',
      value: latest.value,
      sol: latest.sol ?? solRef ?? null,
      ts: latest.ts || null,
      source: latest.source || 'manual',
      level: ev.level,
      thresholdLevel: ev.thresholdLevel,
      baselineLevel: ev.baselineLevel,
      baselineDiff: ev.baselineDiff,
      trend7d,
      zone,
      nasaSource: cfg?.source || baseCfg?.source || 'doc/nasa/fuentes/02-riesgos/risks.md',
      basis: cfg?.basis || baseCfg?.basis || null,
    };
    indicatorLevels[id] = ev.level;

    zoneBuckets[zone]?.push(ev.level);
    for (const extraZone of alsoZones) zoneBuckets[extraZone]?.push(ev.level);

    if (ev.level !== 'green') {
      const esPorBase = gravedad(ev.baselineLevel) >= gravedad(ev.thresholdLevel) && ev.baselineLevel !== 'green';
      const signo = ev.baselineDiff > 0 ? '+' : '';
      const why = esPorBase && baseCfg
        ? `${baseCfg.why} (${fmt(latest.value)} ${meta.unidad}, ${signo}${fmt(ev.baselineDiff)} vs. baseline ${fmt(baseline[id])}).`
        : `${meta.etiqueta} out of optimal range: ${fmt(latest.value)} ${meta.unidad}.`;

      thresholdAlerts.push({
        id: `threshold:${id}`,
        ruleId: `threshold:${id}`,
        level: ev.level,
        zone,
        title: `${meta.etiqueta} in ${ev.level === 'red' ? 'critical' : ev.level === 'orange' ? 'alert' : 'watch'}`,
        why,
        actions: (esPorBase && baseCfg?.actions) || cfg?.actions || ['Repeat measurement and check guide'],
        escalate: escalateForLevel(ev.level),
        nasaSource: cfg?.source || baseCfg?.source || 'doc/nasa/fuentes/02-riesgos/risks.md',
        // Origen del umbral que disparó la alerta: NASA, guía externa o diseño propio.
        basis: (esPorBase ? baseCfg?.basis : cfg?.basis) || cfg?.basis || baseCfg?.basis || null,
        ts: latest.ts || new Date(tsRefMs).toISOString(),
        sol: latest.sol ?? solRef ?? null,
        _composite: false,
      });
    }
  }

  // Síntomas individuales sin regla compuesta siguen impactando su zona.
  for (const s of symptoms) {
    if (s?.bodyZone && zoneBuckets[s.bodyZone]) {
      const symLevel = s.severity >= 3 ? 'orange' : s.severity === 2 ? 'yellow' : 'green';
      if (symLevel !== 'green') zoneBuckets[s.bodyZone].push(symLevel);
    }
  }

  const compositeAlerts = evaluateCompositeRules({
    readingsByIndicator,
    symptoms,
    baseline,
    solRef,
    tsRefMs,
    missionEvents,
  }).map((a) => ({
    ...a,
    ts: new Date(tsRefMs).toISOString(),
    sol: solRef,
    _composite: true,
  }));

  const envMod = rules.envModifiers[env] || null;
  const compositeZonesMax = new Map();
  for (const a of compositeAlerts) {
    if (zoneBuckets[a.zone]) zoneBuckets[a.zone].push(a.level);
    const prev = compositeZonesMax.get(a.zone) || 'green';
    compositeZonesMax.set(a.zone, nivelMaximo(prev, a.level));
  }

  // Conserva alertas compuestas y agrega las de umbral no cubiertas por una compuesta mayor en la misma zona.
  const allAlerts = [
    ...compositeAlerts,
    ...thresholdAlerts.filter((a) => {
      const compLevel = compositeZonesMax.get(a.zone);
      return !compLevel || gravedad(a.level) > gravedad(compLevel);
    }),
  ]
    .sort((a, b) => {
      const diff = gravedad(b.level) - gravedad(a.level);
      if (diff !== 0) return diff;
      return Number(b._composite) - Number(a._composite);
    })
    .map(({ _composite, source: _src, ...alert }) => ({
      ...alert,
      ...(envMod?.commDelayMin ? { commDelayMin: envMod.commDelayMin } : {}),
      ...(alert.escalate === 'flight_surgeon' && envMod?.escalateAlsoTo
        ? { alsoNotify: [envMod.escalateAlsoTo] }
        : {}),
    }));

  const zoneLevels = Object.fromEntries(
    ZONAS.map((z) => [z, nivelMaximo(zoneBuckets[z])]),
  );
  const globalLevel = nivelMaximo(Object.values(zoneLevels));

  return {
    sol: solRef,
    env,
    envModifier: envMod,
    globalLevel,
    zoneLevels,
    indicatorLevels,
    indicators,
    alerts: allAlerts,
    thresholdAlerts: thresholdAlerts.map(({ _composite, ...a }) => a),
  };
}

export { evaluate as evaluarEstado };
