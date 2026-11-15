// Cálculos puros de geometría facial y estabilidad vestibular (Reflejo Vestíbulo-Ocular - VOR)
// a partir de landmarks 2D/3D normalizados de MediaPipe FaceLandmarker.

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Estima ángulo de giro horizontal (yaw en grados) y vertical (pitch relativo) del rostro.
 * @param {Array<{ x: number, y: number, z?: number }>} landmarks  468/478 puntos de FaceLandmarker
 * @returns {{ yawDeg: number, pitchRel: number } | null}
 */
export function calcularOrientacionCabeza(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 264) return null;
  const nariz = landmarks[1];
  const ojoIzq = landmarks[33];
  const ojoDer = landmarks[263];
  const frente = landmarks[10];
  const menton = landmarks[152];
  if (!nariz || !ojoIzq || !ojoDer || !frente || !menton) return null;

  const midX = (ojoIzq.x + ojoDer.x) / 2;
  const midY = (ojoIzq.y + ojoDer.y) / 2;
  const anchoOjos = Math.hypot(ojoDer.x - ojoIzq.x, ojoDer.y - ojoIzq.y);
  const altoCara = Math.hypot(menton.x - frente.x, menton.y - frente.y);
  if (anchoOjos < 0.02 || altoCara < 0.04) return null;

  // Invertimos el signo para que girar a la derecha en imagen espejada sea yaw positivo.
  const ratioYaw = clamp(-(nariz.x - midX) / (anchoOjos * 0.45), -1, 1);
  const yawDeg = Number((Math.asin(ratioYaw) * (180 / Math.PI)).toFixed(1));
  const pitchRel = Number(((nariz.y - midY) / altoCara).toFixed(3));

  return { yawDeg, pitchRel };
}

/**
 * Extrae cierre ocular promedio y asimetría horizontal de mirada desde blendshapes de FaceLandmarker.
 * @param {Array<{ categories: Array<{ categoryName: string, score: number }> }>} faceBlendshapes
 */
export function extraerEstadoOcular(faceBlendshapes) {
  const cats = faceBlendshapes?.[0]?.categories;
  if (!Array.isArray(cats) || !cats.length) return null;

  const mapa = Object.fromEntries(cats.map((c) => [c.categoryName, c.score]));
  const cierre = ((mapa.eyeBlinkLeft ?? 0) + (mapa.eyeBlinkRight ?? 0)) / 2;

  // Mirada hacia izquierda vs derecha en coordenadas de la persona.
  const mirarIzq = ((mapa.eyeLookOutLeft ?? 0) + (mapa.eyeLookInRight ?? 0)) / 2;
  const mirarDer = ((mapa.eyeLookInLeft ?? 0) + (mapa.eyeLookOutRight ?? 0)) / 2;
  const miradaHoriz = Number((mirarDer - mirarIzq).toFixed(3));

  return {
    cierre: Number(cierre.toFixed(3)),
    ojosAbiertos: cierre < 0.45,
    miradaHoriz,
  };
}

/**
 * Evalúa las muestras del Bloque 2 (15 s de chequeo vestibular VOR o seguimiento estable).
 * @param {Array<{ tMs: number, yawDeg: number, objetivoYawDeg: number, ojosAbiertos: boolean }>} muestras
 */
export function calcularMetricasVor(muestras = []) {
  if (!Array.isArray(muestras) || muestras.length < 3) {
    return {
      muestras: muestras?.length ?? 0,
      amplitudYawDeg: 0,
      sincroniaVorPct: null,
      estabilidadOcularPct: null,
      estabilidadVor: null,
    };
  }

  const yaws = muestras.map((m) => m.yawDeg);
  const maxYaw = Math.max(...yaws);
  const minYaw = Math.min(...yaws);
  const amplitudYawDeg = Math.round(maxYaw - minYaw);

  // Qué porcentaje de las muestras siguió la dirección solicitada (error <= 14° o signo coincidente con objetivo != 0).
  let aciertosRitmo = 0;
  let ojosOk = 0;
  let cambiosBruscos = 0;

  for (let i = 0; i < muestras.length; i++) {
    const m = muestras[i];
    if (m.ojosAbiertos) ojosOk += 1;

    const err = Math.abs(m.yawDeg - m.objetivoYawDeg);
    const mismoLado = Math.abs(m.objetivoYawDeg) >= 8 && Math.sign(m.yawDeg) === Math.sign(m.objetivoYawDeg) && Math.abs(m.yawDeg) >= 6;
    if (err <= 14 || mismoLado) aciertosRitmo += 1;

    if (i > 0) {
      const dt = Math.max(16, m.tMs - muestras[i - 1].tMs);
      const vel = Math.abs(m.yawDeg - muestras[i - 1].yawDeg) / (dt / 1000);
      if (vel > 220) cambiosBruscos += 1; // sacudida cervical atípica (> 220 °/s)
    }
  }

  const sincroniaRaw = (aciertosRitmo / muestras.length) * 100;
  const penalizacionTemblor = Math.min(25, (cambiosBruscos / muestras.length) * 100);
  const sincroniaVorPct = Math.round(clamp(sincroniaRaw - penalizacionTemblor, 0, 100));
  const estabilidadOcularPct = Math.round((ojosOk / muestras.length) * 100);

  // Si casi no movió la cabeza (< 10° total), penalizamos suavemente la amplitud esperada.
  const factorMov = amplitudYawDeg >= 14 ? 1 : amplitudYawDeg / 14;
  const estabilidadVor = Math.round(clamp((sincroniaVorPct * 0.6 + estabilidadOcularPct * 0.4) * (0.4 + 0.6 * factorMov), 0, 100));

  return {
    muestras: muestras.length,
    amplitudYawDeg,
    sincroniaVorPct,
    estabilidadOcularPct,
    estabilidadVor,
  };
}
