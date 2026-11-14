# Plan final · AstroVitals (versión solo notebook)

> **Entrega:** domingo 15 de noviembre de 2026, 21:00 · **No se toca más código a las 17:00**
> Reemplaza las decisiones de hardware de [dispositivos-y-sensores.md](dispositivos-y-sensores.md) y recorta el alcance de [plan-proyecto.md](plan-proyecto.md). El modelo de datos y el motor de reglas siguen siendo los de [prototipo.md](prototipo.md).
> **Prototipos visuales:** lienzo "AstroVitals · Prototipos" (https://claude.ai/artifact/6ETWbRDaJn2mkSQnpUjraF). Es privado: hay que compartirlo desde su menú *Share* para que el equipo lo abra.

## 1. La app en una frase

Una **estación médica de la tripulación** que corre en la notebook: le dice al astronauta qué medir y cuándo, convierte las mediciones en un **semáforo por zona del cuerpo** y tiene a **Vega**, un compañero de voz que explica (con citas de la NASA), guía los ejercicios con la cámara y arma informes para el oficial médico y para Tierra.

## 2. Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Dispositivos | **Solo la notebook** (pantalla, teclado, webcam, micrófono) | Sin sincronización, HTTPS de teléfono ni Web Push. Demo más segura. En la ISS la tripulación también usa notebooks fijas |
| Apple Watch | **Simulado**: botón "Sincronizar Watch" que carga los datos de la noche desde los datos de demo | Mantiene la historia sin depender del hardware |
| Pantallas | Los prototipos de 1280×800 se usan tal cual | Ya son tamaño notebook |
| Usuarios | **Selector de tripulante** al entrar (Ana, Marcos…) + vista del oficial médico | Natural en una estación compartida |
| IA | **Claude Haiku 5.5** (`claude-haiku-5-5`, API de Anthropic) **para todo** | Rápido y muy barato: el hackathon entero cuesta centavos de dólar |
| Voz | **Web Speech API** del navegador (reconocimiento y lectura en voz alta) | Gratis y no gasta tokens. Ojo: el reconocimiento de Chrome necesita internet |
| Cámara | **MediaPipe** en el navegador mide; Claude interpreta pocas veces | Tiempo real, gratis y sin latencia de red |
| Equipo | **3 personas** | Ver el reparto en la sección 9 |
| Semáforo | Lo decide el **motor de reglas** (determinista). La IA puede subir el nivel, **nunca bajarlo** | Respuesta a "¿y si la IA se equivoca?" |

## 3. La jornada del astronauta (hora de misión)

En Marte el sol dura 24 h 37 min, así que la app usa **hora de misión**, no hora de la Tierra. Para la demo hay un **reloj acelerado** (1 min real = 1 h de misión) para que el jurado vea la jornada completa y salten las notificaciones.

| Hora | Tarea | Entrada | Notificación |
|---|---|---|---|
| 06:30 | Despertar: llegan sueño, FC en reposo, HRV, SpO₂ y temperatura de muñeca | Botón "Sincronizar Watch" (simulado) | "Tu noche llegó: 5 h 20. Hoy tu chequeo tiene 4 pasos" |
| 06:45 | **Chequeo matutino de 90 s**: presión, temperatura, ánimo, tiempo de reacción de 30 s | Teclado, emojis o voz | Sí |
| 07:00 | **"¿Cómo me ves hoy?"**: foto de cara | Webcam | Dentro del chequeo |
| 07:30 | Desayuno y primer registro de agua | 1 clic | — |
| 08:00–12:00 | Trabajo (ciencia, mantenimiento) | — | Agua cada 2 h |
| 12:30 | Almuerzo. Viernes: aceptabilidad de la comida (1–9) | 1 clic | Solo viernes |
| 13:30–15:00 | **Ejercicio de 90 min** con el entrenador por cámara | Webcam | 10 min antes |
| 15:00 | Después del ejercicio: FC de recuperación, dolor articular | 1 clic | — |
| 16:40 | **Ventana con Tierra**: sale el informe del día | Automático | "Informe enviado. Respuesta en ~28 min" |
| 18:00 | Tiempo libre / llamada con la familia | — | — |
| 20:30 | Diario de ánimo por voz (1 min, opcional) | Voz | Suave |
| 21:30 | Modo noche: luz cálida, menos pantallas | — | "En 30 min, a dormir" |
| 22:00–06:30 | **Sueño protegido de 8 h** | — | Silencio, salvo alerta roja |

**Semanales:** glucosa (lunes), test visual para SANS (miércoles), masa corporal (viernes), encuesta de equipo (domingo).

**Por evento:** checklist antes de una EVA ("¿apto?"), tests de equilibrio tras un cambio de gravedad, temperatura cada 8 h si hay fiebre, recordatorios creados por la junta médica (por ejemplo, hisopado del sol 44).

## 4. Notificaciones

| Tipo | Ejemplo | Aspecto |
|---|---|---|
| Rutina | "Toca el chequeo matutino" | Azul, círculo |
| Alerta | "Avisar al oficial médico" | Naranja, rombo (con sonido) |
| Tierra | "Llegó la respuesta de la médica de vuelo" | Violeta |
| Motivación | "Racha de 12 días de ejercicio" | Verde |

**Cómo se hacen:** la propia página programa los avisos con un temporizador sobre el reloj de misión y los muestra de dos formas:
1. **Notification API** del navegador (aviso del sistema operativo), sin servidor de push. Funciona mientras el navegador está abierto.
2. **Avisos dentro de la app** con sonido. Este es el respaldo, y funciona siempre.

Durante el sueño protegido solo suena una alerta roja.

## 5. IA con Claude Haiku 5.5

**Modelo:** `claude-haiku-5-5` para todas las funciones, llamado desde el servidor de la notebook con el SDK oficial `@anthropic-ai/sdk` (TypeScript).

### Costo

- **US$ 0,10 por millón de tokens de entrada y US$ 0,50 por millón de salida**, para prompts de hasta 100K tokens. **Por encima de 100K el precio sube 5 veces** (US$ 0,50 / US$ 2,50).
- Ejemplo: una junta médica con ~15K tokens de entrada y ~2K de salida cuesta **≈ US$ 0,0025**. Cientos de consultas en todo el hackathon no llegan a US$ 1.
- El razonamiento interno (*thinking*) también se cobra como salida, pero en Haiku sigue siendo muy poco.

### Reglas de diseño

1. **Cada prompt por debajo de 100K tokens.** El corpus entero (~125K tokens) pasaría el umbral, así que cada pregunta manda solo las fichas del riesgo que toca (`doc/nasa/riesgos/` + sus fuentes en `doc/nasa/fuentes/`), unos pocos miles de tokens.
2. **Prompt caching.** Primero lo fijo (instrucciones de Vega + fichas), con `cache_control`; al final lo variable (datos del día, pregunta). Comprobar en `usage.cache_read_input_tokens` que el caché se está usando: si el prefijo es muy corto, no se cachea.
3. **Esfuerzo según la tarea** (`output_config.effort`): `"low"` para Vega por voz, porque la latencia importa más que la profundidad; `"medium"` (el valor por defecto de Haiku 5.5) para la junta médica. No tocar el parámetro `thinking`.
4. **Junta médica en una sola consulta** con salida estructurada (`output_config.format` con un esquema JSON): las 5 opiniones (cardiovascular, inmunidad, conducta y sueño, hueso y músculo, ambiente), los desacuerdos, la síntesis del coordinador y los dos informes. En pantalla se ve igual que 6 agentes, y es más rápido que 6 llamadas.
5. **Chequeo por voz con una herramienta** `registrar_medicion` (`strict: true`) que devuelve `{indicador, valor, unidad}` para llenar el formulario.
6. **Imágenes:** la foto de cara y las fotos clave de cada serie de ejercicio se mandan como bloques de imagen.
7. **IA solo donde aporta.** Semáforo, conteo de repeticiones, voz y notificaciones funcionan sin Claude.
8. **Respuestas guardadas de respaldo.** Cada respuesta buena se guarda. Si no hay internet, la API falla o la respuesta termina con `stop_reason: "refusal"` (Haiku 5.5 no tiene respaldo automático del servidor), la app muestra la última guardada. Siempre revisar `stop_reason` antes de leer el contenido. **La demo no puede depender de la red.**
9. **La API key nunca va en el código de la página ni en el repo.** Va en la variable de entorno `ANTHROPIC_API_KEY` del servidor, con `.env` en `.gitignore`. Poner un **límite de gasto** en la Console de Anthropic. Si se publica una demo en URL pública, ahí la IA va apagada y solo hay respuestas guardadas.
10. **Privacidad:** igual que antes, solo datos ficticios y fotos de quien dé su consentimiento.

### Qué hace la IA

| Función | Entrada | Salida |
|---|---|---|
| **Vega: preguntas** | Pregunta por voz + fichas del riesgo | Respuesta corta para leer en voz alta, con citas |
| **Vega: chequeo por voz** | "Anotá 37 con 6" | JSON `{indicador, valor}` que llena el formulario |
| **Junta médica** | Últimos 7 días + alertas del motor de reglas | JSON con 5 opiniones + desacuerdos + síntesis + informe simple + informe técnico |
| **Traducción de Tierra** | Mensaje del médico de vuelo | Explicación simple + recordatorios |
| **Comentario de ejercicio** | Métricas de la serie + 2–3 fotos | Comentario y ajuste del plan |
| **"¿Cómo me ves hoy?"** | Foto de hoy + foto base | Observaciones + una acción concreta |

## 6. Cámara + agente

### a) Entrenador de ejercicios

- **MediaPipe Pose** cuenta repeticiones (sentadilla, flexión, zancada), mide el tiempo de plancha y los ángulos (rodilla, cadera).
- **Correcciones en vivo con reglas simples** ("bajá más", "espalda recta") que Vega dice en voz alta. No usan la IA, así que no tienen latencia.
- **Al terminar cada serie**, Claude recibe los números y 2–3 fotos clave y ajusta el plan con el contexto de salud. Ejemplo: "Tenés febrícula, hoy 20 min liviano", lo mismo que decidió la junta.
- Alimenta la racha, la meta de la tripulación y las zonas de hueso y músculo del mapa corporal.

### b) "¿Cómo me ves hoy?"

- **MediaPipe Face** mide parpadeo y tiempo con ojos cerrados (fatiga) y compara la cara con la **foto base** (hinchazón por fluidos que suben a la cabeza).
- **Claude** compara la foto de hoy con la base y describe observaciones (ojeras, palidez, hinchazón, lesión en el labio) y termina en una acción ("medite la temperatura").
- En pantalla y en el pitch: **es una observación, no un diagnóstico**.
- Alimenta las zonas de cerebro (fatiga), ojos (fluidos) e inmunidad (piel).

**Descartado por ahora:** mandar video en tiempo real a la IA. Se mandan fotos sueltas (al terminar la serie o una por mañana): es más barato, más rápido y más fácil de que salga bien en la demo.

## 7. Pantallas (ver prototipos)

1. **Inicio:** semáforo general, alerta activa, chequeo del día, indicadores, barra de Vega.
2. **Mapa corporal:** 9 zonas clicables con función, riesgos, indicadores, qué hacer y fuente.
3. **Registrar:** formulario del chequeo, ánimo, foto de piel, ficha ⓘ, "completar por voz".
4. **Vega:** conversación por voz con citas y formulario que se llena solo.
5. **Junta médica:** 5 especialistas, desacuerdo resuelto, informe para el astronauta y para Tierra.
6. **Enlace con Tierra:** recorrido del informe con retraso, bandeja, explicación de Vega.
7. **Tendencias:** sueño, sueño vs. estrés, temperatura, ánimo, con bandas y línea base.
8. **Entrenador** *(nueva, falta prototipo)*: webcam con esqueleto, contador, correcciones.
9. **Jornada** *(nueva, falta prototipo)*: línea de tiempo del sol con el reloj de misión y las tareas.

## 8. Cambios al modelo de datos

Sobre [prototipo.md](prototipo.md):

- `Reading.source`: `'manual' | 'voice' | 'watch_sim' | 'camera'`.
- `Astronaut`: agregar `baselinePhotoId` para la foto base.
- Nuevo `Task { id, astronautId, kind, title, missionTime, recurrence: 'daily'|'weekly'|'event', done }` para la jornada y las notificaciones.
- Nuevo `AiResult { id, kind: 'board'|'answer'|'exercise'|'face', input, output, ts }` para guardar respuestas y usarlas de respaldo.

## 9. Reparto (3 personas)

| Persona | Primero (hasta las 13:00 del domingo) | Después (13:00–17:00) |
|---|---|---|
| **1 · Interfaz** | Inicio, registro, mapa corporal, tendencias (desde los prototipos) | Pantalla del entrenador: webcam + MediaPipe Pose, contador y correcciones |
| **2 · Lógica y servidor** | Motor de reglas, datos de demo (60 soles, evento del sol 41), jornada con reloj acelerado, notificaciones, selector de tripulante, servidor con el SDK de Anthropic | Enlace con Tierra, guion del pitch y README |
| **3 · IA** | Vega (voz + Claude + fichas), chequeo por voz, respuestas guardadas | Junta médica en una consulta, comentario del entrenador y, si sobra tiempo, "¿Cómo me ves hoy?" |

**De 17:00 a 19:00 los tres juntos:** video de la demo, capturas y repaso del pitch.

Con 3 personas, lo primero que se corta si hay atraso es "¿Cómo me ves hoy?" y después el comentario de la IA en el entrenador (el contador funciona solo).

## 10. Orden de construcción y recortes

1. Motor de reglas + datos de demo + Inicio y mapa corporal.
2. Registro + jornada con reloj acelerado + notificaciones.
3. Vega (preguntas y chequeo por voz) + respuestas guardadas.
4. Junta médica + Enlace con Tierra.
5. Entrenador por cámara.
6. "¿Cómo me ves hoy?".

Si algo se atrasa, **se corta desde el final**. A las **13:00** del domingo el punto 1–3 tiene que funcionar de punta a punta.

| Hora (domingo) | Hito |
|---|---|
| 13:00 | Núcleo + Vega funcionando |
| 17:00 | No se toca más código |
| 17:00–19:00 | Video, capturas, README |
| 19:00–20:00 | Carga en Space Apps |
| 20:00–21:00 | Margen |

## 11. Límites para decir en el pitch

- Prototipo educativo, **no es un dispositivo médico**. Los umbrales son orientativos y configurables.
- Los datos del Watch están **simulados**; la arquitectura admite sensores reales.
- La IA **orienta y redacta**; el semáforo lo decide el motor de reglas.
- En una nave real, el modelo correría a bordo. En la demo usamos Claude Haiku 5.5 por internet y el reconocimiento de voz de Chrome también necesita conexión.
