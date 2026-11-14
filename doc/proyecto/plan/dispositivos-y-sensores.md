# Dispositivos disponibles y qué podemos medir con ellos

> **Objetivo:** adaptar la solución al hardware que **ya tenemos** y usarlo para destacar. Las ideas parten del [catálogo de indicadores](../sintesis/catalogo-indicadores.md) y del [prototipo](prototipo.md).
>
> ⚠️ **Varias capacidades dependen del modelo exacto, de la versión del sistema y del país.** Completa el inventario (sección 1) y revisa las columnas marcadas con *depende del modelo*.

## 1. Inventario (completar)

| Dispositivo | Modelo | Sistema | Cantidad | Notas |
|---|---|---|---|---|
| iPhone | ¿? (¿Pro con LiDAR?) | iOS ¿? | ¿? | |
| Android | ¿? | Android ¿? / Chrome ¿? | ¿? | |
| Apple Watch | ¿? (Series / Ultra / SE) | watchOS ¿? | ¿? | Emparejado con el iPhone ¿? |
| AirPods | ¿? (Pro 2 / Pro 3 / 3.ª–4.ª gen / Max) | — | ¿? | |
| Notebook | ¿? | Windows / macOS ¿? | ¿? | Webcam ¿720p / 1080p? |
| **Mac** | ¿? | macOS ¿? (Xcode ¿?) | 1 | ✅ **Confirmado:** hay Mac en el equipo |

**Hay una Mac en el equipo**, así que tenemos Xcode y podemos compilar una **app nativa de iOS**, y opcionalmente de watchOS. Eso habilita el camino B de la sección 4: datos en vivo del Watch y seguimiento de cabeza de los AirPods.

## 2. Sensores por dispositivo

### ⌚ Apple Watch: la fuente de datos fisiológicos continuos

| Sensor / función | Qué da | Indicador del catálogo | Depende del modelo |
|---|---|---|---|
| Sensor óptico de pulso (PPG) | FC continua, **FC en reposo**, FC al caminar | FC en reposo | Todos |
| Variabilidad de la FC (HRV, SDNN) | Marcador de estrés y recuperación | Estrés / fatiga | Todos |
| ECG de 1 derivación | Electrocardiograma de 30 s, aviso de fibrilación auricular | Tier 3: ECG | Series 4+ (no SE) |
| Notificaciones de ritmo irregular | Aviso pasivo de FA | CV | Todos los recientes |
| Oxígeno en sangre | SpO₂ puntual y nocturno | SpO₂ (hipoxia) | Series 6+ / Ultra; **disponibilidad según país y modelo** |
| Temperatura de la muñeca | **Variación nocturna** respecto a la base (no es la temperatura corporal absoluta) | Temperatura (tendencia), inmunidad | Series 8+ / Ultra |
| Sueño | Duración, fases (REM, profundo, ligero) | Horas de sueño | watchOS 9+ |
| Frecuencia respiratoria nocturna | resp/min durante el sueño | Hipoxia, enfermedad | watchOS 8+ |
| App Signos Vitales | Resumen nocturno de FC, frecuencia respiratoria, temperatura, SpO₂ y HRV con aviso si salen de rango | Panel matutino | watchOS 11+, Series 6+ |
| Notificaciones de hipertensión | Aviso de posible hipertensión tras unos 30 días. **No da valores de presión arterial.** | PA (solo aviso) | Series 9+ / Ultra 2+, watchOS 26 |
| VO₂ máx. estimado | Capacidad cardiorrespiratoria | [Capacidad física](../../nasa/riesgos/fisiologia/capacidad-fisica.md) | Todos |
| Entrenamientos | Minutos y tipo de ejercicio, calorías | Ejercicio | Todos |
| Acelerómetro + giroscopio | Movimiento, detección de caídas, actigrafía | Sueño, actividad | Todos |
| Micrófono (app Ruido) | **Nivel de ruido ambiental en dB** | Ruido de cabina (**real, no simulado**) | Series 4+ |
| Estado de ánimo (app Mindfulness) | Registro de emociones y ánimo | Ánimo | watchOS 10+ |

### 🎧 AirPods

| Función | Qué da | Uso en la app | Depende del modelo |
|---|---|---|---|
| **Seguimiento de la cabeza** (*head motion*) | Orientación, rotación y aceleración de la cabeza en tiempo real | **Test vestibular / equilibrio**, postura | Pro, Max, 3.ª gen o posteriores. **Requiere app nativa** (ver la sección 4) |
| Prueba de audición | Audiograma guardado en Salud | Riesgo HSRB de [acústica y pérdida auditiva](../../nasa/fuentes/05-human-system-risk-board/risk-of-hearing-loss-and-performance-decrements-due-to-acoustics-issues-in-space.md) | Pro 2 o posteriores, iOS 18.1+ |
| Exposición al audio de auriculares | dB acumulados | Acústica | Todos con iPhone |
| Sensor de FC | FC durante entrenamientos | FC (segunda fuente) | **Solo AirPods Pro 3** |
| Audio | Instrucciones por voz y relajación guiada | Accesibilidad, conducta | Todos |

### 📱 iPhone

| Sensor | Qué podemos hacer |
|---|---|
| Cámara trasera + flash | **FC con el dedo sobre la cámara** (PPG). En la web el flash de iOS no se puede encender → se hace con app nativa, o con luz ambiente y menos precisión |
| Cámara frontal TrueDepth (Face ID) | Seguimiento facial 3D: parpadeo, expresión y fatiga (ARKit, nativo) |
| LiDAR (solo Pro) | Medición 3D, por ejemplo hinchazón o volumen de una zona (experimental) |
| Acelerómetro + giroscopio | **Test de equilibrio** (teléfono contra el pecho), temblor, conteo de ejercicios. En la web hay que pedir permiso (`DeviceMotionEvent.requestPermission`) |
| Barómetro | Presión ambiente → **simular una despresurización de cabina** |
| Micrófono | Diario de voz y ruido |
| App Salud | Concentra todo lo del Watch y los AirPods + estabilidad al caminar, simetría de la marcha, Estado de ánimo |

### 🤖 Android

| Sensor / API | Qué podemos hacer | Ventaja frente a iOS en la web |
|---|---|---|
| Cámara + **linterna desde la web** | **FC con el dedo directamente en la PWA** (Chrome permite encender el flash) | ✅ iOS no lo permite en la web |
| **Web Bluetooth** | Conectar medidores BLE estándar: tensiómetro (perfil 0x1810), glucómetro (0x1808), termómetro (0x1809), oxímetro (0x1822), banda de FC (0x180D) | ✅ No existe en iOS Safari |
| Acelerómetro, giroscopio, magnetómetro (Generic Sensor API) | Equilibrio, temblor, conteo de ejercicios | ✅ Sin pedir permiso explícito |
| Vibración | Avisos hápticos y metrónomo de respiración | ✅ |
| Health Connect | Datos de salud de otras apps | Requiere app nativa |

### 💻 Notebook con cámara: la "estación de la tripulación"

| Técnica (en el navegador, sin conexión) | Qué da | Indicador | Confiabilidad |
|---|---|---|---|
| **rPPG**: cambio de color de la piel del rostro en el video | FC **sin contacto** | FC | Media (necesita buena luz y quedarse quieto) |
| Movimiento del pecho en el video | Frecuencia respiratoria | Hipoxia, estrés | Media-baja |
| **MediaPipe Face Landmarker** (malla facial + *blendshapes*) | Frecuencia de parpadeo, **PERCLOS** (tiempo con los ojos cerrados), bostezos, expresión | Fatiga y sueño, ánimo | Media |
| Hinchazón facial (comparada con la base) | Desplazamiento de fluidos hacia la cabeza (*puffy face*) | Fluidos, SANS | Baja (demo) |
| **MediaPipe Pose Landmarker** | Conteo de sentadillas y flexiones, forma del ejercicio, oscilación del cuerpo de pie | Ejercicio, equilibrio | Media-alta |
| Pantalla | **Test de agudeza visual** + rejilla de Amsler | [SANS](../../nasa/riesgos/fisiologia/sans-ojos.md) | Media (con distancia calibrada) |
| Teclado / ratón | **PVT** (tiempo de reacción) | Sueño, cognición | Alta |
| Foto | Piel y lesiones (herpes, erupción) | Inmunidad | Alta (como registro) |
| Web Bluetooth (Chrome en Windows o macOS) | Igual que Android: medidores BLE | PA, glucosa, SpO₂ | Alta (si hay medidor) |

## 3. Cobertura de los 6 indicadores del desafío

| Indicador | Automático con lo que tenemos | Respaldo |
|---|---|---|
| Presión arterial | ❌ Ningún dispositivo da valores (el Watch solo avisa de hipertensión) | Entrada manual, o tensiómetro BLE vía Android o notebook |
| Frecuencia cardíaca | ✅ Watch (continua) · rPPG en la notebook · dedo en la cámara del teléfono · AirPods Pro 3 | Manual |
| Glucosa | ❌ | Manual (o glucómetro BLE) |
| Temperatura | 🟡 Watch: solo la **variación nocturna** | Termómetro manual |
| Sueño | ✅ Watch (duración + fases) | Manual |
| Ánimo | ✅ Estado de ánimo en Salud + expresión facial (como apoyo) | Emojis en la app |

**Resumen:** 3 de los 6 se automatizan bien (FC, sueño, ánimo), 1 a medias (temperatura) y 2 siguen siendo manuales (PA y glucosa). **Eso es realista y conviene contarlo así:** en la ISS también se combinan dispositivos y registro manual.

## 4. Cómo llegan los datos del Apple Watch a la app

Los datos del Watch y los AirPods viven en **Apple Salud (HealthKit)**, y **una página web no puede leer HealthKit**. Hay tres caminos:

| Camino | Necesita | Esfuerzo | Qué datos da |
|---|---|---|---|
| **A. Atajos de iOS** (acción "Buscar muestras de Salud" → "Obtener contenido de URL") | Solo el iPhone | Bajo (~1–2 h) | FC, HRV, sueño, SpO₂, temperatura de muñeca, ánimo, ruido… en lote (no en vivo) |
| **B. App nativa iOS (Swift + HealthKit)** | **Mac + Xcode** | Alto | Todo lo de Salud + **seguimiento de cabeza de los AirPods** + FC en vivo del Watch |
| **C. Exportar Salud** (archivo `export.zip`) | Solo el iPhone | Muy bajo | Histórico real para generar la demo |

**Recomendación (hay Mac):**

1. **C** al empezar: exportamos Salud y armamos la línea base con datos reales nuestros.
2. **B como "app puente"**: una app iOS mínima en SwiftUI, de una sola pantalla, que:
   - lee HealthKit (FC, HRV, sueño, SpO₂, temperatura de muñeca, frecuencia respiratoria, ánimo, ruido, audiograma);
   - transmite el **seguimiento de cabeza de los AirPods** (`CMHeadphoneMotionManager`) para el test vestibular;
   - mide la **FC con el dedo** usando la cámara y el flash del iPhone (`AVCaptureDevice` con *torch*);
   - envía todo como JSON a la estación (notebook) por la red local.
3. **A (atajo)** como **plan de respaldo**, si la app puente se atrasa o falla en la demo.

La **interfaz principal sigue siendo la PWA**: corre igual en Android, iPhone y la notebook. La app nativa es solo un puente de sensores, sin UI propia más allá de "Conectar" y "Sincronizar".

**Opcional, si sobra tiempo:** una app de **watchOS** que inicie una sesión de entrenamiento y mande la **FC en vivo** al iPhone (`HKWorkoutSession`). Sirve para mostrar el pulso en tiempo real durante el escaneo facial o el ejercicio.

**Verificar el día 1 (lo hace quien tenga la Mac):**
- **Cuenta de desarrollador:** con un Apple ID gratuito (*Personal Team*) se puede instalar en el teléfono propio, pero la firma **vence a los 7 días** y algunas capacidades pueden no estar disponibles. Comprobar que **HealthKit** se puede activar. Si no, hace falta el Apple Developer Program (USD 99 al año).
- **Versión de Xcode** compatible con la versión de iOS del iPhone que vamos a usar.
- iPhone en **modo desarrollador** (Ajustes → Privacidad y seguridad).
- Permiso de **red local** en la app (`NSLocalNetworkUsageDescription`) para llegar a la estación.

### Arquitectura propuesta: "la nave no tiene internet"

```
 ⌚ Watch ──► 📱 iPhone (Salud) ──Atajo──┐
 🎧 AirPods ─┘                           │  POST JSON por Wi-Fi local (LAN)
                                         ▼
 🤖 Android (PWA) ──────────────► 💻 Notebook = ESTACIÓN DE LA NAVE
   cámara+flash, BLE, sensores       servidor local + PWA del oficial médico
                                     webcam: rPPG, fatiga, pose, test visual
                                         │
                                         ▼
                           "Enlace con Tierra" con retraso simulado
```

- La notebook hace de **servidor de la nave** en la red local. Encaja con la narrativa: sin internet y con retraso de comunicación.
- Los teléfonos abren la PWA desde la notebook. Los datos se guardan en el teléfono (IndexedDB) y se sincronizan con la estación.
- Cambio al [modelo de datos](prototipo.md): añadir `deviceId` y `method` (`'watch' | 'airpods' | 'camera_ppg' | 'rppg' | 'ble' | 'manual'`) a `Reading`, y una `confidence`, para que el motor de reglas pese más un dato del Watch que uno de rPPG.

## 5. Ideas para destacar con los dispositivos

Ordenadas por **impacto en la demo / esfuerzo**.

| # | Idea | Dispositivos | Riesgo NASA | Esfuerzo |
|---|---|---|---|---|
| 1 | **"Chequeo matutino de 90 s"**: la noche llega sola (sueño, HRV, FC en reposo, SpO₂, temperatura de muñeca y frecuencia respiratoria del Watch) y el astronauta solo añade ánimo + PVT de 30 s | Watch + teléfono | Sueño, conducta, CV | Bajo |
| 2 | **Escaneo facial en la estación**: 30 s frente a la webcam → FC sin contacto + fatiga (parpadeo y PERCLOS) + comparación de hinchazón con la base | Notebook | Sueño, fluidos / SANS | Medio |
| 3 | **Ruido de cabina real**: el Watch mide los dB y se cruzan con la prueba de audición de los AirPods | Watch + AirPods | HSRB acústica | Bajo |
| 4 | **Test de aptitud al aterrizar** (estilo [*new tests evaluate mission readiness*](../../nasa/fuentes/04-articulos-profundizacion/new-tests-evaluate-mission-readiness-of-astronauts-upon-landing.md)): equilibrio con el teléfono en el pecho, ojos abiertos y cerrados, + **giros de cabeza medidos con AirPods** (app puente) | iPhone + AirPods | [Sensoriomotor](../../nasa/riesgos/fisiologia/sensoriomotor-vestibular.md) | Medio |
| 5 | **Entrenador de ejercicio por cámara**: cuenta repeticiones y corrige la postura; alimenta la racha de la gamificación | Notebook | Hueso, músculo | Medio |
| 6 | **FC con el dedo en la cámara**, sin ningún dispositivo extra | Android (PWA) + iPhone (app puente) | CV | Medio |
| 7 | **Alerta temprana de infección**: temperatura de muñeca ↑ + FC en reposo ↑ + HRV ↓ durante 2 noches → regla compuesta | Watch | [Inmunidad](../../nasa/riesgos/fisiologia/inmunidad.md) | Bajo (solo reglas) |
| 8 | **Simulacro de despresurización** con el barómetro del teléfono → la app activa el protocolo de hipoxia | iPhone | [Hipoxia](../../nasa/riesgos/fisiologia/hipoxia.md) | Bajo |
| 9 | **Test visual en pantalla** (agudeza + Amsler) con la distancia medida por la cámara | Notebook | SANS | Medio |

**Nuevas reglas compuestas** que habilitan los dispositivos (añadir a `rules.json`):

| Patrón | Interpretación | Acción |
|---|---|---|
| Temperatura de muñeca +0,5 °C sobre la base + FC en reposo +5 lpm + HRV −20 %, 2 noches | Posible infección incipiente | 🟡 Medir la temperatura con termómetro, descansar |
| PERCLOS alto + PVT lento + sueño < 6 h | Fatiga operativa | 🟠 Posponer tareas críticas (EVA, pilotaje) |
| Ruido > 70 dB sostenido + umbral auditivo peor que la base | Daño auditivo por ruido de cabina | 🟡 Protección auditiva, revisar el equipo |
| Oscilación del equilibrio mayor que la base tras el aterrizaje | Desadaptación vestibular | 🟠 No conducir ni operar el rover |

## 6. Límites honestos (decirlo en el pitch)

- Son **dispositivos de consumo**, no equipo médico certificado. Usamos **tendencias contra la línea base personal**, no diagnósticos.
- rPPG y FC por cámara son **demostrativos**; la fuente principal de FC es el Watch.
- PA y glucosa necesitan **medidores dedicados**. La arquitectura ya admite BLE, pero hoy los cargamos a mano.
- Datos de salud reales de miembros del equipo: **solo con su consentimiento**, y mejor anonimizados en la demo pública.

## 7. Decisiones pendientes

1. Completar el inventario: **modelos exactos** del Watch y de los AirPods (~~¿hay Mac?~~ ✅ sí).
2. ~~Elegir el camino de datos del Watch~~ → **C + app puente (B)**, con el atajo (A) de respaldo. Falta verificar la cuenta de desarrollador y HealthKit (sección 4).
3. Elegir las ideas de la sección 5 para el MVP. Propuesta: **#1 chequeo matutino**, **#2 escaneo facial** y **#7 alerta de infección**, + **#4 test vestibular con AirPods** como diferencial gracias a la app nativa.
4. Asignar una persona a la **app puente iOS** (la que tenga la Mac), en paralelo al frontend de la PWA.
