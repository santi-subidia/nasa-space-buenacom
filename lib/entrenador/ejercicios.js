// Lógica del entrenador (sin cámara ni React, para poder probarla): recibe los 33 puntos de
// MediaPipe Pose por fotograma y devuelve repeticiones, fase, ángulo y correcciones.
// Los puntos vienen normalizados (x, y de 0 a 1; y crece hacia abajo) con `visibility`.

export const EJERCICIOS = {
  sentadilla: { id: 'sentadilla', nombre: 'Squats', unidad: 'reps', icono: '🏋️', consejo: 'Stand sideways to the camera with your full body visible.' },
  flexion: { id: 'flexion', nombre: 'Push-ups', unidad: 'reps', icono: '💪', consejo: 'Position yourself sideways with the camera near floor height.' },
  zancada: { id: 'zancada', nombre: 'Lunges', unidad: 'reps', icono: '🦵', consejo: 'Stand sideways with both legs clearly visible.' },
  plancha: { id: 'plancha', nombre: 'Plank', unidad: 'seconds', icono: '⏱', consejo: 'Position yourself sideways, supported on your forearms.' },
};

// Índices de MediaPipe Pose, por lado.
const LADOS = {
  I: { hombro: 11, codo: 13, muneca: 15, cadera: 23, rodilla: 25, tobillo: 27 },
  D: { hombro: 12, codo: 14, muneca: 16, cadera: 24, rodilla: 26, tobillo: 28 },
};

// Ángulos (grados) de cada ejercicio. `arriba`: posición inicial; `abajo`: lo que cuenta como repetición válida.
const UMBRALES = {
  sentadilla: { arriba: 160, abajo: 100, incompleta: 140 },
  flexion: { arriba: 150, abajo: 100, incompleta: 130 },
  zancada: { arriba: 150, abajo: 105, incompleta: 135 },
};
const VISIBILIDAD_MIN = 0.5;

/** Ángulo en `b` formado por los puntos a-b-c, en grados. */
export function angulo(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!m) return null;
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / m));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Inclinación del tronco respecto de la vertical (0° = derecho, 90° = horizontal). */
export function inclinacionTronco(hombro, cadera) {
  return (Math.atan2(Math.abs(hombro.x - cadera.x), cadera.y - hombro.y) * 180) / Math.PI;
}

const visible = (lm, ...idx) => idx.every((i) => (lm[i]?.visibility ?? 1) >= VISIBILIDAD_MIN);

// Lado del cuerpo que la cámara ve mejor (de costado se ve uno solo).
function mejorLado(lm, partes) {
  const media = (lado) => partes.reduce((s, p) => s + (lm[LADOS[lado][p]]?.visibility ?? 0), 0) / partes.length;
  return media('I') >= media('D') ? 'I' : 'D';
}

/**
 * Crea un contador para un ejercicio.
 *   const e = crearEntrenamiento('sentadilla');
 *   const estado = e.procesar(puntos, { t: ms, relacion: ancho/alto });
 *   estado → { valido, reps, fase, angulo, segundos, correccion }
 * `relacion` corrige la deformación de x cuando el video no es cuadrado.
 */
export function crearEntrenamiento(id) {
  let reps = 0;
  let fase = 'inicio'; // inicio → arriba → bajando → abajo → subiendo → arriba
  let minimo = 180;
  let suave = null;
  let segundos = 0;
  let tAnterior = null;
  const correcciones = new Map();

  const anotar = (texto) => {
    if (texto) correcciones.set(texto, (correcciones.get(texto) ?? 0) + 1);
    return texto;
  };

  function procesar(puntos, { t = 0, relacion = 1 } = {}) {
    const lm = puntos.map((p) => ({ ...p, x: p.x * relacion }));
    const dt = tAnterior === null ? 0 : Math.min(0.5, (t - tAnterior) / 1000);
    tAnterior = t;
    const base = { reps, fase, angulo: suave === null ? null : Math.round(suave), segundos: Math.round(segundos) };

    if (id === 'plancha') return plancha(lm, dt, base);

    const partes = id === 'zancada' ? ['cadera', 'rodilla', 'tobillo'] : id === 'flexion' ? ['hombro', 'codo', 'muneca', 'cadera', 'tobillo'] : ['hombro', 'cadera', 'rodilla', 'tobillo'];
    const lado = mejorLado(lm, partes);
    const L = LADOS[lado];
    const necesarios = id === 'zancada' ? [LADOS.I.rodilla, LADOS.D.rodilla, LADOS.I.cadera, LADOS.D.cadera, LADOS.I.tobillo, LADOS.D.tobillo] : partes.map((p) => L[p]);
    if (!visible(lm, ...necesarios)) {
      return { ...base, valido: false, correccion: 'Turn sideways so your full body is visible.' };
    }

    // Ángulo que manda el ejercicio.
    let ang;
    if (id === 'sentadilla') ang = angulo(lm[L.cadera], lm[L.rodilla], lm[L.tobillo]);
    else if (id === 'flexion') ang = angulo(lm[L.hombro], lm[L.codo], lm[L.muneca]);
    else {
      const i = angulo(lm[LADOS.I.cadera], lm[LADOS.I.rodilla], lm[LADOS.I.tobillo]);
      const d = angulo(lm[LADOS.D.cadera], lm[LADOS.D.rodilla], lm[LADOS.D.tobillo]);
      ang = Math.min(i, d); // la rodilla delantera es la más flexionada
    }
    if (ang === null) return { ...base, valido: false, correccion: null };
    suave = suave === null ? ang : suave * 0.5 + ang * 0.5; // suaviza el ruido de la detección

    const u = UMBRALES[id];
    let correccion = null;

    switch (fase) {
      case 'inicio':
        if (suave >= u.arriba) fase = 'arriba';
        break;
      case 'arriba':
        if (suave < u.arriba - 15) {
          fase = 'bajando';
          minimo = suave;
        }
        break;
      case 'bajando':
        minimo = Math.min(minimo, suave);
        if (suave <= u.abajo) fase = 'abajo';
        else if (suave >= u.arriba - 5) {
          // volvió a subir sin llegar abajo
          fase = 'arriba';
          if (minimo <= u.incompleta) correccion = anotar(id === 'flexion' ? 'Lower your chest more.' : 'Go lower.');
        }
        break;
      case 'abajo':
        minimo = Math.min(minimo, suave);
        if (suave >= u.abajo + 25) fase = 'subiendo';
        break;
      case 'subiendo':
        if (suave >= u.arriba) {
          reps += 1;
          fase = 'arriba';
        } else if (suave <= u.abajo) fase = 'abajo';
        break;
    }

    // Postura mientras se baja.
    if (!correccion && (fase === 'bajando' || fase === 'abajo' || fase === 'subiendo')) {
      if (id === 'sentadilla' && inclinacionTronco(lm[L.hombro], lm[L.cadera]) > 55) correccion = anotar('Chest up and keep your back straight.');
      else if (id === 'zancada' && inclinacionTronco(lm[L.hombro], lm[L.cadera]) > 25) correccion = anotar('Keep your torso upright.');
      else if (id === 'flexion') {
        const linea = angulo(lm[L.hombro], lm[L.cadera], lm[L.tobillo]);
        if (linea !== null && linea < 160) correccion = anotar(correccionCadera(lm, L));
      }
    }

    return { reps, fase, angulo: Math.round(suave), segundos: Math.round(segundos), valido: true, correccion };
  }

  function plancha(lm, dt, base) {
    const lado = mejorLado(lm, ['hombro', 'cadera', 'tobillo']);
    const L = LADOS[lado];
    if (!visible(lm, L.hombro, L.cadera, L.tobillo)) {
      return { ...base, valido: false, correccion: 'Turn sideways so your full body is visible.' };
    }
    const linea = angulo(lm[L.hombro], lm[L.cadera], lm[L.tobillo]);
    const horizontal = inclinacionTronco(lm[L.hombro], lm[L.cadera]) > 60;
    suave = linea;
    if (!horizontal) return { ...base, angulo: Math.round(linea), valido: true, fase: 'fuera', correccion: null };

    if (linea >= 160) {
      segundos += dt;
      return { reps, fase: 'sosteniendo', angulo: Math.round(linea), segundos: Math.round(segundos), valido: true, correccion: null };
    }
    return { reps, fase: 'corregir', angulo: Math.round(linea), segundos: Math.round(segundos), valido: true, correccion: anotar(correccionCadera(lm, L)) };
  }

  return {
    id,
    procesar,
    resetear() {
      reps = 0;
      fase = 'inicio';
      minimo = 180;
      suave = null;
      segundos = 0;
      tAnterior = null;
      correcciones.clear();
    },
    /** Lo que se hizo: para guardar y para que la IA comente la serie (#19). */
    resumen() {
      return {
        ejercicio: id,
        reps,
        segundos: Math.round(segundos),
        correcciones: [...correcciones].map(([texto, veces]) => ({ texto, veces })),
      };
    },
  };
}

// Cadera caída o levantada respecto de la línea hombro–tobillo.
function correccionCadera(lm, L) {
  const h = lm[L.hombro];
  const c = lm[L.cadera];
  const a = lm[L.tobillo];
  const t = a.x === h.x ? 0.5 : (c.x - h.x) / (a.x - h.x);
  const yLinea = h.y + t * (a.y - h.y);
  return c.y > yLinea ? 'Lift your hips, keep your back straight.' : 'Lower your hips, keep your back straight.';
}
