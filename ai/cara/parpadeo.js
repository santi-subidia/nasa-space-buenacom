// Fatiga a partir del parpadeo (issue #20). MediaPipe Face Landmarker (en el navegador) entrega por cuadro
// los "blendshapes" eyeBlinkLeft / eyeBlinkRight (0 = ojo abierto, 1 = cerrado). Acá se convierte esa serie en:
//   - parpadeos por minuto, y
//   - porcentaje de tiempo con los ojos cerrados (PERCLOS, un indicador clásico de somnolencia).
// Es lógica pura: la captura con la webcam la hace la pantalla.

/** Un ojo cuenta como cerrado por encima de este puntaje de blendshape. */
export const UMBRAL_CIERRE = 0.5;
/** Un cierre más largo que esto ya no es un parpadeo sino una "microsiesta" / ojos cerrados sostenidos. */
const PARPADEO_MAX_MS = 400;

/**
 * @param {{t:number, cierre:number}[]} muestras  t en ms; cierre = promedio de eyeBlinkLeft/Right (0–1)
 * @returns {{parpadeos:number, parpadeosPorMin:number, pctOjosCerrados:number, cierresLargos:number, duracionSeg:number}|null}
 *   null si hay muy pocas muestras para concluir algo (menos de 10 s).
 */
export function analizarParpadeos(muestras) {
  const datos = [...muestras].filter((m) => Number.isFinite(m?.t) && Number.isFinite(m?.cierre)).sort((a, b) => a.t - b.t);
  if (datos.length < 2) return null;
  const duracionMs = datos.at(-1).t - datos[0].t;
  if (duracionMs < 10_000) return null;

  let cerradoMs = 0;
  let parpadeos = 0;
  let cierresLargos = 0;
  let inicioCierre = null;

  for (let i = 1; i < datos.length; i++) {
    const cerrado = datos[i - 1].cierre >= UMBRAL_CIERRE;
    if (cerrado) cerradoMs += datos[i].t - datos[i - 1].t;
    const ahoraCerrado = datos[i].cierre >= UMBRAL_CIERRE;
    if (ahoraCerrado && inicioCierre === null) inicioCierre = datos[i].t;
    if (!ahoraCerrado && inicioCierre !== null) {
      if (datos[i].t - inicioCierre > PARPADEO_MAX_MS) cierresLargos++;
      else parpadeos++;
      inicioCierre = null;
    }
  }

  return {
    parpadeos,
    parpadeosPorMin: Math.round((parpadeos / (duracionMs / 60_000)) * 10) / 10,
    pctOjosCerrados: Math.round((cerradoMs / duracionMs) * 1000) / 10,
    cierresLargos,
    duracionSeg: Math.round(duracionMs / 1000),
  };
}

/**
 * Semáforo de fatiga. Los umbrales son orientativos (en reposo se parpadea ~12–20 veces por minuto y un
 * PERCLOS sostenido por encima del 15–20 % se asocia a somnolencia) y se pueden configurar.
 * @returns {{nivel:'normal'|'atencion'|'alto', mensaje:string}}
 */
export function clasificarFatiga({ parpadeosPorMin, pctOjosCerrados, cierresLargos = 0 }, umbrales = {}) {
  const { pctAtencion = 8, pctAlto = 15, minParpadeosAtencion = 8 } = umbrales;
  if (pctOjosCerrados >= pctAlto || cierresLargos >= 3) {
    return { nivel: 'alto', mensaje: 'Your eyes stay closed for long periods: a sign of marked fatigue. Rest and check how much you slept.' };
  }
  if (pctOjosCerrados >= pctAtencion || parpadeosPorMin < minParpadeosAtencion) {
    return { nivel: 'atencion', mensaje: 'I see mild signs of fatigue in your blinking. A short break is advisable.' };
  }
  return { nivel: 'normal', mensaje: 'Your blinking looks normal.' };
}
