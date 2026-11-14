# 02 · Riesgos para la salud (HRP + Human System Risk Board)

> Fuente principal: https://www.nasa.gov/hrp/risks/ · Originales en [`../fuentes/02-riesgos/`](../fuentes/02-riesgos/) y la versión técnica oficial (HSRB) en [`../fuentes/05-human-system-risk-board/`](../fuentes/05-human-system-risk-board/)

El HRP identifica **17 riesgos de divulgación** en tres grupos. Sus efectos **varían según el destino**: órbita baja (ISS), Luna o Marte.

## Tabla maestra

| # | Riesgo | Grupo | Peligros (RIDGE) | ¿Medible por el astronauta en vuelo? | Prioridad para la app | Ficha |
|---|---|---|---|---|---|---|
| 1 | Sistema inmune alterado | Fisiología | E, R, I | Sí: síntomas, temperatura, saliva (lab) | ⭐⭐⭐ | [inmunidad](fisiologia/inmunidad.md) |
| 2 | Sensoriomotor/vestibular | Fisiología | G | Sí: autotests de equilibrio, escala de mareo | ⭐⭐ | [sensoriomotor-vestibular](fisiologia/sensoriomotor-vestibular.md) |
| 3 | Adaptaciones cardiovasculares | Fisiología | G, R | **Sí: PA, FC, ECG, ecografía** | ⭐⭐⭐ | [cardiovascular](fisiologia/cardiovascular.md) |
| 4 | Enfermedad por descompresión | Fisiología | E | Síntomas durante/después de EVA | ⭐ | [descompresion](fisiologia/descompresion.md) |
| 5 | Interacción huésped-microorganismo | Fisiología | E | Síntomas, hisopos (lab) | ⭐⭐ | [microorganismos](fisiologia/microorganismos.md) |
| 6 | Hipoxia | Fisiología | E | **Sí: SpO₂ (oxímetro), síntomas** | ⭐⭐ | [hipoxia](fisiologia/hipoxia.md) |
| 7 | Alimentación y nutrición inadecuadas | Fisiología | D | **Sí: ingesta, peso/masa, agua** | ⭐⭐⭐ | [nutricion](fisiologia/nutricion.md) |
| 8 | Lesión y rendimiento en EVA | Fisiología | E, G | Fatiga, lesiones, CO₂ | ⭐ | [eva](fisiologia/eva.md) |
| 9 | Menor capacidad cardiorrespiratoria y musculoesquelética | Fisiología | G | **Sí: ejercicio, fuerza, VO₂ estimado** | ⭐⭐⭐ | [capacidad-fisica](fisiologia/capacidad-fisica.md) |
| 10 | SANS (síndrome neuro-ocular) | Fisiología | G | Sí: test de agudeza visual, OCT/fondo de ojo | ⭐⭐ | [sans-ojos](fisiologia/sans-ojos.md) |
| 11 | Cambios óseos | Fisiología | G | Indirecto: ejercicio, calcio, días en misión | ⭐⭐⭐ | [hueso](fisiologia/hueso.md) |
| 12 | Conducta y trastornos psiquiátricos | Conducta | I, D, R | **Sí: ánimo, cuestionarios, diario** | ⭐⭐⭐ | [conducta-psiquiatria](conducta/conducta-psiquiatria.md) |
| 13 | Trabajo en equipo inadecuado | Conducta | I, D | Encuesta de cohesión/conflicto | ⭐ | [trabajo-en-equipo](conducta/trabajo-en-equipo.md) |
| 14 | Sueño inadecuado y horarios irregulares | Conducta | I | **Sí: horas de sueño, actigrafía, alerta** | ⭐⭐⭐ | [sueno-horarios](conducta/sueno-horarios.md) |
| 15 | Soporte de sistemas/operaciones inadecuado | Conducta | D | n/a (es un requisito de **UX** para nuestra app) | ⭐⭐ | [soporte-sistemas](conducta/soporte-sistemas.md) |
| 16 | Lesión por cargas dinámicas | Conducta / Factores humanos | G | Checklist previo al aterrizaje | ⭐ | [cargas-dinamicas](conducta/cargas-dinamicas.md) |
| 17 | Cáncer inducido por radiación | Radiación | R | Dosis acumulada (dosímetro) | ⭐⭐ | [cancer-por-radiacion](radiacion/cancer-por-radiacion.md) |

⭐⭐⭐ = núcleo del MVP · ⭐⭐ = deseable · ⭐ = mención o extra

## Riesgos adicionales del Human System Risk Board (lista técnica completa)

La lista oficial del HSRB tiene ~30 riesgos. Además de los anteriores, incluye estos, que conviene **usar en la app**:

- **Riesgo de CO₂** (exposición aguda y crónica en cabina): dolor de cabeza y menor rendimiento. *Medible con un sensor de cabina.*
- **Cálculos renales**: el calcio que suelta el hueso aumenta el riesgo. Prevención: **ejercicio + hidratación**. **No se puede tratar** en misiones de exploración. *Medible: ingesta de agua y diuresis.*
- **Condiciones médicas en vuelo**: la NASA investiga un **sistema de apoyo a la decisión médica** (proyecto AMO). Es **el antecedente directo de nuestra app**.
- **Tromboembolismo venoso** (ahora dentro del riesgo CV): **55 % (6 de 11)** de los tripulantes mostró flujo estancado o invertido en la vena yugular interna hacia el día de vuelo 50, y **1 tuvo un trombo oclusivo** que hubo que tratar en vuelo.
- **Medicamentos ineficaces o tóxicos** en misiones largas (caducidad y estabilidad). *Útil para el inventario del botiquín.*
- **Retención urinaria**, **pérdida auditiva por acústica**, **sustancias tóxicas**, **polvo celeste**, **radiación no ionizante**, **descarga eléctrica**.
- **Capacidad aeróbica reducida** y **reducción de músculo** (tratados por separado).
- **EIHSO**: operaciones humano-sistema independientes de la Tierra.
- **Capacidad de salir del vehículo tras el aterrizaje** (*egress*).

Cada ficha del HSRB enlaza a su **Risk Record (PDF)**, al **DAG** (grafo causal, en PDF y TXT) y a los **Evidence Reports**. Están en [`../fuentes/INDICE.md`](../fuentes/INDICE.md).

> 💡 **Idea de valor diferencial:** el HSRB modela cada riesgo como un **DAG causal** (peligro → factores → efecto). Nuestra app podría mostrar un "grafo de riesgo" simplificado por astronauta, por ejemplo: *poco sueño → estrés → inmunidad baja → herpes labial*.
