// Embeddings vectoriales deterministas de 384 dimensiones para pgvector + búsqueda RAG offline.
// Usa feature hashing con signo (FNV-1a doble) sobre tokens, bigramas y n-gramas de 3 caracteres
// para que términos clínicos con raíces compartidas (p. ej. "inmune"/"inmunidad") se acerquen en el espacio vectorial.

export const DIMENSION_EMBEDDING = 384;

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'en', 'con', 'sin',
  'por', 'para', 'sobre', 'entre', 'hacia', 'desde', 'que', 'como', 'cuando', 'donde', 'pero',
  'mas', 'menos', 'muy', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'su',
  'sus', 'se', 'lo', 'le', 'les', 'y', 'o', 'ni', 'no', 'si', 'es', 'son', 'ser', 'estar',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'risk', 'riesgo', 'due', 'into',
]);

function fnv1a(texto, semilla = FNV_OFFSET) {
  let hash = semilla >>> 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}

/** Normaliza texto eliminando tildes, signos y devolviendo tokens limpios. */
export function normalizarTexto(texto) {
  if (!texto) return [];
  const limpio = String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  if (!limpio) return [];
  return limpio.split(/\s+/).filter((tok) => tok.length >= 2 && !STOPWORDS.has(tok));
}

/** Genera un vector L2-normalizado de 384 dimensiones compatible con `pgvector` (`vector(384)`). */
export function generarEmbedding384(texto) {
  const tokens = normalizarTexto(texto);
  const acum = new Float32Array(DIMENSION_EMBEDDING);

  const acumular = (clave, peso) => {
    const bucket = fnv1a(clave, FNV_OFFSET) % DIMENSION_EMBEDDING;
    const signHash = fnv1a(`s:${clave}`, 0x9e3779b1);
    const signo = (signHash & 1) === 0 ? 1 : -1;
    acum[bucket] += signo * peso;
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    acumular(`w:${tok}`, 2.4);

    if (i + 1 < tokens.length) {
      acumular(`b:${tok}_${tokens[i + 1]}`, 1.4);
    }

    if (tok.length >= 4) {
      for (let j = 0; j <= tok.length - 3; j += 1) {
        acumular(`g:${tok.slice(j, j + 3)}`, 0.65);
      }
      // Raíz temprana (primeras 5 letras) para agrupar familias léxicas médicas
      if (tok.length >= 6) {
        acumular(`r:${tok.slice(0, 5)}`, 1.2);
      }
    }
  }

  let normaSq = 0;
  for (let i = 0; i < DIMENSION_EMBEDDING; i += 1) {
    normaSq += acum[i] * acum[i];
  }

  if (normaSq === 0) {
    acum[0] = 1;
    normaSq = 1;
  }

  const invNorma = 1 / Math.sqrt(normaSq);
  const resultado = new Array(DIMENSION_EMBEDDING);
  for (let i = 0; i < DIMENSION_EMBEDDING; i += 1) {
    resultado[i] = Number((acum[i] * invNorma).toFixed(6));
  }
  return resultado;
}

/** Convierte un embedding en texto `[v1,v2,...]` aceptado por PostgreSQL `vector(384)`. */
export function formatearVectorPg(vector) {
  if (!Array.isArray(vector) || vector.length !== DIMENSION_EMBEDDING) {
    throw new Error(`Se esperaba un vector de ${DIMENSION_EMBEDDING} dimensiones.`);
  }
  return `[${vector.join(',')}]`;
}

/** Similitud coseno local entre dos vectores (fallback sin conexión a Supabase). */
export function similitudCoseno(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i += 1) {
    const a = Number(vecA[i]) || 0;
    const b = Number(vecB[i]) || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}
