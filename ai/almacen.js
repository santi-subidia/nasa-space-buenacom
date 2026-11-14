// Respuestas guardadas (AiResult). Si no hay red, falla la API o la IA responde con "refusal",
// la app devuelve la última respuesta buena de ese tipo en vez de romper la pantalla.
//
// AiResult { id, kind: 'board'|'answer'|'exercise'|'face', input, output, ts }  (plan final §8)
// Se agrega `clave`: hash de la entrada, para preferir la respuesta guardada de la MISMA pregunta
// y, si no hay, la última de ese tipo.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KINDS = ['board', 'answer', 'exercise', 'face'];
const MAX_POR_KIND = 30;

/** JSON con las claves ordenadas, para que el mismo objeto dé siempre el mismo hash. */
function estable(valor) {
  if (Array.isArray(valor)) return `[${valor.map(estable).join(',')}]`;
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor).sort().map((k) => `${JSON.stringify(k)}:${estable(valor[k])}`).join(',')}}`;
  }
  return JSON.stringify(valor ?? null);
}

export const claveDeEntrada = (entrada) => createHash('sha256').update(estable(entrada)).digest('hex').slice(0, 16);

function validarKind(kind) {
  if (!KINDS.includes(kind)) throw new Error(`kind "${kind}" inválido. Válidos: ${KINDS.join(', ')}`);
}

/** Lógica común sobre un arreglo de AiResult; `persistir` se llama tras cada cambio. */
function crearAlmacen(inicial, persistir) {
  let items = inicial;
  return {
    guardar({ kind, input, output, clave }) {
      validarKind(kind);
      const resultado = {
        id: randomUUID(),
        kind,
        clave: clave ?? claveDeEntrada(input),
        input,
        output,
        ts: new Date().toISOString(),
      };
      items.push(resultado);
      // Solo las últimas MAX_POR_KIND de cada tipo, para que el archivo no crezca sin límite.
      const delKind = items.filter((r) => r.kind === kind);
      if (delKind.length > MAX_POR_KIND) {
        const sobran = new Set(delKind.slice(0, delKind.length - MAX_POR_KIND).map((r) => r.id));
        items = items.filter((r) => !sobran.has(r.id));
      }
      // Si no se puede escribir (disco de solo lectura en un despliegue), la respuesta igual se devuelve.
      try {
        persistir?.(items);
      } catch {
        /* se queda solo en memoria */
      }
      return resultado;
    },
    /** La respuesta de la misma entrada si existe; si no, la última de ese tipo; si no, null. */
    buscar(kind, clave) {
      validarKind(kind);
      const delKind = items.filter((r) => r.kind === kind);
      return (clave && [...delKind].reverse().find((r) => r.clave === clave)) || delKind.at(-1) || null;
    },
    listar: (kind) => (kind ? items.filter((r) => r.kind === kind) : [...items]),
  };
}

export function crearAlmacenEnMemoria(inicial = []) {
  return crearAlmacen([...inicial], null);
}

/** Carpeta `.data/` junto a este módulo; está en .gitignore. Se cambia con AI_RESULTS_FILE. */
export const RUTA_POR_DEFECTO = process.env.AI_RESULTS_FILE
  ? resolve(process.env.AI_RESULTS_FILE)
  : join(dirname(fileURLToPath(import.meta.url)), '.data', 'ai-results.json');

export function crearAlmacenEnArchivo(ruta = RUTA_POR_DEFECTO) {
  let inicial = [];
  if (existsSync(ruta)) {
    try {
      const leido = JSON.parse(readFileSync(ruta, 'utf8'));
      if (Array.isArray(leido)) inicial = leido;
    } catch {
      // Archivo dañado: se empieza de cero antes que romper la app.
    }
  }
  return crearAlmacen(inicial, (items) => {
    mkdirSync(dirname(ruta), { recursive: true });
    const temporal = `${ruta}.${process.pid}.tmp`;
    writeFileSync(temporal, JSON.stringify(items, null, 2));
    renameSync(temporal, ruta);
  });
}
