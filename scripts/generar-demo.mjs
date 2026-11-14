import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarDemo } from '../lib/demo/generador.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(raiz, 'lib', 'demo', 'demo-data.json');
const datos = generarDemo(42);
fs.writeFileSync(destino, `${JSON.stringify(datos, null, 2)}\n`, 'utf8');
console.log(`Generado ${destino}: ${datos.astronauts.length} tripulantes, ${datos.readings.length} lecturas, ${datos.symptoms.length} síntomas.`);
