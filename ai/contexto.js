// getContext(riesgos): arma el bloque de contexto que se le pasa a Claude.
//
// Devuelve el texto (fichas en español + fuentes originales de la NASA, con ids citables F1, F2…),
// la lista de citas (título + URL) y el conteo de tokens, y garantiza que no pase del presupuesto.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { estimarTokens, UMBRAL_PRECIO_TOKENS } from './tokens.js';
import { ESPECIALISTAS, ZONAS } from './fichas/mapa.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const INDICE = JSON.parse(readFileSync(join(AQUI, 'fichas', 'indice.generado.json'), 'utf8')).riesgos;

/**
 * Tokens máximos del contexto. Lo que sobra hasta los 100K (UMBRAL_PRECIO_TOKENS) queda
 * para las instrucciones de Vega, los datos del día, el historial y la respuesta.
 */
export const PRESUPUESTO_POR_DEFECTO = 60_000;

/** Qué fuentes originales acompañan a la ficha. */
export const NIVELES_FUENTES = ['todas', 'principales', 'ninguna'];
const TIPOS_PRINCIPALES = new Set(['hrp', 'hsrb', 'protocolo']);

/** Raíz del repo (donde está doc/). Se puede cambiar con ASTROVITALS_DOC_ROOT o con `opciones.raiz`. */
const RAIZ_POR_DEFECTO = process.env.ASTROVITALS_DOC_ROOT
  ? resolve(process.env.ASTROVITALS_DOC_ROOT)
  : resolve(AQUI, '..');

const cacheArchivos = new Map();
function leer(raiz, rutaRelativa) {
  const clave = `${raiz}::${rutaRelativa}`;
  if (!cacheArchivos.has(clave)) {
    const ruta = join(raiz, rutaRelativa);
    if (!existsSync(ruta)) throw new Error(`No existe ${rutaRelativa} (raíz: ${raiz})`);
    cacheArchivos.set(clave, readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n'));
  }
  return cacheArchivos.get(clave);
}

/** Ids de riesgo válidos (nombres de archivo de doc/nasa/riesgos/**). */
export const listarRiesgos = () => Object.keys(INDICE);

export const riesgosDeZona = (zona) => {
  if (!ZONAS[zona]) throw new Error(`Zona desconocida "${zona}". Válidas: ${Object.keys(ZONAS).join(', ')}`);
  return [...ZONAS[zona]];
};

export const riesgosDeEspecialista = (especialista) => {
  if (!ESPECIALISTAS[especialista]) {
    throw new Error(`Especialista desconocido "${especialista}". Válidos: ${Object.keys(ESPECIALISTAS).join(', ')}`);
  }
  return [...ESPECIALISTAS[especialista]];
};

const escapar = (s) => String(s).replace(/"/g, '&quot;');

/** Quita el encabezado repetido (título y línea de fuente) de un archivo de doc/nasa/fuentes. */
function cuerpoDeFuente(texto) {
  return texto
    .replace(/^#\s+.+\n+/, '')
    .replace(/^>\s*Fuente:.*\n+/m, '')
    .trim();
}

/** En la ficha: la línea de enlaces relativos pasa a ser "Fuentes: [F1] [F2]" y los enlaces internos quedan como texto. */
function cuerpoDeFicha(texto, idsFuentes) {
  return texto
    .replace(/^#\s+.+\n+/, '')
    .replace(/^>\s*Fuentes:.*$/m, idsFuentes.length ? `> Fuentes: ${idsFuentes.map((id) => `[${id}]`).join(' ')}` : '')
    .replace(/\[([^\]]+)\]\((?!https?:)[^)]*\)/g, '$1')
    .trim();
}

function construir(ids, nivel, raiz) {
  const citas = [];
  const idDeFuente = new Map(); // archivo -> "F1"
  const bloques = [];
  const partesFichas = [];
  const partesFuentes = [];

  for (const id of ids) {
    const riesgo = INDICE[id];
    const fuentes =
      nivel === 'ninguna'
        ? []
        : riesgo.fuentes.filter((f) => nivel === 'todas' || TIPOS_PRINCIPALES.has(f.tipo));

    const idsFuentes = fuentes.map((f) => {
      if (!idDeFuente.has(f.archivo)) {
        const nuevo = `F${idDeFuente.size + 1}`;
        idDeFuente.set(f.archivo, nuevo);
        citas.push({ id: nuevo, titulo: f.titulo, url: f.url, tipo: f.tipo });
        const texto = `<fuente id="${nuevo}" titulo="${escapar(f.titulo)}" url="${f.url}">\n${cuerpoDeFuente(leer(raiz, f.archivo))}\n</fuente>`;
        partesFuentes.push(texto);
        bloques.push({ id: nuevo, tipo: 'fuente', riesgo: id, archivo: f.archivo, tokens: estimarTokens(texto) });
      }
      return idDeFuente.get(f.archivo);
    });

    const ficha = `<ficha riesgo="${id}" titulo="${escapar(riesgo.titulo)}">\n${cuerpoDeFicha(leer(raiz, riesgo.ficha), idsFuentes)}\n</ficha>`;
    partesFichas.push(ficha);
    bloques.push({ id, tipo: 'ficha', riesgo: id, archivo: riesgo.ficha, tokens: estimarTokens(ficha) });
  }

  const texto =
    '<fichas>\n' + partesFichas.join('\n\n') + '\n</fichas>' +
    (partesFuentes.length ? '\n\n<fuentes>\n' + partesFuentes.join('\n\n') + '\n</fuentes>' : '');

  return { texto, citas, bloques, tokens: estimarTokens(texto) };
}

/**
 * @param {string[]} riesgos  ids de riesgo, p. ej. ['inmunidad', 'sueno-horarios'] (ver listarRiesgos()).
 * @param {object}  [opciones]
 * @param {'todas'|'principales'|'ninguna'} [opciones.fuentes='principales']
 *        'principales' = página del HRP + registro del HSRB + protocolos médicos de la NASA; 'todas' suma investigaciones y artículos.
 * @param {number}  [opciones.presupuesto=60000]  Tokens máximos del contexto. Si se pasa, se bajan las
 *        fuentes de nivel (todas → principales → ninguna); si aun sin fuentes no entra, lanza error.
 * @param {string}  [opciones.raiz]  Carpeta que contiene doc/.
 * @returns {{texto: string, citas: {id,titulo,url,tipo}[], bloques: object[], tokens: number,
 *            riesgos: string[], fuentes: string, recortado: boolean}}
 */
export function getContext(riesgos, opciones = {}) {
  const { fuentes = 'principales', presupuesto = PRESUPUESTO_POR_DEFECTO, raiz = RAIZ_POR_DEFECTO } = opciones;

  if (!Array.isArray(riesgos) || riesgos.length === 0) {
    throw new Error('getContext necesita al menos un riesgo, p. ej. getContext([\'inmunidad\'])');
  }
  if (!NIVELES_FUENTES.includes(fuentes)) {
    throw new Error(`Nivel de fuentes "${fuentes}" inválido. Válidos: ${NIVELES_FUENTES.join(', ')}`);
  }
  if (presupuesto > UMBRAL_PRECIO_TOKENS) {
    throw new Error(`El presupuesto (${presupuesto}) supera el umbral de ${UMBRAL_PRECIO_TOKENS} tokens donde el precio sube 5×`);
  }

  const ids = [...new Set(riesgos)];
  const desconocidos = ids.filter((id) => !INDICE[id]);
  if (desconocidos.length) {
    throw new Error(`Riesgo(s) desconocido(s): ${desconocidos.join(', ')}. Válidos: ${listarRiesgos().join(', ')}`);
  }

  for (let nivel = NIVELES_FUENTES.indexOf(fuentes); nivel < NIVELES_FUENTES.length; nivel++) {
    const resultado = construir(ids, NIVELES_FUENTES[nivel], raiz);
    if (resultado.tokens <= presupuesto) {
      return { ...resultado, riesgos: ids, fuentes: NIVELES_FUENTES[nivel], recortado: NIVELES_FUENTES[nivel] !== fuentes };
    }
  }
  const minimo = construir(ids, 'ninguna', raiz).tokens;
  throw new Error(
    `El contexto de [${ids.join(', ')}] no entra en el presupuesto: solo las fichas ya son ~${minimo} tokens y el máximo es ${presupuesto}. Pedí menos riesgos.`,
  );
}
