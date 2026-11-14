# Guion de presentación y demo · "Día 42 en Marte"

> **Aviso obligatorio para la presentación:** AstroVitals es un **prototipo educativo; no es un dispositivo médico**.

## Preparación previa (antes de abrir el navegador)

1. Confirmar que el servidor corre en `http://localhost:3000` (`npm run dev` o `npm start`).
2. Para demo pública o sin internet, verificar `IA_APAGADA=1` en `.env.local`: el servidor responde desde `ai/respaldo-demo.json` sin hacer llamadas externas y sin riesgo de fallos de red frente al jurado.
3. Si se muestra cámara o micrófono en vivo (`/entrenador`, `/cara`, `/vega`), usar Chrome en notebook (1280×800) y habilitar permisos antes de empezar.
4. En `/` (*Inicio*), si hace falta volver al estado limpio del Sol 42, usar **Reiniciar demo** para restaurar los 60 soles iniciales de Ana Ríos y Marcos Silva.

---

## Parte 1 · Pitch rápido / Video de 30 segundos

Ideal para el video de entrega de NASA Space Apps (≤ 30 s) o apertura del pitch:

- **0–6 s (Problema):** *"En Marte la Tierra está a 14 minutos de señal y el sol dura 24 horas con 37 minutos. Si un astronauta se enferma, no puede esperar una respuesta en vivo."*
- **6–14 s (Escenario Sol 42 en `/` y `/mapa`):** *"AstroVitals es una estación médica a bordo. En el Sol 42, Ana durmió cinco horas, tiene estrés alto y le salió un herpes labial: nuestro motor determinista de reglas cruza esas señales con fuentes de la NASA y dispara una alerta naranja de reactivación viral."*
- **14–22 s (Vega + Junta en `/vega` y `/junta`):** *"Vega le responde por voz con citas reales de la NASA, una junta médica de cinco especialistas coordina los informes y el semáforo del motor nunca permite que la IA baje una alerta."*
- **22–30 s (Entrenador + Tierra + Cierre en `/entrenador` y `/enlace`):** *"El entrenador por cámara adapta el ejercicio al estado del día y el enlace con Tierra gestiona el retraso de señal. Prototipo educativo; no es un dispositivo médico."*

---

## Parte 2 · Recorrido guiado en vivo (2–3 minutos)

Secuencia recomendada pantalla por pantalla sobre las **11 rutas** de la app (`/`, `/mapa`, `/jornada`, `/registrar`, `/tendencias`, `/vega`, `/entrenador`, `/cara`, `/junta`, `/enlace`, `/tripulacion`):

### 1. Inicio (`/`) — El cuadro del Sol 42 (20 s)
- **Frase sugerida:** *"Estamos en el Sol 42 de la misión Ares IV en Marte con la comandante Ana Ríos. AstroVitals evalúa sus últimos días con reglas deterministas basadas en el Human Research Program de la NASA y marca nivel naranja: posible reactivación viral."*
- **Qué verificar en pantalla:**
  - Semáforo general con forma + color (`◆ orange`), alerta activa (`Posible reactivación viral`) y chequeo diario.
  - Botón **Sincronizar Watch** (`watch_sim`) para simular la carga nocturna de sueño, FC, SpO₂ y temperatura.

### 2. Mapa corporal (`/mapa`) y Tendencias (`/tendencias`) — Trazabilidad y evolución (20 s)
- **Frase sugerida:** *"En el mapa corporal vemos nueve zonas clicables. Inmunidad está en naranja por el herpes labial y la temperatura en treinta y siete con seis; cerebro y ojos reflejan el poco sueño. Si entramos a Tendencias vemos cómo en los últimos diez soles bajó el sueño y subió el estrés."*
- **Qué verificar en pantalla:**
  - Silueta SVG con marcas por forma y color; al hacer clic en **Inmunidad**, muestra indicadores, síntoma del Sol 41 y enlace a la fuente NASA.
  - En `/tendencias`, bandas de referencia (7–9 h de sueño) y comparación sueño vs. estrés.

### 3. Jornada y notificaciones (`/jornada`) — Reloj marciano y sueño protegido (20 s)
- **Frase sugerida:** *"En Marte el día dura veinticuatro horas y treinta y siete minutos. La jornada ordena chequeos, hidratación y ejercicio con reloj acelerado para la demo, y respeta el descanso protegido nocturno: de diez de la noche a seis y media solo interrumpe una alerta roja."*
- **Qué verificar en pantalla:**
  - Reloj de misión en sol 42, selector de velocidad acelerada, lista de tareas del sol y banner/aviso de notificaciones (con sonido fuera del horario protegido).

### 4. Registrar (`/registrar`) y Hablar con Vega (`/vega`) — Voz y citas NASA (30 s)
- **Frase sugerida:** *"Ana puede completar el chequeo matutino en Registrar —por teclado, ánimo, foto de piel o dictado por voz— o preguntarle directo a Vega."*
- **Acción en `/vega`:** Hacer clic en la sugerencia **`¿Por qué me salió herpes?`** o **`¿Puedo hacer la EVA de mañana?`** (todas cubiertas por `IA_APAGADA=1` desde `ai/respaldo-demo.json`).
- **Qué verificar en pantalla:**
  - Respuesta corta de Vega en español rioplatense, lectura en voz alta sin leer corchetes y tarjetas de citas reales de la NASA (`[F1]`, `[F2]`).
  - Destacar la red de seguridad local: si el tripulante menciona dolor de pecho o autolesión, el navegador avisa al oficial médico sin esperar a la IA.

### 5. Entrenador (`/entrenador`) y "¿Cómo me ves hoy?" (`/cara`) — Cámara local en el navegador (25 s)
- **Frase sugerida:** *"MediaPipe corre en el navegador sin mandar video continuo. En Entrenador cuenta repeticiones de sentadillas y corrige postura al instante; al terminar la serie, la IA puede bajar la carga a veinte minutos de intensidad liviana porque Ana está en naranja, pero nunca puede subirla por encima del techo del motor. En ¿Cómo me ves hoy? medimos parpadeo local y comparamos con la foto base solo si hay consentimiento explícito."*
- **Qué verificar en pantalla:**
  - Esqueleto de pose y contador en `/entrenador` (o resumen de serie con límite `liviana`).
  - En `/cara`, aviso fijo de no diagnóstico, toggle de consentimiento obligatorio y lectura local de fatiga por parpadeo.

### 6. Junta médica (`/junta`) — 5 especialistas en una sola consulta (25 s)
- **Frase sugerida:** *"Convocamos la junta médica del Sol 42. En una única llamada estructurada opinan cinco especialistas —cardiovascular, inmunidad, conducta y sueño, hueso y músculo, y ambiente—, se resuelve el desacuerdo entre infección y falta de sueño, y el nivel final nunca baja del piso del motor."*
- **Qué verificar en pantalla:**
  - Tarjetas de los 5 especialistas con sus citas NASA, bloque de desacuerdo resuelto y las dos pestañas de informe: **Para Ana** (lenguaje claro) y **Para médicos de vuelo** (resumen clínico y recordatorios para los soles 43–45).

### 7. Enlace con Tierra (`/enlace`) y Tripulación / Vista CMO (`/tripulacion`) — Cierre (25 s)
- **Frase sugerida:** *"El informe sale hacia Tierra con catorce minutos de retraso por ida. Al llegar la respuesta del médico de vuelo, Vega la traduce y agenda el seguimiento. Por último, en Tripulación cambiamos a Marcos Silva, el oficial médico: por privacidad, Marcos ve el semáforo y la alerta activa de Ana para poder actuar, pero no sus mediciones numéricas privadas hasta que Ana decida compartirlas."*
- **Qué verificar en pantalla:**
  - En `/enlace`: línea de tiempo con retraso de 14 min, respuesta del médico de vuelo, traducción de Vega y botón para agendar recordatorios en la jornada.
  - En `/tripulacion`: cambio de tripulante activo entre Ana Ríos y Marcos Silva, tarjeta del CMO mostrando semáforo + alerta de Ana con nota de privacidad, y el switch para habilitar/deshabilitar compartir mediciones.

---

## Recordatorio de cierre ante preguntas del jurado

- **¿Y si la IA alucina o baja una alerta?** El motor determinista (`lib/motor/evaluar.js`) decide el semáforo y actúa como piso (`mergeLevel`); además en el entrenador `limitarPlan` corta cualquier exceso sobre el techo del día.
- **¿Qué pasa si falla internet durante la demo o en vuelo?** Con `IA_APAGADA=1` (o sin conexión) todo sigue funcionando con reglas locales, MediaPipe en el navegador, IndexedDB y el respaldo versionado en `ai/respaldo-demo.json`.
- **Alcance:** Prototipo educativo; no es un dispositivo médico.
