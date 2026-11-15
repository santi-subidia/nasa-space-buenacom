// Grafo causal de una alerta: el subconjunto del DAG oficial del Human System Risk Board (HSRB)
// que explica por qué se disparó, con cada nodo encendido según lo que midió el motor de reglas.
// Idea de doc/nasa/riesgos/README.md ("Idea de valor diferencial").
// Fuente: doc/nasa/fuentes/05-human-system-risk-board/dag-immune-risk.md (cada `nasa` es el nombre
// exacto del nodo y cada arista existe en ese DAG; lo verifica test/causas.test.js).
// Sin `@/` ni React para correr con `node --test`.

/** Tipos de nodo: cómo se dibuja y cómo se decide si está encendido. */
export const TIPOS_NODO = {
  peligro: 'Flight hazard (RIDGE)',
  medido: 'Measured by AstroVitals',
  inferido: 'Inferred (not measured onboard)',
  app: 'What AstroVitals does',
  resultado: 'Mission consequence',
};

export const GRAFOS = {
  viral_reactivation: {
    titulo: 'Why a possible viral reactivation?',
    resumen:
      'Stress and poor sleep weaken the immune system without obvious symptoms; latent viruses already carried by the body (like herpes) take advantage and reactivate.',
    dag: {
      nombre: 'NASA HSRB · Immune Risk DAG',
      local: 'doc/nasa/fuentes/05-human-system-risk-board/dag-immune-risk.md',
      url: 'https://www.nasa.gov/wp-content/uploads/2025/09/immune-risk-narrative-dag-20231109.pdf',
    },
    columnas: ['Hazards', 'Measured factor', 'Factors', 'Mechanism', 'Immune state', 'Illness', 'Mission'],
    nodos: [
      { id: 'isolation', nasa: 'Isolation and Confinement', etiqueta: 'Isolation and confinement', tipo: 'peligro', peligro: 'I', col: 0, fila: 0 },
      { id: 'hostile', nasa: 'Hostile Closed Environment', etiqueta: 'Hostile closed environment', tipo: 'peligro', peligro: 'E', col: 0, fila: 1 },
      { id: 'distance', nasa: 'Distance from Earth', etiqueta: 'Distance from Earth', tipo: 'peligro', peligro: 'D', col: 0, fila: 2 },
      { id: 'sleep', nasa: 'Sleep (Risk)', etiqueta: 'Sleep', tipo: 'medido', indicador: 'sleep_h', col: 1, fila: 1.5 },
      { id: 'stress', nasa: 'Stress', etiqueta: 'Stress', tipo: 'medido', indicador: 'stress', col: 2, fila: 0.5 },
      {
        id: 'circadian',
        nasa: 'Circadian Misalignment',
        etiqueta: 'Circadian misalignment',
        tipo: 'inferido',
        nota: 'Due to short sleep and the 24 h 37 min sol',
        col: 2,
        fila: 2.5,
      },
      {
        id: 'subclinical',
        nasa: 'Persistent Subclinical Immune Dysregulation',
        etiqueta: 'Subclinical immune dysregulation',
        tipo: 'inferido',
        nota: 'Only visible in blood (lab test)',
        col: 3,
        fila: 1.5,
      },
      { id: 'clinical', nasa: 'Clinically Significant Immune Dysregulation', etiqueta: 'Immune dysregulation with signs', tipo: 'medido', indicador: 'temp', col: 4, fila: 0.5 },
      { id: 'illness', nasa: 'Medical Illness', etiqueta: 'Viral reactivation', tipo: 'medido', sintomas: ['cold_sore', 'rash'], col: 5, fila: 0.5 },
      { id: 'detect', nasa: 'Detect Immune Changes', etiqueta: 'Detect immune changes', tipo: 'app', col: 4, fila: 2.5 },
      {
        id: 'treatment',
        nasa: 'Medical Treatment Capability',
        etiqueta: 'Onboard treatment capability',
        tipo: 'app',
        nota: 'Medical officer + medical board',
        col: 5,
        fila: 2.5,
      },
      {
        id: 'readiness',
        nasa: 'Individual Readiness',
        etiqueta: 'Mission readiness',
        tipo: 'resultado',
        nota: 'Reviewed before critical tasks (EVA)',
        col: 6,
        fila: 1.5,
      },
    ],
    aristas: [
      ['isolation', 'stress'],
      ['hostile', 'stress'],
      ['hostile', 'circadian'],
      ['distance', 'circadian'],
      ['sleep', 'stress'],
      ['sleep', 'circadian'],
      ['stress', 'subclinical'],
      ['circadian', 'subclinical'],
      ['subclinical', 'clinical'],
      ['subclinical', 'detect'],
      ['clinical', 'detect'],
      ['clinical', 'illness'],
      ['detect', 'treatment'],
      ['illness', 'readiness'],
      ['treatment', 'readiness'],
    ],
  },
};

const NOMBRE_SINTOMA = { cold_sore: 'Cold sore', rash: 'Skin rash' };
const NIVEL_POR_SEVERIDAD = { 1: 'yellow', 2: 'yellow', 3: 'orange' };

function fmt(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1)));
}

/** "8 1–10" → "8/10"; "5,3 h" queda igual. */
function conUnidad(valor, unidad = '') {
  const escala = /^1[–-](\d+)$/.exec(unidad);
  return escala ? `${fmt(valor)}/${escala[1]}` : `${fmt(valor)} ${unidad}`.trim();
}

/** Ids de alertas que tienen grafo causal. */
export function tieneGrafo(alertaId) {
  return Boolean(alertaId && GRAFOS[alertaId]);
}

/** La alerta más grave de la evaluación que tiene grafo, o null. */
export function alertaConGrafo(evaluacion) {
  return (evaluacion?.alerts || []).find((a) => tieneGrafo(a.ruleId)) || null;
}

/**
 * Arma el grafo de una alerta con el estado de cada nodo.
 * @param {string} alertaId  ruleId de una alerta compuesta (ej. 'viral_reactivation').
 * @param {{ evaluacion: object, sintomas?: object[], sol?: number }} datos
 * @returns {null | { titulo, resumen, dag, columnas, alerta, nodos, aristas, camino }}
 *   nodos[i].estado: 'activo' | 'inactivo' | 'contexto' (peligros); nodos[i].nivel: nivel del semáforo o null.
 */
export function armarGrafoCausal(alertaId, { evaluacion, sintomas = [], sol = evaluacion?.sol ?? null } = {}) {
  const def = GRAFOS[alertaId];
  if (!def) return null;
  const alerta = (evaluacion?.alerts || []).find((a) => a.ruleId === alertaId) || null;
  const indicadores = evaluacion?.indicators || {};

  const padres = new Map(def.nodos.map((n) => [n.id, []]));
  for (const [de, a] of def.aristas) padres.get(a).push(de);

  const porId = new Map();
  for (const n of def.nodos) {
    let estado = 'inactivo';
    let nivel = null;
    let valor = n.nota || null;

    if (n.tipo === 'peligro') {
      estado = 'contexto';
    } else if (n.tipo === 'medido' && n.indicador) {
      const ind = indicadores[n.indicador];
      if (ind) {
        nivel = ind.level;
        valor = conUnidad(ind.value, ind.unit);
        estado = ind.level !== 'green' ? 'activo' : 'inactivo';
      } else {
        valor = 'No data';
      }
    } else if (n.tipo === 'medido' && n.sintomas) {
      const recientes = sintomas
        .filter((s) => n.sintomas.includes(s.code) && (sol == null || s.sol == null || (s.sol <= sol && s.sol >= sol - 2)))
        .sort((x, y) => (x.sol ?? 0) - (y.sol ?? 0));
      const s = recientes.at(-1);
      if (s) {
        estado = 'activo';
        nivel = NIVEL_POR_SEVERIDAD[s.severity] || 'yellow';
        valor = `${NOMBRE_SINTOMA[s.code] || s.code}${s.sol != null ? ` · Sol ${s.sol}` : ''}`;
      } else {
        valor = 'No symptoms';
      }
    } else if (n.tipo === 'inferido') {
      const algunPadre = padres.get(n.id).some((p) => porId.get(p)?.estado === 'activo');
      estado = algunPadre ? 'activo' : 'inactivo';
    } else if (n.tipo === 'app' || n.tipo === 'resultado') {
      if (alerta) {
        estado = 'activo';
        nivel = alerta.level;
        if (n.id === 'detect') valor = `AstroVitals: ${alerta.title.toLowerCase()}`;
      }
    }

    porId.set(n.id, { ...n, estado, nivel, valor });
  }

  const nodos = def.nodos.map((n) => porId.get(n.id));
  const aristas = def.aristas.map(([de, a]) => {
    const origen = porId.get(de);
    const destino = porId.get(a);
    const activa = destino.estado === 'activo' && (origen.estado === 'activo' || origen.estado === 'contexto');
    return { de, a, activa };
  });

  // Recorrido en texto (accesible) por los nodos medidos o inferidos que están encendidos.
  const camino = nodos
    .filter((n) => n.estado === 'activo' && (n.tipo === 'medido' || n.tipo === 'inferido'))
    .map((n) => (n.tipo === 'medido' ? `${n.etiqueta} (${n.valor})` : n.etiqueta));

  return { titulo: def.titulo, resumen: def.resumen, dag: def.dag, columnas: def.columnas, alerta, nodos, aristas, camino };
}
