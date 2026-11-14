# 01 · Los 5 peligros del vuelo espacial tripulado (modelo RIDGE)

> Fuente principal: https://www.nasa.gov/hrp/hazards/ · Originales en [`../fuentes/01-peligros/`](../fuentes/01-peligros/)

El Human Research Program (HRP) de la NASA agrupa todos los problemas de salud del vuelo espacial en **5 peligros**. La propia NASA usa el acrónimo **RIDGE**:

| Letra | Peligro | Una línea | Ficha |
|---|---|---|---|
| **R** | Radiación espacial (*Space Radiation*) | Invisible, no se siente y es de los peligros más graves | [radiacion.md](radiacion.md) |
| **I** | Aislamiento y confinamiento (*Isolation & Confinement*) | Grupos pequeños, encerrados y lejos durante meses o años | [aislamiento-confinamiento.md](aislamiento-confinamiento.md) |
| **D** | Distancia a la Tierra (*Distance from Earth*) | Instrucciones, suministros y atención médica cada vez más lejos | [distancia-tierra.md](distancia-tierra.md) |
| **G** | Campos gravitatorios (*Gravity Fields*) | Todo el cuerpo se readapta a 0 g, a 1/6 g (Luna), a 3/8 g (Marte) y de vuelta a 1 g | [gravedad.md](gravedad.md) |
| **E** | Entornos hostiles/cerrados (*Hostile/Closed Environments*) | Temperatura, presión, luz, ruido, microbios e inmunidad | [entorno-hostil-cerrado.md](entorno-hostil-cerrado.md) |

## Ideas clave para el desafío

- **Los peligros se potencian entre sí.** Por ejemplo, el aislamiento empeora el sueño, el mal sueño altera la inmunidad y la radiación afecta a la cognición. Una app útil debería **cruzar indicadores** y no mostrarlos aislados.
- La NASA los estudia en tres escalones ("Three Steps to Mars"): **(1) análogos en Tierra** (HERA, CHAPEA, reposo en cama), **(2) la ISS** y **(3) las misiones Artemis**. Nuestro software puede declarar en qué entorno funciona: nave, estación, rover o base.
- **Con más distancia hay más autonomía.** Desde Marte la comunicación tarda hasta **20 min por trayecto**, así que el astronauta tiene que poder evaluar su salud y decidir **sin el control de misión en tiempo real**. Esta es la justificación central de nuestra herramienta.

## Del peligro al riesgo y al indicador (vista rápida)

```
R Radiación ──► cáncer, daño degenerativo (corazón, ojos), SNC/cognición ──► dosis acumulada, tests cognitivos
I Aislamiento ─► conducta/psiquiatría, equipo, sueño/ritmo circadiano ─────► ánimo, sueño, estrés, carga de trabajo
D Distancia ───► atención médica limitada, soporte de sistemas, nutrición ──► autoevaluación, guías, comida/peso
G Gravedad ────► hueso, músculo, cardio, SANS (ojos), vestíbulo, cargas ───► ejercicio, PA/FC, visión, mareo, calcio
E Entorno ─────► inmunidad, microbios, hipoxia, CO2, descompresión ─────────► temperatura, síntomas, SpO2, CO2 cabina
```

Desarrollo completo en [`../02-riesgos/`](../02-riesgos/) y [`../04-sintesis/matriz-peligro-riesgo-indicador.md`](../04-sintesis/matriz-peligro-riesgo-indicador.md).

## Videos oficiales (lista de reproducción de los 5 peligros)

1. Radiación: https://www.youtube.com/watch?v=3jRxgvwhGC0
2. Aislamiento: https://www.youtube.com/watch?v=FPinASEKA_I
3. Distancia: https://www.youtube.com/watch?v=0_pbs8dG1oM
4. Gravedad: https://www.youtube.com/watch?v=f3-96ZbY5NA
5. Entorno hostil/cerrado: https://www.youtube.com/watch?v=LgGt03MjHfA
