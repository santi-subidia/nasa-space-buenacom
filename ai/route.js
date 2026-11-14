// POST /api/claude — manejador con la API estándar Request/Response.
//
// En Next.js (cuando exista #1) alcanza con un archivo `app/api/claude/route.js`:
//     export { POST } from '<ruta a>/ai/route.js';
//
// Siempre responde 200 con { ok, origen: 'claude'|'guardada'|'ninguna', ... } cuando la petición es
// válida: que falle la red o la IA no debe romper la pantalla. Solo hay 4xx por peticiones mal formadas.
import { consultarClaude } from './claude.js';
import { construirTarea, ErrorDePeticion } from './tareas.js';

const MAX_BYTES = 8 * 1024 * 1024; // fotos en base64 (#19, #20)

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export function crearManejador({ consultar = consultarClaude, construir = construirTarea } = {}) {
  return async function POST(request) {
    const largo = Number(request.headers.get('content-length') ?? 0);
    if (largo > MAX_BYTES) return json({ ok: false, error: 'La petición es demasiado grande' }, 413);

    let cuerpo;
    try {
      cuerpo = await request.json();
    } catch {
      return json({ ok: false, error: 'El cuerpo no es JSON válido' }, 400);
    }

    let peticion;
    try {
      peticion = construir(cuerpo);
    } catch (error) {
      if (error instanceof ErrorDePeticion) return json({ ok: false, error: error.message }, 400);
      throw error;
    }

    const { citas = [], ...paraClaude } = peticion;
    const resultado = await consultar(paraClaude);
    return json({ ...resultado, citas });
  };
}

export const POST = crearManejador();
