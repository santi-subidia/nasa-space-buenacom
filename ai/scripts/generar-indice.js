// Genera ai/fichas/indice.generado.json a partir de doc/nasa/riesgos/**.md.
// Cada ficha enlaza a sus fuentes en la línea "> Fuentes: [..](..) · [..](..)".
// De cada fuente se saca el título (primer "# ") y la URL (línea "> Fuente: <url>").
//
// Uso: npm run indice   (desde ai/)   o   node ai/scripts/generar-indice.js
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');
const DOC = join(RAIZ, 'doc');
const SALIDA = join(AQUI, '..', 'fichas', 'indice.generado.json');

const aPosix = (p) => p.split(sep).join('/');
const rel = (p) => aPosix(relative(RAIZ, p));

function leerFuente(ruta) {
  const texto = readFileSync(ruta, 'utf8');
  const titulo = (texto.match(/^#\s+(.+)$/m)?.[1] ?? '').replace(/\s+-\s+NASA\s*$/, '').trim();
  const url = texto.match(/^>\s*Fuente:\s*(\S+)/m)?.[1] ?? null;
  return { titulo, url };
}

// nasa/fuentes/... -> tipo de fuente según la carpeta
function tipoDeFuente(rutaRelativaADoc) {
  if (rutaRelativaADoc.includes('fuentes/02-riesgos/')) return 'hrp';
  if (rutaRelativaADoc.includes('fuentes/05-human-system-risk-board/')) return 'hsrb';
  if (rutaRelativaADoc.includes('fuentes/03-investigaciones/')) return 'investigacion';
  if (rutaRelativaADoc.includes('fuentes/04-articulos-profundizacion/')) return 'articulo';
  if (rutaRelativaADoc.includes('fuentes/01-peligros/')) return 'peligro';
  if (rutaRelativaADoc.includes('fuentes/06-operaciones-medicas/')) return 'protocolo';
  return 'otra';
}

function listarFichas() {
  const base = join(DOC, 'nasa', 'riesgos');
  const fichas = [];
  for (const grupo of readdirSync(base, { withFileTypes: true })) {
    if (!grupo.isDirectory()) continue;
    for (const archivo of readdirSync(join(base, grupo.name))) {
      if (archivo.endsWith('.md')) fichas.push(join(base, grupo.name, archivo));
    }
  }
  return fichas.sort();
}

const problemas = [];
const riesgos = {};

for (const ruta of listarFichas()) {
  const texto = readFileSync(ruta, 'utf8');
  const id = ruta.split(sep).pop().replace(/\.md$/, '');
  const grupo = ruta.split(sep).slice(-2)[0];
  const titulo = texto.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id;
  const peligros = texto.match(/^>\s*\*\*Peligros?:\*\*\s*(.+)$/m)?.[1]?.trim() ?? '';

  const lineaFuentes = texto.match(/^>\s*Fuentes:\s*(.+)$/m)?.[1] ?? '';
  const fuentes = [];
  for (const [, , destino] of lineaFuentes.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    const absoluta = resolve(dirname(ruta), destino);
    if (!existsSync(absoluta)) {
      problemas.push(`${rel(ruta)}: source ${destino} does not exist`);
      continue;
    }
    const rutaDoc = aPosix(relative(DOC, absoluta));
    const { titulo: t, url } = leerFuente(absoluta);
    if (!url) problemas.push(`${rutaDoc}: missing line "> Fuente: <url>"`);
    fuentes.push({ archivo: `doc/${rutaDoc}`, titulo: t, url, tipo: tipoDeFuente(rutaDoc) });
  }
  if (fuentes.length === 0) problemas.push(`${rel(ruta)}: no sources found`);

  riesgos[id] = { id, grupo, titulo, peligros, ficha: rel(ruta), fuentes };
}

if (problemas.length) {
  console.error('Errors generating the index:\n- ' + problemas.join('\n- '));
  process.exit(1);
}

writeFileSync(SALIDA, JSON.stringify({ generadoDesde: 'doc/nasa/riesgos', riesgos }, null, 2) + '\n');
console.log(`OK: ${Object.keys(riesgos).length} risks -> ${rel(SALIDA)}`);
