// Simulador de soles futuros basado en artefactos y rangos documentados por la NASA.
// Combina variación aleatoria acotada dentro de rangos fisiológicos/instrumentales
// con variables progresivas que evolucionan cada sol que pasa, persistiendo en BD
// y ejecutando el motor clínico `evaluate()` en tiempo real a medida que ingresan los datos.

import {
  addNotificationDb,
  addReadings,
  addSymptoms,
  getCabinTelemetry,
  getDb,
  getMissionState,
  getReadings,
  getSymptoms,
  listAstronauts,
  replaceAlerts,
  saveCabinTelemetry,
  saveMissionState,
} from '../db.js';
import {
  DIAS_TRANSITO,
  LIMITE_CARRERA_MSV,
  TASA_SUPERFICIE_MSV_DIA,
  TASA_TRANSITO_MSV_DIA,
  TORMENTA,
} from '../cabina/simulador.js';
import { TRIPULANTES } from '../demo/generador.js';
import { evaluate } from '../motor/evaluar.js';
import { INDICADORES } from '../tipos.js';

const INICIO_MISION_UTC = Date.parse('2026-09-01T00:00:00.000Z');
const MS_DIA = 86_400_000;

export const ARTEFACTOS_NASA = Object.freeze({
  watch: {
    id: 'watch',
    nombre: 'Reloj biométrico (PPG · Actigrafía · Muñeca)',
    referenciaNasa: 'Contramedida NASA HRP (1,5 h/día ejercicio) · AASM sueño 7–9 h · PPG/HRV',
    baseDoc: 'doc/proyecto/plan/dispositivos-y-sensores.md',
    source: 'watch_sim',
    indicadores: ['hr_rest', 'spo2', 'temp', 'sleep_h', 'exercise_min'],
    rangos: {
      hr_rest: { min: 48, max: 118, sigma: 2.5, unidad: 'lpm' },
      spo2: { min: 89, max: 100, sigma: 0.6, unidad: '%' },
      temp: { min: 35.8, max: 39.2, sigma: 0.14, unidad: '°C' },
      sleep_h: { min: 3.5, max: 9.5, sigma: 0.35, unidad: 'h' },
      exercise_min: { min: 0, max: 120, sigma: 8, unidad: 'min' },
      hrv_ms: { min: 18, max: 85, sigma: 4, unidad: 'ms' },
    },
  },
  dosimetro_rad: {
    id: 'dosimetro_rad',
    nombre: 'Dosímetro personal + Curiosity/RAD',
    referenciaNasa: 'NASA-STD-3001 Vol. 1 · OCHMO-TB-020 (< 600 mSv carrera) · ~0,64 mSv/día Marte',
    baseDoc: 'doc/proyecto/sintesis/cabina-y-radiacion.md',
    source: 'dosimeter_sim',
    indicadores: ['radiation_msv'],
    rangos: {
      radiation_msv: { min: 324, max: LIMITE_CARRERA_MSV + 50, tasaSuperficie: TASA_SUPERFICIE_MSV_DIA, unidad: 'mSv' },
    },
  },
  cabina_eclss: {
    id: 'cabina_eclss',
    nombre: 'Sensores ambientales ECLSS (CO₂ · O₂ · Presión · Acústica)',
    referenciaNasa: 'NASA-STD-3001 Vol. 2 · OCHMO-TB-004 (CO₂ < 2,5 obj / ≤ 3,0 lím) · OCHMO-TB-035 (NC-50 / NC-40)',
    baseDoc: 'doc/proyecto/sintesis/cabina-y-radiacion.md',
    source: 'cabin_sensors',
    indicadores: ['co2_mmhg', 'o2_pct', 'pressure_kpa', 'noise_dba'],
    rangos: {
      co2_mmhg: { min: 1.6, max: 5.3, sigma: 0.14, unidad: 'mmHg' },
      o2_pct: { min: 19.2, max: 23.5, sigma: 0.25, unidad: '%' },
      pressure_kpa: { min: 99.5, max: 102.5, sigma: 0.4, unidad: 'kPa' },
      noise_dba: { min: 45, max: 68, sigma: 2, unidad: 'dBA' },
    },
  },
  manguito_manual: {
    id: 'manguito_manual',
    nombre: 'Tensiómetro BLE · Glucómetro · Diario conductual',
    referenciaNasa: 'ACC/AHA · ADA · NASA-STD-3001 hidratación',
    baseDoc: 'doc/proyecto/sintesis/catalogo-indicadores.md',
    source: 'manual',
    indicadores: ['bp_sys', 'bp_dia', 'glucose', 'water_ml', 'mood', 'stress'],
    rangos: {
      bp_sys: { min: 95, max: 155, sigma: 3, unidad: 'mmHg' },
      bp_dia: { min: 60, max: 98, sigma: 2.5, unidad: 'mmHg' },
      glucose: { min: 70, max: 135, sigma: 4, unidad: 'mg/dL' },
      water_ml: { min: 1200, max: 3200, sigma: 180, unidad: 'ml' },
      mood: { min: 1, max: 5, sigma: 0.5, unidad: '/5' },
      stress: { min: 1, max: 10, sigma: 0.7, unidad: '/10' },
    },
  },
  cognitivo_camara: {
    id: 'cognitivo_camara',
    nombre: 'PVT-B HRP + Visión SANS (Cámara / Pantalla)',
    referenciaNasa: 'NASA HRP PVT-B (Basner et al., lapso ≥ 355 ms) · Seguimiento neuro-ocular SANS',
    baseDoc: 'doc/proyecto/plan/dispositivos-y-sensores.md',
    source: 'camera',
    indicadores: ['reaction_ms', 'visual_acuity'],
    rangos: {
      reaction_ms: { min: 210, max: 520, sigma: 14, unidad: 'ms' },
      visual_acuity: { min: 40, max: 100, sigma: 3, unidad: '/100' },
    },
  },
});

export const PERFILES_SIMULACION = Object.freeze({
  nominal: {
    id: 'nominal',
    etiqueta: 'Nominal (variación acotada)',
    descripcion: 'Fluctuación aleatoria saludable alrededor de la línea base sin deriva patológica.',
    derivasPorSol: {
      sleep_h: 0,
      stress: 0,
      mood: 0,
      hr_rest: 0,
      hrv_ms: 0,
      temp: 0,
      spo2: 0,
      co2_mmhg: 0,
      reaction_ms: 0,
      exercise_min: 0,
      water_ml: 0,
      visual_acuity: 0,
    },
  },
  fatiga_progresiva: {
    id: 'fatiga_progresiva',
    etiqueta: 'Fatiga progresiva (deriva diaria de sueño y PVT)',
    descripcion: 'Cada sol acumulado recorta sueño (−0,22 h/sol), sube estrés (+0,55/sol) y alarga tiempo de reacción (+18 ms/sol).',
    derivasPorSol: {
      sleep_h: -0.22,
      stress: 0.55,
      mood: -0.25,
      hr_rest: 1.4,
      hrv_ms: -2.4,
      temp: 0.03,
      spo2: -0.1,
      co2_mmhg: 0.02,
      reaction_ms: 18,
      exercise_min: -5,
      water_ml: -50,
      visual_acuity: -0.5,
    },
  },
  reactivacion_viral: {
    id: 'reactivacion_viral',
    etiqueta: 'Sobrecarga inmune (reactivación viral)',
    descripcion: 'Aumenta estrés y febrícula día a día (+0,18 °C/sol, FC +2,2 lpm/sol) y dispara lesión dérmica si se sostiene.',
    derivasPorSol: {
      sleep_h: -0.2,
      stress: 0.65,
      mood: -0.3,
      hr_rest: 2.2,
      hrv_ms: -3.2,
      temp: 0.18,
      spo2: -0.15,
      co2_mmhg: 0.03,
      reaction_ms: 14,
      exercise_min: -8,
      water_ml: -60,
      visual_acuity: 0,
    },
  },
  depurador_co2: {
    id: 'depurador_co2',
    etiqueta: 'Degradación depurador CO₂ (OCHMO-TB-004)',
    descripcion: 'Sube CO₂ en cabina +0,22 mmHg por sol superando el objetivo de 2,5 mmHg y el límite de 3,0 mmHg.',
    derivasPorSol: {
      sleep_h: -0.08,
      stress: 0.25,
      mood: -0.15,
      hr_rest: 0.8,
      hrv_ms: -1,
      temp: 0.02,
      spo2: -0.2,
      co2_mmhg: 0.22,
      reaction_ms: 9,
      exercise_min: 0,
      water_ml: 0,
      visual_acuity: 0,
    },
  },
  tormenta_solar: {
    id: 'tormenta_solar',
    etiqueta: 'Tormenta solar (evento SPE)',
    descripcion: 'Incrementa tasa de radiación ambiental (Curiosity/RAD + SPE) y activa protocolo de refugio.',
    derivasPorSol: {
      sleep_h: -0.12,
      stress: 0.4,
      mood: -0.2,
      hr_rest: 1.0,
      hrv_ms: -1.5,
      temp: 0,
      spo2: 0,
      co2_mmhg: 0.05,
      reaction_ms: 8,
      exercise_min: -10,
      water_ml: 0,
      visual_acuity: 0,
    },
  },
});

function mulberry32(semilla) {
  let t = semilla >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const redondear = (n, dec = 1) => Math.round(n * 10 ** dec) / 10 ** dec;
const acotar = (v, min, max) => Math.max(min, Math.min(max, v));

export function tsDelSol(sol, horaUtc = '07:30:00') {
  const fecha = new Date(INICIO_MISION_UTC + Math.max(0, sol - 1) * MS_DIA);
  const [h, m, s] = horaUtc.split(':').map(Number);
  fecha.setUTCHours(h || 7, m || 30, s || 0, 0);
  return fecha.toISOString();
}

function ultimoValorDeHistorial(historial = [], indicator, solLimite, fallback) {
  const filtrado = historial.filter(
    (r) => r.indicator === indicator && Number.isFinite(r.value) && (r.sol == null || r.sol <= solLimite),
  );
  if (!filtrado.length) return fallback;
  const ordenado = [...filtrado].sort((a, b) => (a.sol ?? 0) - (b.sol ?? 0) || String(a.ts || '').localeCompare(String(b.ts || '')));
  return ordenado.at(-1).value;
}

/**
 * Genera telemetría de cabina + mediciones por artefacto NASA para un `sol` futuro (o puntual),
 * combinando una variable de deriva diaria (`paso * deltaPorSol`) y ruido acotado dentro del rango instrumental.
 */
export function generarPaqueteSol({
  astronauta,
  sol,
  paso = 1,
  historial = [],
  cabinaPrevia = null,
  perfil = 'nominal',
  artefactos = ['watch', 'dosimetro_rad', 'cabina_eclss', 'manguito_manual', 'cognitivo_camara'],
  enRefugio = false,
  seed,
}) {
  const cfgPerfil = PERFILES_SIMULACION[perfil] ?? PERFILES_SIMULACION.nominal;
  const d = cfgPerfil.derivasPorSol;
  const rnd = mulberry32(seed ?? sol * 104729 + (astronauta.id === 'ana' ? 17 : 53) + Date.now());
  const ruido = (amplitud) => (rnd() * 2 - 1) * amplitud;
  const b = astronauta.baseline ?? {};

  const prevOrBase = (ind, defecto) => ultimoValorDeHistorial(historial, ind, sol - 1, b[ind] ?? defecto);

  // Ancla de partida desde la última medición guardada o la línea base
  const factorPaso = astronauta.id === 'marcos' && perfil !== 'nominal' && perfil !== 'depurador_co2' && perfil !== 'tormenta_solar' ? 0.25 : 1;

  const crearLectura = (indicator, value, source, hora, extra = {}) => ({
    id: `sim-${astronauta.id}-${sol}-${indicator}`,
    astronautId: astronauta.id,
    indicator,
    value,
    unit: INDICADORES[indicator]?.unidad ?? '',
    sol,
    ts: tsDelSol(sol, hora),
    source,
    ...extra,
  });

  const lecturas = [];
  const sintomas = [];

  // 1. Reloj biométrico (PPG, HRV, SpO2, Temp, Sueño, Ejercicio)
  if (artefactos.includes('watch')) {
    const rWatch = ARTEFACTOS_NASA.watch.rangos;
    const sleepBase = prevOrBase('sleep_h', 7.6);
    const sleepVal = redondear(
      acotar(sleepBase + d.sleep_h * factorPaso + ruido(rWatch.sleep_h.sigma), rWatch.sleep_h.min, rWatch.sleep_h.max),
      1,
    );
    const hrBase = prevOrBase('hr_rest', 64);
    const hrVal = Math.round(
      acotar(hrBase + d.hr_rest * factorPaso + ruido(rWatch.hr_rest.sigma), rWatch.hr_rest.min, rWatch.hr_rest.max),
    );
    const hrvBase = 48 + (b.hr_rest ? (64 - b.hr_rest) * 0.5 : 0);
    const hrvVal = Math.round(
      acotar(hrvBase + paso * d.hrv_ms * factorPaso + ruido(rWatch.hrv_ms.sigma), rWatch.hrv_ms.min, rWatch.hrv_ms.max),
    );
    const spo2Val = redondear(
      acotar((b.spo2 ?? 98) + paso * d.spo2 * factorPaso + ruido(rWatch.spo2.sigma), rWatch.spo2.min, rWatch.spo2.max),
      0,
    );
    const tempBase = prevOrBase('temp', 36.7);
    const tempVal = redondear(
      acotar(tempBase + d.temp * factorPaso + ruido(rWatch.temp.sigma), rWatch.temp.min, rWatch.temp.max),
      1,
    );
    const exBase = prevOrBase('exercise_min', 90);
    const exVal = Math.round(
      acotar(exBase + d.exercise_min * factorPaso + ruido(rWatch.exercise_min.sigma), rWatch.exercise_min.min, rWatch.exercise_min.max),
    );

    const deltaFc = hrVal - (b.hr_rest ?? 64);
    const notaWatch = `${deltaFc >= 0 ? `FC reposo +${deltaFc}` : `FC reposo ${deltaFc}`} sobre base · HRV ${hrvVal} ms · Artefacto Watch`;

    lecturas.push(
      crearLectura('sleep_h', sleepVal, 'watch_sim', '06:40:00', { meta: { artefacto: 'watch', perfil, paso } }),
      crearLectura('hr_rest', hrVal, 'watch_sim', '06:45:00', { note: notaWatch, meta: { artefacto: 'watch', hrvMs: hrvVal, perfil, paso } }),
      crearLectura('spo2', spo2Val, 'watch_sim', '06:45:00', { meta: { artefacto: 'watch', perfil, paso } }),
      crearLectura('temp', tempVal, 'watch_sim', '07:00:00', { meta: { artefacto: 'watch', perfil, paso } }),
      crearLectura('exercise_min', exVal, 'watch_sim', '17:30:00', { meta: { artefacto: 'watch', perfil, paso } }),
    );

    if (perfil === 'reactivacion_viral' && astronauta.id === 'ana' && (tempVal >= 37.3 || paso >= 2)) {
      sintomas.push({
        id: `sim-${astronauta.id}-${sol}-cold_sore`,
        astronautId: astronauta.id,
        bodyZone: 'immune',
        code: 'cold_sore',
        severity: tempVal >= 37.6 ? 2 : 1,
        sol,
        ts: tsDelSol(sol, '08:15:00'),
        notes: `Simulación progresiva (${perfil}, sol ${sol})`,
      });
    }
  }

  // 2. Tensiómetro + Glucómetro + Diario conductual
  if (artefactos.includes('manguito_manual')) {
    const rMan = ARTEFACTOS_NASA.manguito_manual.rangos;
    const estresBase = prevOrBase('stress', 3);
    const stressVal = Math.round(
      acotar(estresBase + d.stress * factorPaso + ruido(rMan.stress.sigma), rMan.stress.min, rMan.stress.max),
    );
    const moodBase = prevOrBase('mood', 4);
    const moodVal = Math.round(
      acotar(moodBase + d.mood * factorPaso + ruido(rMan.mood.sigma), rMan.mood.min, rMan.mood.max),
    );
    const waterBase = prevOrBase('water_ml', 2150);
    const waterVal = Math.round(
      acotar(waterBase + d.water_ml * factorPaso + ruido(rMan.water_ml.sigma), rMan.water_ml.min, rMan.water_ml.max) / 50,
    ) * 50;
    const bpSys = Math.round(acotar((b.bp_sys ?? 118) + stressVal * 1.1 + ruido(rMan.bp_sys.sigma), rMan.bp_sys.min, rMan.bp_sys.max));
    const bpDia = Math.round(acotar((b.bp_dia ?? 76) + stressVal * 0.6 + ruido(rMan.bp_dia.sigma), rMan.bp_dia.min, rMan.bp_dia.max));
    const glucose = Math.round(acotar((b.glucose ?? 86) + ruido(rMan.glucose.sigma), rMan.glucose.min, rMan.glucose.max));

    lecturas.push(
      crearLectura('bp_sys', bpSys, 'manual', '07:20:00', { meta: { artefacto: 'manguito_manual', perfil, paso } }),
      crearLectura('bp_dia', bpDia, 'manual', '07:20:00', { meta: { artefacto: 'manguito_manual', perfil, paso } }),
      crearLectura('glucose', glucose, 'manual', '07:25:00', { meta: { artefacto: 'manguito_manual', perfil, paso } }),
      crearLectura('water_ml', waterVal, 'manual', '20:30:00', { meta: { artefacto: 'manguito_manual', perfil, paso } }),
      crearLectura('stress', stressVal, 'manual', '08:00:00', { meta: { artefacto: 'manguito_manual', perfil, paso } }),
      crearLectura('mood', moodVal, 'manual', '08:00:00', { meta: { artefacto: 'manguito_manual', perfil, paso } }),
    );
  }

  // 3. PVT-B + Visión SANS
  if (artefactos.includes('cognitivo_camara')) {
    const rCog = ARTEFACTOS_NASA.cognitivo_camara.rangos;
    const pvtBase = prevOrBase('reaction_ms', b.reaction_ms ?? 265);
    const pvtVal = Math.round(
      acotar(pvtBase + d.reaction_ms * factorPaso + ruido(rCog.reaction_ms.sigma), rCog.reaction_ms.min, rCog.reaction_ms.max),
    );
    const acuityBase = prevOrBase('visual_acuity', b.visual_acuity ?? 92);
    const acuityVal = Math.round(
      acotar(acuityBase + d.visual_acuity * factorPaso + ruido(rCog.visual_acuity.sigma), rCog.visual_acuity.min, rCog.visual_acuity.max),
    );
    const lapsos = Math.max(0, Math.floor((pvtVal - 290) / 45));
    const score = Math.max(20, Math.min(100, Math.round(100 - (pvtVal - 240) * 0.25)));
    lecturas.push(
      crearLectura('reaction_ms', pvtVal, 'camera', '11:00:00', {
        note: `PVT mediana ${pvtVal} ms · ${lapsos} lapsos · desempeño ${score} %`,
        meta: { artefacto: 'cognitivo_camara', perfil, paso },
      }),
      crearLectura('visual_acuity', acuityVal, 'camera', '11:10:00', {
        meta: { artefacto: 'cognitivo_camara', perfil, paso },
      }),
    );
  }

  // 4. Dosímetro personal + radiación Curiosity/RAD
  const esTormenta = perfil === 'tormenta_solar';
  const tasaBaseSol = TASA_SUPERFICIE_MSV_DIA + (astronauta.id === 'ana' ? 0.09 : 0.05);
  const extraTormentaDia = esTormenta ? (enRefugio ? TORMENTA.refugioMSvH * 4 : TORMENTA.fueraMSvH * 4) : 0;
  const tasaDiaTotal = redondear(tasaBaseSol + extraTormentaDia, 2);
  const radPrevia = prevOrBase('radiation_msv', DIAS_TRANSITO * TASA_TRANSITO_MSV_DIA + (sol - 1) * tasaBaseSol);
  const radTotal = redondear(radPrevia + tasaDiaTotal, 1);

  if (artefactos.includes('dosimetro_rad')) {
    lecturas.push(
      crearLectura('radiation_msv', radTotal, 'dosimeter_sim', '21:00:00', {
        note: `Curiosity/RAD +${tasaDiaTotal} mSv/sol${esTormenta ? (enRefugio ? ' (SPE en refugio)' : ' (SPE expuesto)') : ''}`,
        meta: { artefacto: 'dosimetro_rad', tasaMSvDia: tasaDiaTotal, tormenta: esTormenta, enRefugio, perfil },
      }),
    );
  }

  // 5. Telemetría ambiental ECLSS de cabina (compartida)
  const rCab = ARTEFACTOS_NASA.cabina_eclss.rangos;
  const co2Base = cabinaPrevia?.co2Mmhg ?? 2.15;
  const co2Mmhg = redondear(
    acotar(co2Base + d.co2_mmhg + ruido(rCab.co2_mmhg.sigma), rCab.co2_mmhg.min, rCab.co2_mmhg.max),
    2,
  );
  const o2Pct = redondear(acotar(20.9 + ruido(rCab.o2_pct.sigma), rCab.o2_pct.min, rCab.o2_pct.max), 1);
  const pressureKpa = redondear(acotar(101.2 + ruido(rCab.pressure_kpa.sigma), rCab.pressure_kpa.min, rCab.pressure_kpa.max), 1);
  const noiseDba = Math.round(acotar(53 + (perfil === 'depurador_co2' ? 4 : 0) + ruido(rCab.noise_dba.sigma), rCab.noise_dba.min, rCab.noise_dba.max));
  const noiseRestDb = Math.round(acotar(42 + ruido(2), 38, 50));

  const cabina = {
    id: `cabina-sol-${sol}`,
    sol,
    ts: tsDelSol(sol, '12:00:00'),
    co2Mmhg,
    o2Pct,
    pressureKpa,
    noiseDba,
    noiseRestDb,
    radiationRateMsvSol: tasaDiaTotal,
    radiationTotalMsv: radTotal,
    tormenta: esTormenta,
    enRefugio,
    source: 'cabin_sensors',
    note: `ECLSS CO₂ ${co2Mmhg} mmHg · RAD ${radTotal} mSv · perfil ${perfil}`,
    meta: { artefacto: 'cabina_eclss', perfil, paso },
  };

  return { lecturas, sintomas, cabina };
}

/**
 * Avanza la misión `cantidad` soles hacia el futuro, simula datos por artefacto NASA,
 * los persiste en IndexedDB/Supabase y corre el análisis clínico (`evaluate`) inmediatamente.
 */
export async function avanzarYSimularSoles({
  cantidad = 1,
  perfil = 'nominal',
  artefactos = ['watch', 'dosimetro_rad', 'cabina_eclss', 'manguito_manual', 'cognitivo_camara'],
  enRefugio = false,
  seed,
} = {}) {
  const nSoles = Math.max(1, Math.min(30, Math.floor(cantidad)));
  const estadoActual = (await getMissionState()) ?? {
    id: 'ares-iv',
    missionName: 'Ares IV · Base Marte',
    entorno: 'mars_base',
    solActual: 42,
    totalSoles: 60,
    minutos: 390,
    diaSemana: 'jueves',
    pausado: true,
    acelerado: true,
  };

  const solAnterior = estadoActual.solActual ?? 42;
  const solNuevo = solAnterior + nSoles;
  const entorno = estadoActual.entorno ?? 'mars_base';

  const tripulacionDb = await listAstronauts();
  const tripulacion = tripulacionDb.length ? tripulacionDb : TRIPULANTES;

  const historialPorAstro = {};
  const sintomasPorAstro = {};
  for (const t of tripulacion) {
    const todasR = await getReadings(t.id);
    const todasS = await getSymptoms(t.id);
    // Eliminamos proyecciones previas de la ventana [solAnterior+1 .. solNuevo] para que el nuevo escenario las reemplace limpio.
    const aReemplazarIds = todasR
      .filter((r) => Number.isInteger(r.sol) && r.sol > solAnterior && r.sol <= solNuevo)
      .map((r) => r.id);
    if (aReemplazarIds.length) {
      await getDb().readings.bulkDelete(aReemplazarIds);
    }
    historialPorAstro[t.id] = todasR.filter((r) => r.sol == null || r.sol <= solAnterior);
    sintomasPorAstro[t.id] = todasS.filter((s) => s.sol == null || s.sol <= solAnterior);
  }

  const cabinaHistorica = await getCabinTelemetry();
  let cabinaPrevia = cabinaHistorica.filter((c) => c.sol <= solAnterior).at(-1) ?? null;

  const nuevasLecturas = [];
  const nuevosSintomas = [];
  const nuevasCabinas = [];

  for (let paso = 1; paso <= nSoles; paso++) {
    const solSim = solAnterior + paso;
    let cabinaDelSolGuardada = null;

    for (const astronauta of tripulacion) {
      const paquete = generarPaqueteSol({
        astronauta,
        sol: solSim,
        paso,
        historial: historialPorAstro[astronauta.id],
        cabinaPrevia,
        perfil,
        artefactos,
        enRefugio,
        seed: seed != null ? seed + paso * 101 + (astronauta.id === 'ana' ? 1 : 2) : undefined,
      });

      historialPorAstro[astronauta.id].push(...paquete.lecturas);
      sintomasPorAstro[astronauta.id].push(...paquete.sintomas);
      nuevasLecturas.push(...paquete.lecturas);
      nuevosSintomas.push(...paquete.sintomas);

      if (!cabinaDelSolGuardada) {
        cabinaDelSolGuardada = paquete.cabina;
      }
    }

    if (cabinaDelSolGuardada) {
      cabinaPrevia = cabinaDelSolGuardada;
      nuevasCabinas.push(cabinaDelSolGuardada);
    }
  }

  // Persistimos todo en BD (IndexedDB + Supabase)
  if (nuevasCabinas.length) await saveCabinTelemetry(nuevasCabinas);
  if (nuevasLecturas.length) await addReadings(nuevasLecturas);
  if (nuevosSintomas.length) await addSymptoms(nuevosSintomas);

  // Analizamos de inmediato cada tripulante con los datos recién cargados en BD
  const evaluacionesPorTripulante = {};
  const alertasNuevas = [];

  for (const astronauta of tripulacion) {
    const ev = evaluate(historialPorAstro[astronauta.id], astronauta.baseline ?? {}, entorno, {
      symptoms: sintomasPorAstro[astronauta.id],
      sol: solNuevo,
    });
    evaluacionesPorTripulante[astronauta.id] = ev;
    await replaceAlerts(astronauta.id, ev.alerts);

    if (ev.alerts.length > 0 && ev.globalLevel !== 'green') {
      const principal = ev.alerts[0];
      const notif = {
        id: `sim-alerta-${astronauta.id}-sol${solNuevo}-${principal.ruleId}`,
        astronautId: astronauta.id,
        sol: solNuevo,
        tipo: 'alerta',
        color: ev.globalLevel,
        nivel: ev.globalLevel,
        titulo: `${astronauta.name} · ${principal.title}`,
        mensaje: `Detectado tras simular hasta Sol ${solNuevo} (${PERFILES_SIMULACION[perfil]?.etiqueta ?? perfil}): ${principal.why}`,
        ruta: `/salud/${principal.zone === 'brain' ? 'mental' : 'riesgos'}`,
        meta: { sol: solNuevo, perfil, ruleId: principal.ruleId },
      };
      alertasNuevas.push(notif);
      await addNotificationDb(notif);
    }
  }

  const totalSoles = Math.max(estadoActual.totalSoles ?? 60, solNuevo);
  const nuevoEstadoMision = await saveMissionState({
    ...estadoActual,
    solActual: solNuevo,
    totalSoles,
    simulacionActiva: { perfil, ultimoAvance: nSoles, enRefugio, ts: new Date().toISOString() },
  });

  return {
    solAnterior,
    solNuevo,
    cantidad: nSoles,
    perfil,
    lecturasGeneradas: nuevasLecturas.length,
    sintomasGenerados: nuevosSintomas.length,
    ultimaCabina: cabinaPrevia,
    evaluacionesPorTripulante,
    alertasNuevas,
    estadoMision: nuevoEstadoMision,
  };
}

/**
 * Inyecta una lectura puntual de un artefacto específico en el sol indicado,
 * guarda en BD y devuelve la nueva evaluación clínica al instante.
 */
export async function inyectarArtefactoEnSol({
  astronautId = 'ana',
  sol,
  artefactoId = 'watch',
  perfil = 'nominal',
  enRefugio = false,
  seed,
}) {
  const estado = await getMissionState();
  const solObjetivo = sol ?? estado?.solActual ?? 42;
  const tripulacionDb = await listAstronauts();
  const astronauta = tripulacionDb.find((t) => t.id === astronautId) ?? TRIPULANTES.find((t) => t.id === astronautId) ?? TRIPULANTES[0];
  const [historial, sintomas, cab] = await Promise.all([
    getReadings(astronauta.id),
    getSymptoms(astronauta.id),
    getCabinTelemetry(),
  ]);

  const paquete = generarPaqueteSol({
    astronauta,
    sol: solObjetivo,
    paso: 1,
    historial,
    cabinaPrevia: cab.at(-1) ?? null,
    perfil,
    artefactos: [artefactoId],
    enRefugio,
    seed,
  });

  if (artefactoId === 'cabina_eclss' || artefactoId === 'dosimetro_rad') {
    await saveCabinTelemetry([paquete.cabina]);
  }
  if (paquete.lecturas.length) await addReadings(paquete.lecturas);
  if (paquete.sintomas.length) await addSymptoms(paquete.sintomas);

  const [lecturasActualizadas, sintomasActualizados] = await Promise.all([
    getReadings(astronauta.id),
    getSymptoms(astronauta.id),
  ]);
  const evaluacion = evaluate(lecturasActualizadas, astronauta.baseline ?? {}, estado?.entorno ?? 'mars_base', {
    symptoms: sintomasActualizados,
    sol: solObjetivo,
  });
  await replaceAlerts(astronauta.id, evaluacion.alerts);

  return {
    sol: solObjetivo,
    artefactoId,
    lecturas: paquete.lecturas,
    sintomas: paquete.sintomas,
    cabina: paquete.cabina,
    evaluacion,
  };
}
