// Copia el WASM de MediaPipe a public/mediapipe/wasm para que el entrenador lo cargue
// desde el propio servidor (sin depender de un CDN). Corre solo después de `npm install`.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origen = path.join(raiz, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destino = path.join(raiz, 'public', 'mediapipe', 'wasm');

if (!existsSync(origen)) {
  console.log('[mediapipe] node_modules/@mediapipe/tasks-vision no está instalado; se omite.');
} else {
  mkdirSync(destino, { recursive: true });
  cpSync(origen, destino, { recursive: true });
  console.log('[mediapipe] WASM copiado a public/mediapipe/wasm');
}
