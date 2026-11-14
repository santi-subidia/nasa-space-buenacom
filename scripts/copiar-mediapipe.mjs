// Copia el WASM de MediaPipe a public/mediapipe/wasm para que el entrenador lo cargue
// desde el propio servidor (sin depender de un CDN). Corre solo después de `npm install`.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origen = path.join(raiz, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destino = path.join(raiz, 'public', 'mediapipe', 'wasm');

const ERR_ORIGINAL = 'var err = console.error.bind(console);';
const ERR_FILTRADO =
  'var err = function(...args) { var msg = typeof args[0] === "string" ? args[0].trim() : ""; if (/^(?:INFO:|WARNING:\\s*All log messages before absl|I0000\\b|W0000\\b|gl_context)/i.test(msg) || msg.includes("Created TensorFlow Lite XNNPACK delegate")) { console.debug?.(...args); return; } console.error(...args); };';

if (!existsSync(origen)) {
  console.log('[mediapipe] node_modules/@mediapipe/tasks-vision no está instalado; se omite.');
} else {
  mkdirSync(destino, { recursive: true });
  cpSync(origen, destino, { recursive: true });

  let parcheados = 0;
  for (const archivo of ['vision_wasm_internal.js', 'vision_wasm_nosimd_internal.js']) {
    const ruta = path.join(destino, archivo);
    if (!existsSync(ruta)) continue;
    const contenido = readFileSync(ruta, 'utf8');
    if (contenido.includes(ERR_ORIGINAL)) {
      writeFileSync(ruta, contenido.replace(ERR_ORIGINAL, ERR_FILTRADO), 'utf8');
      parcheados += 1;
    }
  }
  console.log(`[mediapipe] WASM copiado a public/mediapipe/wasm (${parcheados} loaders parcheados)`);
}
