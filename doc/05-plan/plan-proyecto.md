# Plan de proyecto · Hackathon NASA Space Apps 2026

> Desafío: *Create Health Monitoring Software for Astronauts on Space Missions* ([00-desafio](../00-desafio/desafio.md))
> Nombre provisional del producto: **"AstroVitals"** (cámbialo libremente)

## 1. Planteamiento del problema

En misiones largas, los astronautas son **responsables de detectar en sí mismos** los cambios de salud que provocan los 5 peligros (RIDGE). Desde Marte el retraso de comunicación llega a **20 min por trayecto**, y la NASA reconoce que **no hay contramedidas conductuales validadas para exploración** y que necesita un **sistema de apoyo a la decisión médica** (proyecto AMO).

## 2. Propuesta de valor (una frase)

> *Una app sin conexión que convierte mediciones simples (PA, FC, glucosa, temperatura, sueño, ánimo y más) en un semáforo por sistema corporal, con explicaciones y acciones guiadas basadas en los riesgos del HRP de la NASA, y que escala a los médicos de vuelo solo cuando hace falta.*

## 3. Usuarios

| Usuario | Necesidad |
|---|---|
| **Astronauta** | Saber "¿estoy bien?" y "¿qué hago?" en menos de 2 minutos al día |
| **Oficial médico de la tripulación** | Ver el estado del equipo y actuar primero |
| **Médico de vuelo (tierra)** | Recibir informes resumidos con retraso y dar indicaciones |

## 4. Alcance

### MVP (lo que **se demuestra** en el hackathon)

1. Registro de los **6 indicadores del desafío** + SpO₂, agua y ejercicio.
2. **Motor de reglas** con semáforo (umbrales + línea base + reglas compuestas). Ver [catálogo](../04-sintesis/catalogo-indicadores.md).
3. **Mapa corporal clicable** con estado por zona. Ver [matriz](../04-sintesis/matriz-peligro-riesgo-indicador.md).
4. **Gráficos de tendencia** con bandas de color.
5. **Guías de acción** + fichas educativas (ⓘ).
6. **Selector de entorno** (nave / estación / rover / base en Marte) que ajusta umbrales y textos.
7. **Datos de demostración** de una misión simulada de 60 días con un "evento" (por ejemplo, reactivación viral el día 42).

### Extras si sobra tiempo

- Gamificación (rachas y medallas).
- Minijuego de tiempo de reacción.
- Test de agudeza visual.
- Foto de la piel con la cámara.
- Panel de la tripulación.
- Bandeja asíncrona con retraso simulado.
- Panel de radiación y CO₂.
- Exportar CSV o JSON.

### Fuera del alcance

Diagnóstico médico real, integración con hardware real certificado e IA clínica.

## 5. Cronograma (hackathon de 48 h, equipo de 4–6 personas)

| Bloque | Horas | Entregable | Responsable |
|---|---|---|---|
| Kickoff | 0–2 | Roles, alcance cerrado, repositorio, *wireframes* en papel | Todos |
| Investigación → reglas | 2–6 | `rules.json` con umbrales, textos educativos y fuentes de la NASA | Investigación / contenido |
| Diseño UI | 2–8 | Figma: inicio, mapa corporal, registro, tendencias, alerta | Diseño |
| Esqueleto de la app | 2–8 | App web con rutas, almacenamiento local y datos de demostración | Frontend |
| Motor de reglas | 6–14 | `evaluate(readings, baseline, env) → estado por zona + alertas` (+ tests) | Lógica |
| Pantallas MVP | 8–24 | Inicio, registro, mapa corporal y tendencias funcionando | Frontend |
| Dormir 😴 | — | (¡aplica el riesgo de sueño!) | Todos |
| Integración y guías | 24–32 | Alertas + guías + ⓘ, selector de entorno | Frontend + contenido |
| Extras | 32–40 | Gamificación, minijuego, cámara | Según disponibilidad |
| Pulido + demo | 40–46 | Guion de la demo, video de 30 s, capturas, README | Todos |
| Envío | 46–48 | Proyecto enviado en la web de Space Apps | Capitán |

## 6. Riesgos del proyecto

| Riesgo | Mitigación |
|---|---|
| Alcance excesivo | MVP cerrado en la hora 2; los extras solo si el MVP está verde |
| Rigor médico | Umbrales configurables + aviso legal + **citar las fuentes de la NASA** en cada ficha |
| Mapa corporal 3D costoso | Empezar con **SVG 2D** por zonas; el 3D es un extra |
| Datos | Generador de **datos sintéticos** con una narrativa (evento en la demo) |

## 7. Criterios de evaluación de Space Apps (cómo atacarlos)

- **Impacto:** responde a un hueco real que reconoce la NASA (autonomía médica, sin contramedidas conductuales validadas).
- **Creatividad:** mapa corporal + reglas compuestas + entorno adaptable + gamificación cooperativa.
- **Validez:** cada regla y texto **enlaza a su fuente** de la NASA ([fuentes/INDICE.md](../fuentes/INDICE.md)).
- **Relevancia:** usa los recursos del HRP que propone el desafío.
- **Presentación:** demo con la historia "Día 42 en Marte" (ver [prototipo](prototipo.md)).
