// Grafo causal de una alerta: el subconjunto del DAG oficial del Human System Risk Board (HSRB)
// que explica por qué se disparó, con cada nodo encendido según lo que midió el motor de reglas.
// Idea de doc/nasa/riesgos/README.md ("Idea de valor diferencial").
// Fuente: doc/nasa/fuentes/05-human-system-risk-board/dag-immune-risk.md (cada `nasa` es el nombre
// exacto del nodo y cada arista existe en ese DAG; lo verifica test/causas.test.js).
// Sin `@/` ni React para correr con `node --test`.

/** Tipos de nodo: cómo se dibuja y cómo se decide si está encendido. */
export const TIPOS_NODO = {
  peligro: 'Peligro del vuelo (RIDGE)',
  medido: 'Medido por AstroVitals',
  inferido: 'Inferido (no se mide a bordo)',
  app: 'Lo que hace AstroVitals',
  resultado: 'Consecuencia para la misión',
};

export const GRAFOS = {
  viral_reactivation: {
    titulo: '¿Por qué una posible reactivación viral?',
    resumen:
      'El estrés y el mal sueño debilitan el sistema inmune sin dar síntomas; los virus que el cuerpo ya tenía dormidos (como el herpes) aprovechan y se reactivan.',
    dag: {
      nombre: 'NASA HSRB · Immune Risk DAG',
      local: 'doc/nasa/fuentes/05-human-system-risk-board/dag-immune-risk.md',
      url: 'https://www.nasa.gov/wp-content/uploads/2025/09/immune-risk-narrative-dag-20231109.pdf',
    },
    columnas: ['Peligros', 'Factor medido', 'Factores', 'Mecanismo', 'Estado inmune', 'Enfermedad', 'Misión'],
    nodos: [
      { id: 'isolation', nasa: 'Isolation and Confinement', etiqueta: 'Aislamiento y confinamiento', tipo: 'peligro', peligro: 'I', col: 0, fila: 0 },
      { id: 'hostile', nasa: 'Hostile Closed Environment', etiqueta: 'Entorno hostil y cerrado', tipo: 'peligro', peligro: 'E', col: 0, fila: 1 },
      { id: 'distance', nasa: 'Distance from Earth', etiqueta: 'Distancia de la Tierra', tipo: 'peligro', peligro: 'D', col: 0, fila: 2 },
      { id: 'sleep', nasa: 'Sleep (Risk)', etiqueta: 'Sueño', tipo: 'medido', indicador: 'sleep_h', col: 1, fila: 1.5 },
      { id: 'stress', nasa: 'Stress', etiqueta: 'Estrés', tipo: 'medido', indicador: 'stress', col: 2, fila: 0.5 },
      {
        id: 'circadian',
        nasa: 'Circadian Misalignment',
        etiqueta: 'Desajuste circadiano',
        tipo: 'inferido',
        nota: 'Por el sueño corto y el sol de 24 h 37 min',
        col: 2,
        fila: 2.5,
      },
      {
        id: 'subclinical',
        nasa: 'Persistent Subclinical Immune Dysregulation',
        etiqueta: 'Defensas alteradas sin síntomas',
        tipo: 'inferido',
        nota: 'Solo se ve en sangre (laboratorio)',
        col: 3,
        fila: 1.5,
      },
      { id: 'clinical', nasa: 'Clinically Significant Immune Dysregulation', etiqueta: 'Defensas alteradas con signos', tipo: 'medido', indicador: 'temp', col: 4, fila: 0.5 },
      { id: 'illness', nasa: 'Medical Illness', etiqueta: 'Reactivación viral', tipo: 'medido', sintomas: ['cold_sore', 'rash'], col: 5, fila: 0.5 },
      { id: 'detect', nasa: 'Detect Immune Changes', etiqueta: 'Detectar cambios inmunes', tipo: 'app', col: 4, fila: 2.5 },
      {
        id: 'treatment',
        nasa: 'Medical Treatment Capability',
        etiqueta: 'Capacidad de tratar a bordo',
        tipo: 'app',
        nota: 'Oficial médico + junta médica',
        col: 5,
        fila: 2.5,
      },
      {
        id: 'readiness',
        nasa: 'Individual Readiness',
        etiqueta: 'Aptitud para la misión',
        tipo: 'resultado',
        nota: 'Se revisa antes de tareas críticas (EVA)',
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

const NOMBRE_SINTOMA = { cold_sore: 'Herpes labial', rash: 'Erupción en la piel' };
const NIVEL_POR_SEVERIDAD = { 1: 'yellow', 2: 'yellow', 3: 'orange' };

function fmt(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1))).replace('.', ',');
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
        valor = 'Sin dato';
      }
    } else if (n.tipo === 'medido' && n.sintomas) {
      const recientes = sintomas
        .filter((s) => n.sintomas.includes(s.code) && (sol == null || s.sol == null || (s.sol <= sol && s.sol >= sol - 2)))
        .sort((x, y) => (x.sol ?? 0) - (y.sol ?? 0));
      const s = recientes.at(-1);
      if (s) {
        estado = 'activo';
        nivel = NIVEL_POR_SEVERIDAD[s.severity] || 'yellow';
        valor = `${NOMBRE_SINTOMA[s.code] || s.code}${s.sol != null ? ` · sol ${s.sol}` : ''}`;
      } else {
        valor = 'Sin síntomas';
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
