// Motor estadístico puro para el Test Sensoriomotor y Cognitivo (30 s):
// Bloque 1: Pilotaje Go/No-Go (tiempo de reacción, lapsos, precisión e impulsividad).
// Bloque 2: Estabilidad Vestibular VOR (cabeza + fijación ocular).

export const DURACION_PVT_S = 30;
export const DURACION_BLOQUE1_S = 15;
export const DURACION_BLOQUE2_S = 15;
export const ISI_MIN_MS = 850;
export const ISI_MAX_MS = 1900;
export const TIMEOUT_BALIZA_MS = 2600;
export const UMBRAL_LAPSO_MS = 355;
export const UMBRAL_ANTICIPACION_MS = 100;
export const FEEDBACK_MS = 650;

const promedio = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function medianaOrdenada(ordenados) {
  const n = ordenados.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? ordenados[mid] : (ordenados[mid - 1] + ordenados[mid]) / 2;
}

/**
 * Procesa los eventos crudos del Bloque 1 (PVT / Pilotaje Go-NoGo) y opcionalmente Bloque 2 (VOR).
 * @param {Array<{ tipo: 'ok'|'anticipado'|'nogo_error'|'nogo_ok', rtMs?: number, precisionPct?: number, capturaMs?: number, tsMs?: number }>} eventos
 * @param {{ umbralLapsoMs?: number, umbralAnticipacionMs?: number, baselineMs?: number, vor?: object, modoEntrada?: string }} [opciones]
 */
export function calcularMetricasPvt(eventos = [], opciones = {}) {
  const umbralLapsoMs = opciones.umbralLapsoMs ?? UMBRAL_LAPSO_MS;
  const umbralAnticipacionMs = opciones.umbralAnticipacionMs ?? UMBRAL_ANTICIPACION_MS;
  const baselineMs = typeof opciones.baselineMs === 'number' ? opciones.baselineMs : null;
  const vor = opciones.vor ?? null;
  const modoEntrada = opciones.modoEntrada ?? 'puntero';

  const validos = [];
  const precisiones = [];
  const ensayos = [];
  let falsosInicios = 0;
  let erroresNoGo = 0;
  let aciertosNoGo = 0;

  eventos.forEach((ev, idx) => {
    const rt = typeof ev?.rtMs === 'number' ? Math.round(ev.rtMs) : null;
    if (ev?.tipo === 'nogo_error') {
      erroresNoGo += 1;
      return;
    }
    if (ev?.tipo === 'nogo_ok') {
      aciertosNoGo += 1;
      return;
    }

    const esAnticipado = ev?.tipo === 'anticipado' || (ev?.tipo === 'ok' && (rt == null || rt < umbralAnticipacionMs));
    if (esAnticipado) {
      falsosInicios += 1;
      ensayos.push({ n: idx + 1, rtMs: null, lapso: false, anticipado: true });
      return;
    }

    if (ev?.tipo === 'ok' && rt != null) {
      validos.push(rt);
      if (typeof ev.precisionPct === 'number') precisiones.push(ev.precisionPct);
      ensayos.push({
        n: idx + 1,
        rtMs: rt,
        lapso: rt >= umbralLapsoMs,
        anticipado: false,
        capturaMs: typeof ev.capturaMs === 'number' ? Math.round(ev.capturaMs) : null,
      });
    }
  });

  const estabilidadVor = typeof vor?.estabilidadVor === 'number' ? vor.estabilidadVor : null;
  const amplitudYawDeg = typeof vor?.amplitudYawDeg === 'number' ? vor.amplitudYawDeg : null;

  if (!validos.length) {
    const baseScore = falsosInicios > 0 || erroresNoGo > 0 ? 0 : null;
    return {
      intentos: 0,
      falsosInicios,
      lapsos: 0,
      erroresNoGo,
      aciertosNoGo,
      ms: null,
      medianaMs: null,
      mediaMs: null,
      fastest10Ms: null,
      slowest10Ms: null,
      velocidadMedia: null,
      precisionPct: null,
      estabilidadVor,
      amplitudYawDeg,
      modoEntrada,
      deltaBaseMs: null,
      score: baseScore,
      ensayos,
    };
  }

  const ordenados = [...validos].sort((a, b) => a - b);
  const k10 = Math.max(1, Math.round(ordenados.length * 0.1));
  const fastest10 = promedio(ordenados.slice(0, k10));
  const slowest10 = promedio(ordenados.slice(-k10));

  const medianaMs = Math.round(medianaOrdenada(ordenados));
  const mediaMs = Math.round(promedio(validos));
  const lapsos = validos.filter((rt) => rt >= umbralLapsoMs).length;
  const velocidadMedia = Number(promedio(validos.map((rt) => 1000 / rt)).toFixed(2));
  const precisionPct = precisiones.length ? Math.round(promedio(precisiones)) : null;

  const totalEventos = validos.length + falsosInicios + erroresNoGo + aciertosNoGo;
  const errores = lapsos + falsosInicios + erroresNoGo;
  const scorePvt = Math.max(0, Math.min(100, Math.round((1 - errores / totalEventos) * 100)));
  const score = estabilidadVor != null ? Math.round(scorePvt * 0.7 + estabilidadVor * 0.3) : scorePvt;

  return {
    intentos: validos.length,
    falsosInicios,
    lapsos,
    erroresNoGo,
    aciertosNoGo,
    ms: medianaMs,
    medianaMs,
    mediaMs,
    fastest10Ms: Math.round(fastest10),
    slowest10Ms: Math.round(slowest10),
    velocidadMedia,
    precisionPct,
    estabilidadVor,
    amplitudYawDeg,
    modoEntrada,
    deltaBaseMs: baselineMs != null ? medianaMs - Math.round(baselineMs) : null,
    score,
    ensayos,
  };
}

/**
 * Serializa el resumen PVT + Vestibular para guardarlo en `Reading.note`.
 * @param {ReturnType<typeof calcularMetricasPvt>} metricas
 * @param {number} [duracionS]
 */
export function formatearNotaPvt(metricas, duracionS = DURACION_PVT_S) {
  if (!metricas || metricas.medianaMs == null) return '';
  return JSON.stringify({
    tipo: 'pvt',
    duracionS,
    modoEntrada: metricas.modoEntrada ?? 'puntero',
    medianaMs: metricas.medianaMs,
    mediaMs: metricas.mediaMs,
    intentos: metricas.intentos,
    lapsos: metricas.lapsos,
    falsosInicios: metricas.falsosInicios,
    erroresNoGo: metricas.erroresNoGo ?? 0,
    aciertosNoGo: metricas.aciertosNoGo ?? 0,
    precisionPct: metricas.precisionPct ?? null,
    estabilidadVor: metricas.estabilidadVor ?? null,
    amplitudYawDeg: metricas.amplitudYawDeg ?? null,
    fastest10Ms: metricas.fastest10Ms,
    slowest10Ms: metricas.slowest10Ms,
    velocidadMedia: metricas.velocidadMedia,
    score: metricas.score,
  });
}

/**
 * Parsea `Reading.note` si contiene un resumen JSON de PVT.
 * @param {string|null|undefined} note
 */
export function parsearNotaPvt(note) {
  if (!note || typeof note !== 'string') return null;
  const texto = note.trim();
  if (!texto.startsWith('{')) return null;
  try {
    const obj = JSON.parse(texto);
    return obj?.tipo === 'pvt' ? obj : null;
  } catch {
    return null;
  }
}
