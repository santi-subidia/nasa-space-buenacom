# Guion de presentación y demo · "Día 42 en Marte"

> **Aviso obligatorio para la presentación:** VYTA es un **prototipo educativo; no es un dispositivo médico**.

## Preparación previa (antes de abrir el navegador)

1. Confirmar que el servidor corre en `http://localhost:3000` (`npm run dev` o `npm start`).
2. Para demo pública o sin internet, verificar `IA_APAGADA=1` en `.env.local`: el servidor responde desde `ai/respaldo-demo.json` sin hacer llamadas externas y sin riesgo de fallos de red frente al jurado.
3. Si se muestra cámara o micrófono en vivo (`/entrenador`, `/cara`, voz VYTA en `/`), usar Chrome en notebook y habilitar permisos antes de empezar.

---

## Parte 1 · Pitch rápido / Video de 30 segundos

Ideal para el video de entrega de NASA Space Apps (≤ 30 s) o apertura del pitch:

- **0–6 s (Problema):** *"En Marte la Tierra está a 14 minutos de señal y el sol dura 24 horas con 37 minutos. Si un astronauta se enferma, no puede esperar una respuesta en vivo."*
- **6–14 s (Escenario Sol 42 en `/` y `/salud/fisica`):** *"VYTA es una estación médica a bordo. En el Sol 42, Ana durmió cinco horas, tiene estrés alto y le salió un herpes labial: nuestro motor determinista de reglas cruza esas señales con fuentes de la NASA y dispara una alerta naranja de reactivación viral."*
- **14–22 s (Voz VYTA en `/`):** *"Ana le habla a VYTA por voz y recibe respuestas con citas reales de la NASA; el semáforo del motor nunca permite que la IA baje una alerta."*
- **22–30 s (Actividad + Tierra + Cierre en `/actividad` y `/enlace`):** *"El entrenador por cámara adapta el ejercicio al estado del día y el enlace con Tierra gestiona el retraso de señal. Prototipo educativo; no es un dispositivo médico."*

---

## Parte 2 · Recorrido guiado en vivo (2–3 minutos)

Secuencia recomendada siguiendo el menú lateral: `/`, `/salud/fisica`, `/actividad`, `/registrar`, `/tendencias` y `/enlace`.

### 1. Vista General (`/`) — El cuadro del Sol 42 (20 s)
- **Frase sugerida:** *"Estamos en el Sol 42 de la misión Ares IV en Marte con la comandante Ana Ríos. VYTA evalúa sus últimos días con reglas deterministas basadas en el Human Research Program de la NASA y marca nivel naranja: posible reactivación viral."*
- **Qué verificar en pantalla:**
  - Estado general con forma + color (`◆ orange`), alerta activa (`Posible reactivación viral`) con su fuente NASA y chequeo diario.
  - Botón de voz VYTA: tocar y preguntar *"¿Por qué me salió herpes?"* o *"¿Puedo hacer la EVA de mañana?"* (cubiertas por `IA_APAGADA=1` desde `ai/respaldo-demo.json`). Destacar la red de seguridad local: si el tripulante menciona dolor de pecho o autolesión, se avisa sin esperar a la IA.

### 2. Salud (`/salud/fisica`, `/salud/mental`, `/salud/riesgos`) — Mapa corporal (20 s)
- **Frase sugerida:** *"El mapa corporal reparte nueve zonas entre Física, Mental y Riesgos. Inmunidad está en naranja por el herpes labial y la temperatura en treinta y siete con seis; cerebro y ojos reflejan el poco sueño."*
- **Qué verificar en pantalla:**
  - Silueta con marcas por forma y color; al elegir **Inmunidad** se ven indicadores, qué hacer y el enlace a la fuente NASA.
  - En Riesgos, radiación acumulada, pérdida ósea/muscular, fatiga e inmunidad priorizadas.

### 3. Actividad (`/actividad`) y Jornada (`/jornada`) — Ejercicio y reloj marciano (30 s)
- **Frase sugerida:** *"MediaPipe corre en el navegador sin mandar video continuo. El entrenador cuenta repeticiones de sentadillas y corrige postura; la IA puede bajar la carga a veinte minutos de intensidad liviana porque Ana está en naranja, pero nunca subirla por encima del techo del motor. La jornada ordena el sol de veinticuatro horas treinta y siete y respeta el descanso protegido: de diez de la noche a seis y media solo interrumpe una alerta roja."*
- **Qué verificar en pantalla:**
  - Esqueleto de pose y contador en `/entrenador` (o resumen de serie con límite `liviana`) y ejercicios cognitivos en `/actividad/cognitivos`.
  - En `/jornada`, reloj de misión en sol 42, velocidad acelerada, tareas del sol y notificaciones desde la campana de la cabecera.

### 4. Registrar (`/registrar`) y "¿Cómo me ves hoy?" (`/cara`) — Chequeo del día (25 s)
- **Frase sugerida:** *"Ana completa el chequeo matutino —mediciones, ánimo, foto de piel y tests de reacción y visión— y puede sumar el chequeo facial: medimos parpadeo local y comparamos con la foto base solo si hay consentimiento explícito."*
- **Qué verificar en pantalla:**
  - Formulario de Registrar con validación y guardado local.
  - En `/cara`, aviso fijo de no diagnóstico, consentimiento obligatorio y lectura local de fatiga por parpadeo.

### 5. Analítica (`/tendencias`) — Evolución (15 s)
- **Frase sugerida:** *"En los últimos diez soles bajó el sueño y subió el estrés: lo vemos contra las bandas de referencia y la línea base personal de Ana."*
- **Qué verificar en pantalla:** bandas de referencia (7–9 h de sueño), línea coloreada por zona y cursor sincronizado entre gráficos.

### 6. Informes · Enlace con Tierra (`/enlace`) — Cierre (20 s)
- **Frase sugerida:** *"El informe sale hacia Tierra con catorce minutos de retraso por ida; la respuesta del médico de vuelo vuelve a Base Marte y Vega la traduce a lenguaje simple y agenda el seguimiento."*
- **Qué verificar en pantalla:** línea de tiempo con retraso de 14 min, bandeja de respuesta de Houston, traducción de Vega y recordatorios en la jornada.

---

## Recordatorio de cierre ante preguntas del jurado

- **¿Y si la IA alucina o baja una alerta?** El motor determinista (`lib/motor/evaluar.js`) decide el semáforo y actúa como piso (`mergeLevel`); además en el entrenador `limitarPlan` corta cualquier exceso sobre el techo del día.
- **¿Qué pasa si falla internet durante la demo o en vuelo?** Con `IA_APAGADA=1` (o sin conexión) todo sigue funcionando con reglas locales, MediaPipe en el navegador, IndexedDB y el respaldo versionado en `ai/respaldo-demo.json`.
- **Alcance:** Prototipo educativo; no es un dispositivo médico.
