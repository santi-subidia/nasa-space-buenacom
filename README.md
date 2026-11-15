# AstroVitals

**Estación médica de tripulación para misiones espaciales de larga duración (NASA Space Apps).**

> **Aviso obligatorio:** Prototipo educativo; no es un dispositivo médico. Los umbrales, observaciones e informes orientan a partir de documentación pública de la NASA y no diagnostican ni reemplazan a un profesional de la salud.

AstroVitals acompaña al astronauta en el día a día de una misión en Marte (sol de 24 h 37 min): organiza sus mediciones y tareas, traduce los registros en un **semáforo determinista por zona corporal**, ofrece a **Vega** (asistente por voz con citas verificables de la NASA), guía el entrenamiento y la fatiga facial con la cámara de la notebook, convoca una **junta médica multi-especialista** y simula el enlace con Tierra con retraso de señal.

---

## Stack implementado

- **Framework y UI:** Next.js 16 (App Router), React 19, JavaScript ESM, Sass Modules (`@use 'tokens' as *;`), Recharts.
- **Almacenamiento local y nube:** IndexedDB mediante **Dexie** (`lib/db.js`) offline-first sincronizado con **Supabase PostgreSQL + Auth + `pgvector`** (`supabase/migrations/` y `lib/supabase/`).
- **Visión por computadora en el navegador:** **MediaPipe** (`@mediapipe/tasks-vision`) — *Pose Landmarker* en `/entrenador` y *Face Landmarker* (parpadeo / PERCLOS) en `/cara`.
- **Voz en el navegador:** **Web Speech API** (`SpeechRecognition` en `es-AR` y `speechSynthesis`) en la voz VYTA de `/` y Salud.
- **IA en el servidor:** **Claude Haiku 5.5** (`claude-haiku-5-5`) con `@anthropic-ai/sdk`, *prompt caching*, salidas estructuradas (`output_config.format`) y *tool use* (`strict: true`), expuesto vía `POST /api/claude`.
- **Pensado para notebook (1280×800)**, con semáforo accesible mediante forma + color (`● green`, `▲ yellow`, `◆ orange`, `■ red`).

---

## Instalación y ejecución

Requiere **Node.js ≥ 20**.

```bash
npm install
npm run dev
```

Abrir <http://localhost:3000>. Al ejecutar `npm install`, el script `postinstall` copia el WASM de MediaPipe a `public/mediapipe/`.

### Variables de entorno (`.env.example`)

Copiar `.env.example` a `.env.local` (archivo ignorado por Git):

| Variable | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de Anthropic para `claude-haiku-5-5` (solo usada en el servidor `app/api/**`). |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (PostgreSQL, Auth y `pgvector`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública `anon` de Supabase para el cliente navegador/servidor. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada para sembrar base de datos, usuarios demo y vectores (`scripts/sembrar-supabase.mjs`). |
| `IA_APAGADA` | Con `IA_APAGADA=1`, desactiva llamadas externas a la API y responde con el respaldo guardado (ideal para demo pública). |
| `NEXT_PUBLIC_POSE_MODEL_URL` | Opcional. URL o ruta local (ej. `/mediapipe/pose_landmarker_lite.task`) para el modelo de pose sin conexión al CDN de Google. |

### Comandos principales

```bash
npm run dev              # Servidor de desarrollo en http://localhost:3000
npm test                 # Pruebas de lógica clínica, demo, reloj, enlace, entrenador y entrega
npm --prefix ai test     # Pruebas unitarias de Vega, junta médica, chequeo por voz y cliente Claude
npm run build            # Compilación de producción (Next.js)
npm start                # Servidor de producción
```

*(En Windows PowerShell usá `npm.cmd` si la política de ejecución restringe `npm.ps1`.)*

---

## Modo demo pública (`IA_APAGADA=1`)

Para demostraciones públicas, evaluaciones sin conexión o entornos sin clave de API, AstroVitals incluye un **modo demo pública**:

- Con `IA_APAGADA=1` (o cuando falta `ANTHROPIC_API_KEY`, falla la red, la API devuelve error o `stop_reason` es `refusal` / `max_tokens`), `consultarClaude()` **nunca llama a la API externa** ni lanza excepciones que rompan la pantalla.
- En su lugar, `ai/almacen.js` precarga automáticamente el respaldo versionado en **`ai/respaldo-demo.json`** (junto con cualquier respuesta local más reciente en `ai/.data/ai-results.json`, sin duplicar por `id`).
- `ai/respaldo-demo.json` contiene respuestas reales pre-generadas para el escenario **"Día 42 en Marte"** de Ana Ríos:
  - Las **4 preguntas sugeridas de Vega** (`¿Puedo hacer la EVA de mañana?`, `Explicame mi sueño`, `¿Por qué me salió herpes?`, `¿Cómo sé si estoy deshidratado?`) más `¿Por qué me salió herpes labial?`, con citas `[F1]` / `[F2]` enlazadas a documentos reales de la NASA.
  - La **junta médica completa del Sol 42** (5 especialistas, desacuerdos, síntesis e informes para el astronauta y para médicos de vuelo).
  - Un ajuste de serie de **sentadillas en Sol 42** con nivel `orange` (20 min, intensidad `liviana`).

---

## Pantallas de VYTA

El menú lateral se define en [`lib/rutas.js`](lib/rutas.js):

| Ruta | Pantalla | Qué hace |
|---|---|---|
| `/` | **Vista General** | Estado general, alertas activas con su fuente NASA, chequeo del día y voz VYTA (conversación con citas y red de seguridad local ante urgencias). |
| `/salud/fisica` | **Salud** | Mapa corporal con las 9 zonas repartidas en Física, Mental (`/salud/mental`) y Riesgos (`/salud/riesgos`). `?zona=` abre la zona pedida; `/mapa` redirige acá. |
| `/actividad` | **Actividad** | Ejercicios físicos (`/entrenador`: webcam con esqueleto MediaPipe Pose, repeticiones, correcciones y plan adaptado por IA), cognitivos (`/actividad/cognitivos`) y la **Jornada** (`/jornada`: reloj marciano de 24 h 37 min y descanso protegido 22:00–06:30). |
| `/registrar` | **Registrar** | Chequeo matutino, ánimo, foto de piel, tests de reacción y visión, y **¿Cómo me ves hoy?** (`/cara`: parpadeo/PERCLOS local con MediaPipe Face). |
| `/tendencias` | **Analítica** | Sueño, estrés, temperatura y ánimo con bandas de referencia y línea base personal. |
| `/enlace` | **Informes** | Enlace con Tierra con retraso de 14 min por tramo, respuesta del médico de vuelo y traducción de Vega. |

---

## Arquitectura clínica y seguridad

1. **Motor determinista de reglas (`lib/motor/evaluar.js` y `lib/motor/rules.json`):** evalúa cada lectura contra umbrales, variación sobre la línea base personal (`baselineDelta`) y reglas compuestas (como `viral_reactivation` en el Sol 42: sueño promedio < 6 h + estrés ≥ 7 + síntoma cutáneo/herpes labial).
2. **La IA orienta, nunca baja la alerta (`mergeLevel`):** en `lib/motor/evaluar.js` y `ai/junta/niveles.js`, el nivel del motor actúa como piso obligatorio (`mergeLevel(motor, junta)`). En `/entrenador`, `ai/entrenador/plan.js` (`limitarPlan`) impone techos por nivel (`orange` → máximo 30 min e intensidad `liviana`; `red` → `reposo`).
3. **Red de seguridad local en voz (`ai/vega/urgencia.js`):** detecta señales críticas (autolesión, dolor de pecho, falta de aire, hinchazón unilateral de cuello/brazo) en el navegador sin esperar a la IA ni depender de la red.
4. **Privacidad de la cámara:** en `/cara`, ninguna imagen sale del navegador sin consentimiento explícito.

---

## Recursos de la NASA utilizados

Toda la lógica educativa y las citas de Vega y la Junta Médica provienen de documentación pública oficial descargada y sintetizada en `doc/`:

- **Human Research Program (HRP) — 5 Peligros y 17 Riesgos:** [`doc/nasa/riesgos/`](doc/nasa/riesgos/) y [`doc/nasa/fuentes/02-riesgos/`](doc/nasa/fuentes/02-riesgos/) (inmunidad, sueño y ritmos circadianos, cardiovascular, hueso, capacidad física, nutrición, EVA, SANS, conducta y equipo, radiación).
- **Human System Risk Board (HSRB):** fichas técnicas, *Risk Records* y grafos causales (DAGs) en [`doc/nasa/fuentes/05-human-system-risk-board/`](doc/nasa/fuentes/05-human-system-risk-board/).
- **Investigaciones y Standard Measures:** [`doc/nasa/fuentes/03-investigaciones/`](doc/nasa/fuentes/03-investigaciones/) (Standard Measures, Artemis II Standard Measures, Immune Biomarkers, ARCHeR, CIPHER, Food Physiology) y artículos de contexto en [`doc/nasa/fuentes/04-articulos-profundizacion/`](doc/nasa/fuentes/04-articulos-profundizacion/).
- El índice completo de enlaces y documentos vive en [`doc/nasa/fuentes/INDICE.md`](doc/nasa/fuentes/INDICE.md).

---

## Límites del prototipo

- **Prototipo educativo; no es un dispositivo médico.** Los umbrales son orientativos y configurables.
- Los datos del reloj (*Watch*) están **simulados** mediante el botón *"Sincronizar Watch"* (`watch_sim`), aunque la arquitectura admite sensores reales.
- La IA **orienta y redacta**; la clasificación clínica determinista la decide siempre el motor de reglas.
- En una misión real, los modelos de voz e IA correrían localmente a bordo; en este prototipo se usa Claude Haiku 5.5 por API (o `ai/respaldo-demo.json` con `IA_APAGADA=1`) y el reconocimiento de voz nativo de Chrome requiere conexión.

---

## Estructura del repositorio

| Carpeta | Qué contiene |
|---|---|
| `app/` | Rutas Next.js (pantallas VYTA + `app/api/`) y `layout.js` |
| `components/` | Componentes de interfaz, módulos Sass barra lateral (`Sidebar`) y contenedor común `layout/PantallaVyta` |
| `ai/` | Cliente Claude Haiku 5.5 (`claude.js`, `almacen.js`, `respaldo-demo.json`), contexto NASA y módulos de Vega, chequeo, junta, entrenador y cara (ver [`ai/README.md`](ai/README.md)) |
| `lib/` | Motor de reglas (`motor/`), datos en Dexie (`db.js`, `datos/`), semilla de 60 soles (`demo/`), rutas, tipos y lógica pura |
| `doc/` | `nasa/` (documentación oficial: desafío, fuentes originales y resúmenes de riesgos) y `proyecto/` (síntesis, plan final, decisiones y guion de demo) |
| `test/` | Pruebas unitarias en `node:test` para motor, demo, reloj, enlace, entrenador, tripulación y entrega |
