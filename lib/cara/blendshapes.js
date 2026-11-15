// Utilidades puras para "¿Cómo me ves hoy?" (#20):
// extrae eyeBlinkLeft/Right de MediaPipe Face Landmarker para alimentar `analizarParpadeos()`.

export const ASPECTOS_CARAS = {
  ojeras: 'Dark circles',
  palidez: 'Paleness',
  hinchazon: 'Facial puffiness',
  lesion_piel: 'Skin or lip lesion',
  fatiga_ojos: 'Eye fatigue',
  sin_cambios: 'No visible changes',
};

export const INTENSIDAD_ETIQUETA = {
  ninguna: 'No changes',
  leve: 'Mild',
  moderada: 'Moderate',
  notable: 'Notable',
};

export const ZONAS_CARA = {
  brain: 'Brain',
  eyes: 'Eyes',
  immune: 'Immune',
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
