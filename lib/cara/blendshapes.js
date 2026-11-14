// Utilidades puras para "¿Cómo me ves hoy?" (#20):
// extrae eyeBlinkLeft/Right de MediaPipe Face Landmarker para alimentar `analizarParpadeos()`.

export const ASPECTOS_CARAS = {
  ojeras: 'Ojeras',
  palidez: 'Palidez',
  hinchazon: 'Hinchazón facial',
  lesion_piel: 'Lesión en piel o labios',
  fatiga_ojos: 'Fatiga en los ojos',
  sin_cambios: 'Sin cambios visibles',
};

export const INTENSIDAD_ETIQUETA = {
  ninguna: 'Sin cambios',
  leve: 'Leve',
  moderada: 'Moderada',
  notable: 'Notable',
};

export const ZONAS_CARA = {
  brain: 'Cerebro',
  eyes: 'Ojos',
  immune: 'Inmunidad',
};

/**
 * Convierte `result.faceBlendshapes` de MediaPipe FaceLandmarker en un puntaje de cierre [0..1]
 * promediando `eyeBlinkLeft` y `eyeBlinkRight`. Devuelve `null` si no hay rostro detectado.
 */
export function extraerCierreBlendshapes(faceBlendshapes) {
  const categorias = faceBlendshapes?.[0]?.categories;
  if (!Array.isArray(categorias) || !categorias.length) return null;

  let left = null;
  let right = null;
  for (const c of categorias) {
    if (c.categoryName === 'eyeBlinkLeft') left = c.score;
    else if (c.categoryName === 'eyeBlinkRight') right = c.score;
  }
  if (!Number.isFinite(left) && !Number.isFinite(right)) return null;
  if (Number.isFinite(left) && Number.isFinite(right)) return (left + right) / 2;
  return Number.isFinite(left) ? left : right;
}
