// Fotopletismografía remota (rPPG) 100 % en cliente a partir de landmarks faciales de MediaPipe.
// Pipeline: ROIs (frente + mejillas) -> remuestreo uniforme -> POS (Plane-Orthogonal-to-Skin)
// -> detrend + pasa banda Butterworth orden 2 (fase cero) -> ventana Hann + FFT -> BPM + SQI.
// Prototipo educativo; no es un dispositivo médico.

export const FS_OBJETIVO = 30;
export const DURACION_MIN_MS = 8_000;
export const VENTANA_MAX_MS = 18_000;
export const F_MIN_HZ = 0.7; // 42 lpm
export const F_MAX_HZ = 3.0; // 180 lpm

// Subconjuntos de Face Mesh (478 landmarks) para piel estable evitando ojos, cejas, boca y pelo.
const LANDMARKS_FRENTE = [107, 336, 151, 9];
const LANDMARKS_MEJILLA_IZQ = [50, 101, 118, 123, 205];
const LANDMARKS_MEJILLA_DER = [280, 330, 347, 352, 425];
const ROI_TAM = 24;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Calcula cajas acotadas en píxeles para frente y ambas mejillas desde `faceLandmarks[0]`.
 * Devuelve `null` si faltan landmarks esenciales.
 */
export function calcularCajasRoi(landmarks, width, height) {
  if (!Array.isArray(landmarks) || landmarks.length < 430 || !width || !height) return null;

  const cajaDesdeIndices = (indices, pad = 0) => {
    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;
    for (const idx of indices) {
      const p = landmarks[idx];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const sx = clamp(Math.floor((minX + pad) * width), 0, width - 2);
    const sy = clamp(Math.floor((minY + pad) * height), 0, height - 2);
    const ex = clamp(Math.ceil((maxX - pad) * width), sx + 2, width);
    const ey = clamp(Math.ceil((maxY - pad) * height), sy + 2, height);
    const sw = ex - sx;
    const sh = ey - sy;
    return sw >= 4 && sh >= 4 ? { sx, sy, sw, sh } : null;
  };

  const frente = cajaDesdeIndices(LANDMARKS_FRENTE, 0.005);
  const mejillaIzq = cajaDesdeIndices(LANDMARKS_MEJILLA_IZQ, 0.004);
  const mejillaDer = cajaDesdeIndices(LANDMARKS_MEJILLA_DER, 0.004);
  const cajas = [frente, mejillaIzq, mejillaDer].filter(Boolean);
  if (!cajas.length) return null;

  const nariz = landmarks[1];
  const ojoIzq = landmarks[33];
  const ojoDer = landmarks[263];
  const escala =
    ojoIzq && ojoDer
      ? Math.hypot(ojoDer.x - ojoIzq.x, ojoDer.y - ojoIzq.y)
      : 0.2;

  return {
    cajas,
    centro: nariz ? { x: nariz.x, y: nariz.y, escala: Math.max(escala, 0.05) } : null,
  };
}

/**
 * Dibuja las ROIs en un único canvas pequeño (`72×24`) para hacer una sola lectura `getImageData`
 * y promediar RGB excluyendo píxeles saturados o casi negros.
 */
export function extraerMuestraRppg(landmarks, video, canvas, centroPrevio = null) {
  if (!landmarks || !video || !canvas) return null;
  const width = video.videoWidth || video.width;
  const height = video.videoHeight || video.height;
  const info = calcularCajasRoi(landmarks, width, height);
  if (!info) return null;

  const { cajas, centro } = info;
  const totalAncho = ROI_TAM * cajas.length;
  if (canvas.width !== totalAncho || canvas.height !== ROI_TAM) {
    canvas.width = totalAncho;
    canvas.height = ROI_TAM;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  for (let i = 0; i < cajas.length; i += 1) {
    const { sx, sy, sw, sh } = cajas[i];
    ctx.drawImage(video, sx, sy, sw, sh, i * ROI_TAM, 0, ROI_TAM, ROI_TAM);
  }

  const data = ctx.getImageData(0, 0, totalAncho, ROI_TAM).data;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxC = Math.max(r, g, b);
    if (maxC <= 12 || maxC >= 252) continue;
    sumR += r;
    sumG += g;
    sumB += b;
    count += 1;
  }

  if (count < 20) return null;

  let motion = 0;
  if (centro && centroPrevio) {
    motion = Math.hypot(centro.x - centroPrevio.x, centro.y - centroPrevio.y) / centro.escala;
  }

  return {
    r: sumR / count,
    g: sumG / count,
    b: sumB / count,
    motion,
    centro,
  };
}

/**
 * Interpola linealmente una serie irregular `{ t, r, g, b, motion? }` a frecuencia constante `fs`.
 */
export function remuestrearUniforme(muestras, fs = FS_OBJETIVO) {
  if (!Array.isArray(muestras) || muestras.length < 2) return null;
  const ordenadas = [...muestras].sort((a, b) => a.t - b.t);
  const t0 = ordenadas[0].t;
  const tEnd = ordenadas[ordenadas.length - 1].t;
  const duracionMs = tEnd - t0;
  if (duracionMs <= 0) return null;

  const dt = 1000 / fs;
  const n = Math.floor(duracionMs / dt) + 1;
  const r = new Float64Array(n);
  const g = new Float64Array(n);
  const b = new Float64Array(n);
  const motion = new Float64Array(n);

  let j = 0;
  for (let k = 0; k < n; k += 1) {
    const t = t0 + k * dt;
    while (j < ordenadas.length - 2 && ordenadas[j + 1].t < t) j += 1;
    const p0 = ordenadas[j];
    const p1 = ordenadas[Math.min(j + 1, ordenadas.length - 1)];
    const span = p1.t - p0.t;
    const alpha = span > 0 ? clamp((t - p0.t) / span, 0, 1) : 0;

    r[k] = p0.r + (p1.r - p0.r) * alpha;
    g[k] = p0.g + (p1.g - p0.g) * alpha;
    b[k] = p0.b + (p1.b - p0.b) * alpha;
    motion[k] = (p0.motion ?? 0) + ((p1.motion ?? 0) - (p0.motion ?? 0)) * alpha;
  }

  return { fs, duracionMs, r, g, b, motion };
}

function mediaYDesvio(arr, inicio, fin) {
  const len = fin - inicio;
  let suma = 0;
  for (let i = inicio; i < fin; i += 1) suma += arr[i];
  const media = suma / len;
  let sq = 0;
  for (let i = inicio; i < fin; i += 1) {
    const d = arr[i] - media;
    sq += d * d;
  }
  return { media, std: Math.sqrt(sq / len) };
}

/**
 * Proyección Plane-Orthogonal-to-Skin (POS, Wang et al. 2017) con ventanas solapadas.
 */
export function extraerSenalPos(serieUniforme, ventanaSeg = 1.6) {
  const { fs, r, g, b } = serieUniforme;
  const n = r.length;
  const L = Math.max(8, Math.round(ventanaSeg * fs));
  const H = new Float64Array(n);
  const pesos = new Float64Array(n);

  if (n < L) return H;

  const s1 = new Float64Array(L);
  const s2 = new Float64Array(L);

  for (let inicio = 0; inicio <= n - L; inicio += 1) {
    const fin = inicio + L;
    const mR = mediaYDesvio(r, inicio, fin).media;
    const mG = mediaYDesvio(g, inicio, fin).media;
    const mB = mediaYDesvio(b, inicio, fin).media;
    if (mR < 6 || mG < 6) continue;

    // Bajo iluminación cálida/amarilla el canal azul puede ser muy bajo (< 14) y amplificar ruido:
    // en ese caso usamos diferencia normalizada Verde - Rojo, que conserva el pulso y cancela brillo común.
    if (mB < 14) {
      let meanH = 0;
      for (let i = 0; i < L; i += 1) {
        const rn = r[inicio + i] / mR;
        const gn = g[inicio + i] / mG;
        s1[i] = gn - rn;
        meanH += s1[i];
      }
      meanH /= L;
      for (let i = 0; i < L; i += 1) {
        H[inicio + i] += s1[i] - meanH;
        pesos[inicio + i] += 1;
      }
      continue;
    }

    for (let i = 0; i < L; i += 1) {
      const rn = r[inicio + i] / mR;
      const gn = g[inicio + i] / mG;
      const bn = b[inicio + i] / mB;
      s1[i] = gn - bn;
      s2[i] = gn + bn - 2 * rn;
    }

    const std1 = mediaYDesvio(s1, 0, L).std;
    const std2 = mediaYDesvio(s2, 0, L).std;
    const alpha = std2 > 1e-8 ? std1 / std2 : 0;

    let meanH = 0;
    for (let i = 0; i < L; i += 1) meanH += s1[i] + alpha * s2[i];
    meanH /= L;

    for (let i = 0; i < L; i += 1) {
      H[inicio + i] += s1[i] + alpha * s2[i] - meanH;
      pesos[inicio + i] += 1;
    }
  }

  for (let i = 0; i < n; i += 1) {
    if (pesos[i] > 0) H[i] /= pesos[i];
  }
  return H;
}

function detrendLineal(arr) {
  const n = arr.length;
  if (n < 2) return Float64Array.from(arr);
  const meanX = (n - 1) / 2;
  let meanY = 0;
  for (let i = 0; i < n; i += 1) meanY += arr[i];
  meanY /= n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = i - meanX;
    num += dx * (arr[i] - meanY);
    den += dx * dx;
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;

  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) out[i] = arr[i] - (slope * i + intercept);
  return out;
}

function coeficientesBiquadButterworth(tipo, fc, fs) {
  const omega = (2 * Math.PI * fc) / fs;
  const sinW = Math.sin(omega);
  const cosW = Math.cos(omega);
  const alpha = sinW / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;

  if (tipo === 'lowpass') {
    return {
      b0: (1 - cosW) / 2 / a0,
      b1: (1 - cosW) / a0,
      b2: (1 - cosW) / 2 / a0,
      a1: (-2 * cosW) / a0,
      a2: (1 - alpha) / a0,
    };
  }
  return {
    b0: (1 + cosW) / 2 / a0,
    b1: -(1 + cosW) / a0,
    b2: (1 + cosW) / 2 / a0,
    a1: (-2 * cosW) / a0,
    a2: (1 - alpha) / a0,
  };
}

function aplicarBiquad(x, c) {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const x0 = x[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    y[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return y;
}

function filtfiltBiquad(x, c) {
  const n = x.length;
  const pad = Math.min(30, Math.max(0, n - 1));
  if (pad === 0) return Float64Array.from(x);

  const ext = new Float64Array(n + 2 * pad);
  for (let i = 0; i < pad; i += 1) ext[i] = 2 * x[0] - x[pad - i];
  for (let i = 0; i < n; i += 1) ext[pad + i] = x[i];
  for (let i = 0; i < pad; i += 1) ext[pad + n + i] = 2 * x[n - 1] - x[n - 2 - i];

  const fwd = aplicarBiquad(ext, c);
  fwd.reverse();
  const bwd = aplicarBiquad(fwd, c);
  bwd.reverse();
  return bwd.slice(pad, pad + n);
}

/**
 * Elimina tendencia lineal y aplica filtro pasa banda Butterworth orden 2 de fase cero.
 */
export function filtrarPasaBanda(senal, fs = FS_OBJETIVO, fLow = F_MIN_HZ, fHigh = F_MAX_HZ) {
  const sinTendencia = detrendLineal(senal);
  const pasaAltos = coeficientesBiquadButterworth('highpass', fLow, fs);
  const pasaBajos = coeficientesBiquadButterworth('lowpass', fHigh, fs);
  return filtfiltBiquad(filtfiltBiquad(sinTendencia, pasaAltos), pasaBajos);
}

/**
 * FFT radix-2 in-place (Cooley-Tukey). `re.length` debe ser potencia de 2.
 */
function fftRadix2(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j += 1) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * wRe - im[i + j + half] * wIm;
        const vIm = re[i + j + half] * wIm + im[i + j + half] * wRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nextWRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextWRe;
      }
    }
  }
}

function normalizarOnda(senal, maxPuntos = 120) {
  const recorte = senal.length > maxPuntos ? senal.slice(senal.length - maxPuntos) : senal;
  const absolutos = Array.from(recorte, (v) => Math.abs(v)).sort((a, b) => a - b);
  const escala = absolutos[Math.floor(absolutos.length * 0.95)] || absolutos.at(-1) || 0;
  if (escala < 1e-8) return Array.from(recorte, () => 0);
  return Array.from(recorte, (v) => Number(clamp(v / escala, -1, 1).toFixed(3)));
}

function autocorrelacionEnLag(arr, lag) {
  if (lag <= 0 || lag >= arr.length - 4) return 0;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < arr.length - lag; i += 1) {
    const a = arr[i];
    const b = arr[i + lag];
    num += a * b;
    denA += a * a;
    denB += b * b;
  }
  const den = Math.sqrt(denA * denB);
  return den > 1e-10 ? num / den : 0;
}

/**
 * Estima la frecuencia cardíaca (lpm), confianza (SQI) y forma de onda a partir de muestras `{ t, r, g, b, motion? }`.
 */
export function estimarPulsoRppg(muestras) {
  if (!Array.isArray(muestras) || muestras.length < 2) {
    return { listo: false, bpm: null, confianza: 'baja', sqi: 0, onda: [], duracionSeg: 0, motivo: 'poca_duracion' };
  }

  const ultimoT = muestras[muestras.length - 1].t;
  const ventana = muestras.filter((m) => ultimoT - m.t <= VENTANA_MAX_MS);
  const duracionMs = ultimoT - ventana[0].t;
  const duracionSeg = Math.max(0, Math.round(duracionMs / 1000));

  if (duracionMs < DURACION_MIN_MS || ventana.length < 60) {
    return { listo: false, bpm: null, confianza: 'baja', sqi: 0, onda: [], duracionSeg, motivo: 'poca_duracion' };
  }

  const uniforme = remuestrearUniforme(ventana, FS_OBJETIVO);
  if (!uniforme || uniforme.r.length < 120) {
    return { listo: false, bpm: null, confianza: 'baja', sqi: 0, onda: [], duracionSeg, motivo: 'poca_duracion' };
  }

  const rMedio = mediaYDesvio(uniforme.r, 0, uniforme.r.length).media;
  const brilloMedio = mediaYDesvio(uniforme.g, 0, uniforme.g.length).media;
  const movimientoMedio = mediaYDesvio(uniforme.motion, 0, uniforme.motion.length).media;

  const pos = extraerSenalPos(uniforme, 1.6);
  const filtrada = filtrarPasaBanda(pos, FS_OBJETIVO, F_MIN_HZ, F_MAX_HZ);
  const onda = normalizarOnda(filtrada, 120);

  if (Math.max(rMedio, brilloMedio) < 18 || brilloMedio > 248) {
    return { listo: true, bpm: null, confianza: 'baja', sqi: 0, onda, duracionSeg, motivo: 'luz_extrema' };
  }
  if (movimientoMedio > 0.025) {
    return { listo: true, bpm: null, confianza: 'baja', sqi: 0, onda, duracionSeg, motivo: 'mucho_movimiento' };
  }

  const N = filtrada.length;
  const M = 2048;
  const re = new Float64Array(M);
  const im = new Float64Array(M);
  for (let i = 0; i < N; i += 1) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    re[i] = filtrada[i] * hann;
  }

  fftRadix2(re, im);

  const kMin = Math.ceil((F_MIN_HZ * M) / FS_OBJETIVO);
  const kMax = Math.floor((F_MAX_HZ * M) / FS_OBJETIVO);
  const potencia = new Float64Array(kMax + 2);

  let kPico = kMin;
  let maxP = -1;
  let potenciaBanda = 0;

  for (let k = kMin - 1; k <= kMax + 1; k += 1) {
    const p = re[k] * re[k] + im[k] * im[k];
    potencia[k] = p;
    if (k >= kMin && k <= kMax) {
      potenciaBanda += p;
      if (p > maxP) {
        maxP = p;
        kPico = k;
      }
    }
  }

  if (potenciaBanda <= 1e-10 || maxP <= 0) {
    return { listo: true, bpm: null, confianza: 'baja', sqi: 0, onda, duracionSeg, motivo: 'baja_calidad' };
  }

  // Interpolación parabólica para afinar la frecuencia del pico
  const pPrev = potencia[kPico - 1];
  const pCurr = potencia[kPico];
  const pNext = potencia[kPico + 1];
  const denom = pPrev - 2 * pCurr + pNext;
  const delta = Math.abs(denom) > 1e-12 ? clamp((0.5 * (pPrev - pNext)) / denom, -0.5, 0.5) : 0;
  const fPico = ((kPico + delta) * FS_OBJETIVO) / M;

  let potenciaPico = 0;
  let binsEnBanda = 0;
  for (let k = kMin; k <= kMax; k += 1) {
    const f = (k * FS_OBJETIVO) / M;
    binsEnBanda += 1;
    if (Math.abs(f - fPico) <= 0.12) potenciaPico += potencia[k];
  }

  const mediaBanda = potenciaBanda / Math.max(1, binsEnBanda);
  const peakToMean = mediaBanda > 0 ? maxP / mediaBanda : 0;
  const sqi = Number(clamp(potenciaPico / potenciaBanda, 0, 1).toFixed(2));
  const lagLatido = Math.round(FS_OBJETIVO / fPico);
  const acf = autocorrelacionEnLag(filtrada, lagLatido);

  if (sqi < 0.28 || peakToMean < 3.6 || acf < 0.22) {
    return { listo: true, bpm: null, confianza: 'baja', sqi, onda, duracionSeg, motivo: 'baja_calidad' };
  }

  const bpm = Math.round(fPico * 60);
  const confianza = sqi >= 0.48 && peakToMean >= 5.5 && acf >= 0.45 && movimientoMedio <= 0.01 ? 'alta' : 'media';

  return {
    listo: true,
    bpm,
    confianza,
    sqi,
    onda,
    duracionSeg,
    motivo: null,
  };
}
