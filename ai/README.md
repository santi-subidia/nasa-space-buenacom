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
| `tokens.js` | Estimación de tokens (2,0 caracteres por token, calibrada con `countTokens`) y el umbral de 100K |
| `vega.js` | Instrucciones fijas de Vega |
| `scripts/generar-indice.js` | Regenera el índice leyendo `doc/02-riesgos/**` y `doc/fuentes/**` |

- **Ids de riesgo:** el nombre del archivo de `doc/02-riesgos/**` (`inmunidad`, `cardiovascular`, `sueno-horarios`…). `listarRiesgos()` devuelve los 17.
- **Fuentes:** `'principales'` (por defecto) = página del HRP + registro del HSRB; `'todas'` suma investigaciones y artículos; `'ninguna'` solo la ficha en español. Si el contexto no entra en el presupuesto, baja de nivel solo y lo avisa en `recortado`. Si ni las fichas solas entran, lanza un error.
- **Tamaño típico (medido con `countTokens`):** un riesgo con fuentes principales ≈ 3–4K tokens; con todas, hasta ≈ 10K. Los 17 riesgos solo en fichas ≈ 11,5K. El corpus completo pasa de 200K: por eso cada consulta manda solo las fichas que toca.
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

## Vega: compañero de voz (issue #14)

La lógica de la pantalla Vega vive en `ai/vega/`, sin depender de React; la pantalla (botón del micrófono, ondas, conversación y citas) la arma P1 sobre este contrato cuando exista #1.

```js
import { crearVoz } from '…/ai/vega/voz.js';
import { crearSesionVega, SUGERENCIAS } from '…/ai/vega/sesion.js';

const vega = crearSesionVega({
  voz: crearVoz({ alCambiar: (fase) => …, alOirParcial: (t) => vega.ponerParcial(t) }),
  obtenerDatosDelDia: () => ({ sol: 42, sueno_horas: 5.3 }),
  alAvisarOficial: (aviso) => notificaciones.enviar(aviso),   // lo conecta #12
});
// React: useSyncExternalStore(vega.suscribir, vega.obtener)
```

`vega.obtener()` → `{ fase: 'inactivo'|'escuchando'|'pensando'|'hablando', mensajes: [{ rol, texto, citas: [{ id, titulo, url }], origen, urgente }], parcial, error, sugerirAviso }`. Acciones: `preguntarPorVoz()` (botón del micrófono), `preguntar(texto)` (sugerencias y texto escrito), `avisarOficial()`, `cancelar()`.

| Archivo | Qué hace |
|---|---|
| `vega/voz.js` | Web Speech API: `SpeechRecognition` (es-AR) y `speechSynthesis` con la mejor voz en español; errores de micrófono con mensajes claros |
| `vega/sesion.js` | Orquesta micrófono → `/api/claude` → lectura en voz; descarta respuestas viejas; mensaje local si no hay conexión |
| `vega/riesgos.js` | Elige las fichas por la pregunta (máx. 3 riesgos, miles de tokens, no el corpus) |
| `vega/urgencia.js` | Detecta señales rojas y autolesión **en el navegador, sin IA**: avisa al oficial al instante |
| `vega/texto.js` | Citas `[F1]` usadas, y texto limpio para leer en voz alta |

- **Citas:** el servidor responde `citasUsadas` (solo las que Claude citó, normalmente 1–2, con título y URL de la NASA) y `textoVoz` (sin marcas). Si Claude está caído, la respuesta guardada trae lo mismo.
- **Seguridad:** `autolesion` (crítica) no espera a la IA: mensaje local + aviso al oficial. Las señales `alta` (dolor de pecho, falta de aire, cuello o brazo hinchados…) avisan y además consultan a Claude. Claude también recibe en `INSTRUCCIONES_VEGA` la regla de escalar.
- **Web Speech:** el reconocimiento de Chrome necesita internet; sin soporte (Firefox) `preguntar(texto)` sigue funcionando.
- **Aviso al oficial:** `alAvisarOficial({ nivel, categoria, motivo, origen: 'vega', ts })` es el contrato con las notificaciones (#12).

## Chequeo por voz (issue #15)

Vega llena el chequeo matutino de a un paso: pregunta, escucha, anota y sigue. Vive en `ai/chequeo/`.

```js
import { crearChequeoPorVoz } from '…/ai/chequeo/sesion.js';
const chequeo = crearChequeoPorVoz({
  voz,                                   // el mismo crearVoz() de Vega
  astronautId: 'ana',
  alRegistrar: (reading) => db.readings.add(reading),   // Reading con source: 'voice' (lo conecta #2/#8)
});
await chequeo.iniciar();                 // "Completar por voz" en Registrar
await chequeo.anotar('Anotá 37 con 6 de temperatura');  // frase suelta
// React: useSyncExternalStore(chequeo.suscribir, chequeo.obtener) → { fase, pasoActual, hechos, omitidos, mensajes, error }
```

| Archivo | Qué hace |
|---|---|
| `chequeo/indicadores.js` | Indicadores dictables (unidad y rango plausible), la herramienta `registrar_medicion` (`strict: true`) y `validarMedicion` |
| `chequeo/local.js` | Intérprete sin red de frases con dígitos ("37 con 6", "118 sobre 76", "5 horas y media") |
| `chequeo/sesion.js` | Los pasos (`PASOS_MATUTINOS`, configurables), reintentos, "después" para omitir y `anotar()` |

- **Primero local, después Claude:** si la frase trae dígitos se resuelve en el navegador (gratis, sin latencia, sin red); si viene en palabras ("treinta y siete con seis") va a `POST /api/claude` con `tipo: 'check'`, esfuerzo `low` y la herramienta `registrar_medicion` → `{ mediciones, rechazadas }`.
- **Nunca se guarda un valor absurdo:** cada medición se valida contra un rango plausible (temperatura 33–42,5 °C, ánimo 1–5…); si no pasa, Vega pide repetir. Solo se aceptan los indicadores que el paso esperaba.
- **Sin respaldo guardado:** `check` usa `sinRespaldo` — con la red caída nunca devuelve la medición de otra frase (registraría un valor ajeno). Sin red, igual funcionan las frases con dígitos.
- **Pasos por defecto:** presión (alta y baja, preguntando la que falte), temperatura, ánimo (1–5) y estrés (1–10). El sueño llega del Watch simulado y el test de reacción lo hace la pantalla.

## Junta médica IA (issue #16)

Una sola consulta (`tipo: 'board'`, esfuerzo `medium`) con salida estructurada: 5 especialistas (cardiovascular, inmunidad, conducta y sueño, hueso y músculo, ambiente) con nivel, opinión y fuentes; desacuerdos resueltos; síntesis del coordinador; informe simple para el astronauta e informe técnico para los médicos de vuelo (con recordatorios por sol). En pantalla se ve como 6 agentes, pero es una llamada.

```js
const r = await fetch('/api/claude', { method: 'POST', body: JSON.stringify({
  tipo: 'board',
  astronauta: { id: 'ana', nombre: 'Ana' }, sol: 42, nivelMotor: 'orange',
  alertas,    // Alert[] del motor de reglas (#3)
  lecturas,   // Reading[] de los últimos 7 días (#2/#4)
  sintomas,   // Symptom[]
}) }).then((res) => res.json());
const vista = armarVistaJunta(r, 'Ana');   // ai/junta/vista.js → lo que dibuja la pantalla
```

| Archivo | Qué hace |
|---|---|
| `junta/tarea.js` | Arma el prompt (lecturas por indicador, alertas, síntomas + fichas de los riesgos involucrados) y cruza el resultado con el motor |
| `junta/esquema.js` | Esquema JSON de la salida y `revisarSalida` (los 5 especialistas, sin repetidos, nivel válido) |
| `junta/niveles.js` | `mergeLevel(motor, junta)`: **el nivel final nunca baja del que dio el motor** |
| `junta/vista.js` | `armarVistaJunta()`: especialistas con semáforo, desacuerdos, síntesis y pestañas "Para Ana" / "Para médicos de vuelo" |
| `junta/ejemplo-sol42.js` | Datos de ejemplo del sol 42 (herpes + 37,6 °C + poco sueño) para pruebas y demo |

- **El motor manda:** la respuesta trae `nivelMotor`, `nivelJunta`, `nivelFinal = mergeLevel(...)`, `subioPorMotor` y `accionFinal` (si el nivel final es naranja, la acción mínima es avisar al oficial médico; si es rojo, contactar a los médicos de vuelo). Una junta guardada se vuelve a cruzar con el motor de hoy.
- **Tamaño:** ≈ 29K tokens de entrada medidos con la API (fichas de ≤ 8 riesgos con sus fuentes principales, cacheables) y ≈ 4,5K de salida: ≈ US$ 0,006 por junta y ~25 s. Presupuesto de contexto de 45K; el total nunca llega a 100K.
- **Resultado guardado:** cada junta válida se guarda como `AiResult` (`kind: 'board'`); una salida incompleta no se guarda ni se muestra (cae en la última guardada).
- **Probarla de verdad:** `npm run probar:junta` (necesita `ai/.env`).

## Comentario del entrenador (issue #19)

Al terminar una serie (#18) se manda `tipo: 'exercise'` con las métricas de MediaPipe, 2–3 fotos clave y el estado de salud de hoy. Vega lo comenta en voz alta y ajusta el plan ("tenés febrícula, hoy 20 min livianos"). Vive en `ai/entrenador/`.

```js
import { crearComentarioDeSerie } from '…/ai/entrenador/serie.js';
const entrenador = crearComentarioDeSerie({ voz });          // el mismo crearVoz() de Vega
const { comentario, correccion, plan, origen } = await entrenador.comentar({
  ejercicio: 'sentadilla',
  metricas: { repeticiones: 12, anguloRodillaMin: 88, correccionesEnVivo: 2 },
  fotos: [{ media_type: 'image/jpeg', data: base64 }, …],   // 2–3 fotos clave, sin el prefijo data:
  estado: { nivelMotor: 'orange', resumen: 'Febrícula de 37,6 °C; sueño 5,3 h' },
});   // plan → { minutos, intensidad, motivo, limitadoPorMotor }
```

- **La IA solo baja la carga:** `entrenador/plan.js` aplica el techo del nivel del motor (verde: plan completo · amarillo: moderada, ≤ 60 min · naranja: liviana, ≤ 30 min · rojo: reposo). Aunque Claude proponga más, el servidor lo corta y marca `limitadoPorMotor`.
- **Sin IA igual comenta:** si no hay red o la respuesta guardada es de otra serie, se usa un comentario local con las métricas de ESTA serie y el mismo techo (`origen: 'local'`).
- **Fotos:** solo jpeg/png/webp en base64, máximo 3 y ~1,8 MB cada una (`validarImagenes`). Van como bloques de imagen y no entran en la clave de lo guardado. Claude describe la técnica, no el cuerpo ni quién es.
