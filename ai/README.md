# ai/ · Fichas y contexto para Claude (issue #13)

Carpeta propia mientras no exista el esqueleto Next.js (#1). Cuando exista, se mueve entera (por ejemplo a `lib/ai/`) y se usa desde las rutas `app/api/**` del servidor. No depende de ningún paquete: solo Node (≥ 20) y JS con módulos ES.

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
| `tokens.js` | Estimación de tokens (2,0 caracteres por token, calibrada con `countTokens`) y el umbral de 100K |
| `vega.js` | Instrucciones fijas de Vega |
| `scripts/generar-indice.js` | Regenera el índice leyendo `doc/02-riesgos/**` y `doc/fuentes/**` |

- **Ids de riesgo:** el nombre del archivo de `doc/02-riesgos/**` (`inmunidad`, `cardiovascular`, `sueno-horarios`…). `listarRiesgos()` devuelve los 17.
- **Fuentes:** `'principales'` (por defecto) = página del HRP + registro del HSRB; `'todas'` suma investigaciones y artículos; `'ninguna'` solo la ficha en español. Si el contexto no entra en el presupuesto, baja de nivel solo y lo avisa en `recortado`. Si ni las fichas solas entran, lanza un error.
- **Tamaño típico (medido con `countTokens`):** un riesgo con fuentes principales ≈ 3–4K tokens; con todas, hasta ≈ 10K. Los 17 riesgos solo en fichas ≈ 11,5K. El corpus completo pasa de 200K: por eso cada consulta manda solo las fichas que toca.
- **Dónde está `doc/`:** por defecto, la carpeta padre de `ai/`. Si se mueve la carpeta, definir `ASTROVITALS_DOC_ROOT` o pasar `raiz`.

## Comandos (desde `ai/`)

```bash
npm test          # 11 pruebas con node:test
npm run indice    # regenera fichas/indice.generado.json tras editar doc/02-riesgos
```

## Pendiente / decisiones para #5

- El conteo de tokens es una estimación. En #5 se puede contrastar con `client.messages.countTokens` y ajustar `CARACTERES_POR_TOKEN`.
- Las zonas de `fichas/mapa.js` son las 12 de `doc/04-sintesis/matriz-peligro-riesgo-indicador.md`; #7 define las 9 del mapa corporal y habrá que alinear los ids.
- Si la demo se publica con la IA apagada (#21), `getContext` no hace falta en ese entorno: solo se leen las respuestas guardadas.
