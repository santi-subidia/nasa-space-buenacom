# Trazabilidad · funcionalidad ↔ desafío ↔ documentación NASA ↔ código

> Para qué sirve: responder al criterio **Validez** de Space Apps ("cada regla y texto enlaza a su fuente", [plan-proyecto §7](plan-proyecto.md)). Cada fila dice **qué pide el desafío**, **qué documento lo justifica** y **dónde está en el código**.
> Estado al 14-11-2026 (antes del congelamiento de código del domingo 17:00). Pruebas: `npm test` 47/47 y `npm --prefix ai test` 106/106.

Leyenda: ✅ implementado con datos del motor · 🟡 parcial o con datos fijos (mock) · ❌ documentado pero no implementado.

## 1. Funcionalidades → documentación

| Pantalla / funcionalidad | Objetivo del [desafío](../00-desafio/desafio.md) | Documentación que la justifica | Código | Estado |
|---|---|---|---|---|
| **Semáforo determinista** (umbrales + línea base + reglas compuestas) | Códigos de color; "¿cuándo llamar a la tripulación o a los médicos de vuelo?" | [catalogo-indicadores](../04-sintesis/catalogo-indicadores.md) (umbrales y reglas compuestas) · cada regla cita su `source` en `doc/fuentes/` | `lib/motor/evaluar.js`, `lib/motor/rules.json` | ✅ |
| **La IA nunca baja la alerta** (`mergeLevel`, `limitarPlan`) | Orientación segura sobre tratamientos | [plan-final §2 y §5](plan-final.md) | `lib/motor/evaluar.js`, `ai/junta/niveles.js`, `ai/entrenador/plan.js` | ✅ |
| **Inicio** (`/`): semáforo global, alerta, chequeo del día | Herramienta visual para evaluar la propia salud | [ideas-ux §Principios 1](../04-sintesis/ideas-ux-gamificacion.md) ("de un vistazo") | `components/inicio/` | ✅ |
| **Mapa corporal** (`/mapa`): 9 zonas clicables | Figura humana clicable (ejemplo del desafío) | [matriz-peligro-riesgo-indicador](../04-sintesis/matriz-peligro-riesgo-indicador.md) | `components/mapa/`, `lib/content/zones.js` | 🟡 corazón, pulmones, cerebro, inmune y ojos salen de las lecturas y del motor; **oído, riñones, músculos y huesos son valores fijos** |
| **Registrar** (`/registrar`): 6 indicadores + ánimo + foto de piel + PVT | Entrada libre (teclado, clics, cámara); PA, FC, glucosa, temperatura, sueño, ánimo | [catalogo Tier 1 y Tier 2](../04-sintesis/catalogo-indicadores.md) · [inmunidad](../02-riesgos/fisiologia/inmunidad.md) (foto) · [sueño](../02-riesgos/conducta/sueno-horarios.md) (PVT) | `components/registrar/` | ✅ |
| **Test visual SANS** (`/registrar#vision`): E direccional de 10 niveles + "veo borroso" | Indicadores elegidos con los recursos del HRP; recordatorios de rutina (semanal, miércoles) | [sans-ojos](../02-riesgos/fisiologia/sans-ojos.md) (~70 % con edema de disco) · [catalogo Tier 2 "Agudeza visual"](../04-sintesis/catalogo-indicadores.md) | `components/registrar/TestVision.js` → lectura `visual_acuity` + síntoma `blurred_vision` | ✅ |
| **Regla SANS** (`sans_visual_change`): visión borrosa + agudeza ≥ 10 puntos peor que la base → 🟠 oficial médico | Cuándo escalar a la tripulación | [catalogo §Reglas compuestas](../04-sintesis/catalogo-indicadores.md) · [fuente HRP SANS](../fuentes/02-riesgos/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans.md) | `lib/motor/evaluar.js`, `lib/motor/rules.json` | ✅ |
| **Regla de déficit de ejercicio** (`exercise_deficit_week`): promedio de 7 días < 45 min (50 % del plan) → 🟡 | Acciones para evitar condiciones críticas | [catalogo §Reglas compuestas](../04-sintesis/catalogo-indicadores.md) · [capacidad-fisica](../02-riesgos/fisiologia/capacidad-fisica.md) · [hueso](../02-riesgos/fisiologia/hueso.md) | `lib/motor/evaluar.js`, `lib/motor/rules.json` | ✅ |
| **Tendencias** (`/tendencias`) con bandas y línea base | Gráficos dinámicos | [ideas-ux §Pantallas 4](../04-sintesis/ideas-ux-gamificacion.md) | `components/tendencias/` | ✅ |
| **Jornada** (`/jornada`): sol de 24 h 37 min, sueño protegido | Recordatorios de rutina; varios entornos | [plan-final §3](plan-final.md) · [sueño y horarios](../02-riesgos/conducta/sueno-horarios.md) · [distancia](../01-peligros/distancia-tierra.md) | `lib/reloj/relojMision.js`, `components/jornada/` | ✅ |
| **Notificaciones** (4 tipos, silencio nocturno) | Recordatorios de rutina | [plan-final §4](plan-final.md) | `lib/notificaciones/`, `components/notificaciones/` | ✅ |
| **Vega** (`/vega`): voz, citas `[F1]`, red de seguridad local | "No dar nada por sabido": explicaciones simples | [conducta-psiquiatria](../02-riesgos/conducta/conducta-psiquiatria.md) · [soporte-sistemas](../02-riesgos/conducta/soporte-sistemas.md) · fichas de `doc/02-riesgos/**` | `ai/vega/`, `ai/fichas/mapa.js`, `ai/vega/urgencia.js` | ✅ |
| **Chequeo por voz** (tool `registrar_medicion`) | Entrada libre de datos | [plan-final §5 regla 5](plan-final.md) | `ai/chequeo/` | ✅ |
| **Entrenador** (`/entrenador`): MediaPipe Pose + plan con techo | Acciones para evitar condiciones críticas | [capacidad-fisica](../02-riesgos/fisiologia/capacidad-fisica.md) · [hueso](../02-riesgos/fisiologia/hueso.md) (1,5 h/día) | `components/entrenador/`, `lib/entrenador/`, `ai/entrenador/` | ✅ |
| **¿Cómo me ves hoy?** (`/cara`): PERCLOS + foto base | Imágenes de cámara como indicador | [sueño](../02-riesgos/conducta/sueno-horarios.md) (fatiga) · [SANS](../02-riesgos/fisiologia/sans-ojos.md) (fluidos a la cabeza) · [inmunidad](../02-riesgos/fisiologia/inmunidad.md) (piel) | `components/cara/`, `lib/cara/`, `ai/cara/` | ✅ |
| **Junta médica** (`/junta`): 5 especialistas en 1 consulta | Cuándo escalar a médicos de vuelo | [HSRB · condiciones médicas en vuelo](../fuentes/05-human-system-risk-board/risk-of-adverse-health-outcomes-and-decrements-in-performance-due-to-inflight-medical-conditions.md) (proyecto AMO) | `ai/junta/`, `components/junta/` | ✅ |
| **Enlace con Tierra** (`/enlace`): retraso de 14 min | Escalar a *flight surgeons* | [distancia-tierra](../01-peligros/distancia-tierra.md) · [communicating-with-missions](../fuentes/04-articulos-profundizacion/communicating-with-missions.md) · [HERA y retrasos](../fuentes/04-articulos-profundizacion/houston-do-you-copy-hera-crew-navigates-communication-delays.md) | `lib/enlace/`, `components/enlace/` | ✅ |
| **Tripulación / vista CMO** (`/tripulacion`) con consentimiento | Oficial médico de la tripulación | [ideas-ux §Principios 5](../04-sintesis/ideas-ux-gamificacion.md) (privacidad por capas) · [trabajo-en-equipo](../02-riesgos/conducta/trabajo-en-equipo.md) | `lib/tripulacion/`, `components/tripulacion/` | ✅ |
| **Modo demo pública** (`IA_APAGADA=1`) | — (robustez) | [plan-final §5 reglas 8 y 9](plan-final.md) · [soporte-sistemas](../02-riesgos/conducta/soporte-sistemas.md) (funcionar sin conexión) | `ai/almacen.js`, `ai/respaldo-demo.json` | ✅ |
| **Racha de ejercicio** | Gamificación | [ideas-ux §Gamificación](../04-sintesis/ideas-ux-gamificacion.md) | `lib/entrenador/racha.js` | 🟡 solo racha; sin medallas ni meta de tripulación |

## 2. Cobertura de los 17 riesgos del HRP ([tabla maestra](../02-riesgos/README.md))

| # | Riesgo | Prioridad doc | Cómo lo cubre la app | Estado |
|---|---|---|---|---|
| 1 | Sistema inmune | ⭐⭐⭐ | Temperatura, estrés, foto de piel, regla `viral_reactivation`, junta | ✅ |
| 2 | Sensoriomotor / vestibular | ⭐⭐ | Solo texto y valor fijo en la zona "Oído interno" | 🟡 |
| 3 | Cardiovascular | ⭐⭐⭐ | PA, FC, `orthostatic_pre_landing`, `jugular_vte` | ✅ |
| 4 | Descompresión | ⭐ | Solo en fichas de Vega y de la junta | 🟡 |
| 5 | Microorganismos | ⭐⭐ | Solo en fichas | 🟡 |
| 6 | Hipoxia | ⭐⭐ | SpO₂ + regla `hypoxia_co2` (el CO₂ de cabina es un valor fijo) | 🟡 |
| 7 | Nutrición | ⭐⭐⭐ | Glucosa, agua; tarea de aceptabilidad de la comida. `mass_kg` y `kcal` existen en `lib/tipos.js` pero no tienen datos ni pantalla | 🟡 |
| 8 | EVA | ⭐ | Pregunta sugerida a Vega; sin checklist "¿apto?" | 🟡 |
| 9 | Capacidad física | ⭐⭐⭐ | Entrenador, `exercise_min`, racha, regla `exercise_deficit_week` | ✅ |
| 10 | SANS | ⭐⭐ | Test visual en `/registrar#vision`, base personal (Ana 92, Marcos 94), regla `sans_visual_change`, tarea semanal de la jornada y zona Ojos del mapa con datos reales | ✅ |
| 11 | Hueso | ⭐⭐⭐ | Indirecto vía ejercicio; la zona muestra valores fijos | 🟡 |
| 12 | Conducta | ⭐⭐⭐ | Ánimo, `mood_low_streak`, red de urgencia local, Vega | ✅ |
| 13 | Trabajo en equipo | ⭐ | Vista CMO; falta la encuesta semanal de cohesión que agenda la jornada | 🟡 |
| 14 | Sueño | ⭐⭐⭐ | Sueño, PVT, PERCLOS, sueño protegido, `sleep_deficit_streak` | ✅ |
| 15 | Soporte de sistemas | ⭐⭐ | Principios de UX, modo sin conexión, accesibilidad forma + color | ✅ |
| 16 | Cargas dinámicas | ⭐ | Nada | ❌ |
| 17 | Cáncer por radiación | ⭐⭐ | Umbral `radiation_msv` en el motor, **sin entrada, datos ni pantalla** | ❌ |

**Lectura rápida:** los 6 indicadores que pide el desafío y los 7 riesgos ⭐⭐⭐ están cubiertos, y SANS también. El hueco más visible es **el peligro R (radiación)**, que es el primero de los 5 peligros y tiene un recurso propio de la CSA en el desafío.

## 3. Documentado pero no implementado

| Qué | Dónde está documentado | Observación |
|---|---|---|
| Selector de entorno (nave / estación / rover / Luna / Marte) | [plan-proyecto §4 MVP 6](plan-proyecto.md) · [catalogo §Ajustes por entorno](../04-sintesis/catalogo-indicadores.md) · desafío "varios entornos" | `ENTORNOS` y `envModifiers` ya existen; todas las pantallas fijan `'mars_base'` |
| Grafo causal del riesgo (DAG del HSRB) | [02-riesgos §Idea de valor diferencial](../02-riesgos/README.md) | Ej.: poco sueño → estrés → inmunidad baja → herpes |
| Panel de cabina (CO₂, O₂, ruido, dosis) | [ideas-ux §Pantallas 8](../04-sintesis/ideas-ux-gamificacion.md) | — |
| Medallas y meta cooperativa de tripulación | [ideas-ux §Gamificación](../04-sintesis/ideas-ux-gamificacion.md) | — |
| Checklist pre-EVA y pre-aterrizaje | [plan-final §3 "Por evento"](plan-final.md) · [ideas-ux §Recordatorios](../04-sintesis/ideas-ux-gamificacion.md) | — |
| Exportar informe (CSV / JSON) | [plan-proyecto §4 Extras](plan-proyecto.md) | — |
| Aprender: fichas de los 5 peligros RIDGE | [ideas-ux §Pantallas 9](../04-sintesis/ideas-ux-gamificacion.md) | El contenido ya está en [01-peligros](../01-peligros/README.md) |
