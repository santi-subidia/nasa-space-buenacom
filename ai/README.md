# ai/ · Fichas y contexto para Claude (issue #13)

Carpeta propia mientras no exista el esqueleto Next.js (#1). Cuando exista, se mueve entera (por ejemplo a `lib/ai/`) y se usa desde las rutas `app/api/**` del servidor. Solo depende de `@anthropic-ai/sdk` (Node ≥ 20, JS con módulos ES).

## Uso

```js
import { getContext } from './contexto.js';
import { INSTRUCCIONES_VEGA } from './vega.js';

const ctx = getContext(['inmunidad', 'sueno-horarios']);
ctx.texto;   // <fichas>…</fichas><fuentes>…</fuentes>, listo para el prompt
ctx.citas;   // [{ id: 'F1', titulo, url, tipo }] → lo que muestra la pantalla de Vega
ctx.tokens;  // estimación por exceso; nunca pasa del presupuesto (60K por defecto, tope duro 100K)
```

Orden recomendado del prompt para el caché (#5): `INSTRUCCIONES_VEGA` → `ctx.texto` (fijo, con `cache_control`) → datos del día y pregunta (variable).

| Archivo | Qué hace |
|---|---|
| `contexto.js` | `getContext(riesgos, { fuentes, presupuesto, raiz })`, `listarRiesgos()`, `riesgosDeZona(z)`, `riesgosDeEspecialista(e)` |
| `fichas/indice.generado.json` | Índice riesgo → ficha → fuentes (título + URL NASA). **Generado**, no se edita a mano |
| `fichas/mapa.js` | Zonas del cuerpo y especialistas de la junta → riesgos (a mano) |
| `tokens.js` | Estimación de tokens (3,5 caracteres por token) y el umbral de 100K |
| `vega.js` | Instrucciones fijas de Vega |
| `scripts/generar-indice.js` | Regenera el índice leyendo `doc/02-riesgos/**` y `doc/fuentes/**` |

- **Ids de riesgo:** el nombre del archivo de `doc/02-riesgos/**` (`inmunidad`, `cardiovascular`, `sueno-horarios`…). `listarRiesgos()` devuelve los 17.
- **Fuentes:** `'principales'` (por defecto) = página del HRP + registro del HSRB; `'todas'` suma investigaciones y artículos; `'ninguna'` solo la ficha en español. Si el contexto no entra en el presupuesto, baja de nivel solo y lo avisa en `recortado`. Si ni las fichas solas entran, lanza un error.
- **Tamaño típico:** un riesgo con fuentes principales ≈ 2–3K tokens; con todas, hasta ≈ 7K. Los 17 riesgos solo en fichas ≈ 7K.
- **Dónde está `doc/`:** por defecto, la carpeta padre de `ai/`. Si se mueve la carpeta, definir `ASTROVITALS_DOC_ROOT` o pasar `raiz`.

## Servidor con Claude (issue #5)

`POST /api/claude` llama a `claude-haiku-5-5` con `@anthropic-ai/sdk`. El navegador manda solo `tipo` + datos; las instrucciones, las fichas y el esfuerzo los decide el servidor.

```bash
curl -X POST localhost:3000/api/claude -H 'content-type: application/json' \
  -d '{"tipo":"answer","pregunta":"¿Por qué me salió herpes?","riesgos":["inmunidad"]}'
```

| Archivo | Qué hace |
|---|---|
| `claude.js` | `consultarClaude(peticion)`: arma la petición, revisa `stop_reason`, lee el contenido por tipo de bloque, guarda lo bueno y **nunca lanza** por red o IA |
| `almacen.js` | Respuestas guardadas (`AiResult`): en memoria o en `ai/.data/ai-results.json` (ignorado por git) |
| `tareas.js` | Tareas que acepta el servidor (`answer`; el resto llega con #14–#20) y su validación |
| `route.js` | Manejador `POST` con `Request`/`Response`: en Next.js, `export { POST } from '…/ai/route.js'` en `app/api/claude/route.js` |

- **Respuesta guardada de respaldo:** sin clave, sin red, API caída, `refusal`, `max_tokens` o JSON inválido → se devuelve la guardada (la de la misma pregunta si existe, si no la última de ese tipo) con `origen: 'guardada'` y el `motivo`. Si no hay nada guardado, `ok: false`. `IA_APAGADA=1` fuerza este modo (demo pública, #21).
- **Esfuerzo:** `low` para voz (por defecto en `answer`), `medium` para la junta. No se envía `thinking`, `temperature`, `top_p` ni `top_k` (Haiku 5.5 los rechaza o ya razona solo).
- **Caché:** `system` = instrucciones + fichas (último bloque con `cache_control`); lo variable va al final. `uso.cacheLectura > 0` en la segunda consulta confirma que funciona. El prefijo tiene que superar el mínimo cacheable del modelo.
- **Clave:** `ANTHROPIC_API_KEY` en `ai/.env` (copiar `.env.example`; `.env` está en `.gitignore`). Poner un límite de gasto en la Console.

## Comandos (desde `ai/`)

```bash
npm test                   # pruebas con node:test (cliente simulado, sin red)
npm run indice             # regenera fichas/indice.generado.json tras editar doc/02-riesgos
npm run probar             # prueba REAL contra la API con ai/.env (gasta centavos)
npm run probar:sin-clave   # comprueba que sin clave no se rompe nada
```

## Pendiente / decisiones para #5

- El conteo de tokens es una estimación. En #5 se puede contrastar con `client.messages.countTokens` y ajustar `CARACTERES_POR_TOKEN`.
- Las zonas de `fichas/mapa.js` son las 12 de `doc/04-sintesis/matriz-peligro-riesgo-indicador.md`; #7 define las 9 del mapa corporal y habrá que alinear los ids.
- Si la demo se publica con la IA apagada (#21), `getContext` no hace falta en ese entorno: solo se leen las respuestas guardadas.
