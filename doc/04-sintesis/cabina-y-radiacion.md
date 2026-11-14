# Cabina y radiación · cifras verificadas para el panel de cabina

> Usadas por `lib/cabina/simulador.js` y la pantalla `/cabina`. Reemplazan el "orden de magnitud orientativo, hay que verificarlo" de [cancer-por-radiacion](../02-riesgos/radiacion/cancer-por-radiacion.md).
> Los **sensores y el dosímetro son simulados**; las cifras de referencia sí salen de documentos de la NASA (verificado el 14-11-2026).

## Radiación

| Dato | Valor | Fuente |
|---|---|---|
| Límite de carrera (dosis efectiva por vuelos espaciales) | **< 600 mSv**, igual para todas las edades y sexos; superarlo requiere una excepción (*waiver*) de la agencia antes de la misión | NASA-STD-3001 Vol. 1 · [OCHMO-TB-020 Radiation Protection](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf) |
| Base del límite | Mantener a cada astronauta por debajo de **3 %** de riesgo medio de muerte por cáncer inducido (REID) | Mismo documento |
| Tránsito Tierra → Marte | **~1,8 mSv/día** de rayos cósmicos galácticos (medido por Curiosity/RAD) | [JPL · Data From NASA Rover's Voyage to Mars Aids Planning](https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/) |
| Superficie de Marte | **~0,64–0,67 mSv/día** (cráter Gale, Curiosity/RAD): unas 2,5 veces menos que en tránsito | [NASA Science · Radiation Measurements on Mars](https://science.nasa.gov/resource/radiation-measurements-on-mars/) |
| Equivalencia | 1 mSv ≈ 10 radiografías de tórax; los astronautas reciben entre 50 y 2.000 mSv | [why-space-radiation-matters](../fuentes/04-articulos-profundizacion/why-space-radiation-matters.md) |
| Misiones a Marte | Es probable que superen los 600 mSv | [National Academies · NASA's Spaceflight Radiation Exposure Standard](https://nap.nationalacademies.org/read/26155/chapter/5) |
| Contramedida ante tormenta solar | Refugiarse usando la carga almacenada como blindaje | [01-peligros/radiacion](../01-peligros/radiacion.md) |

## Atmósfera de cabina

| Dato | Valor | Fuente |
|---|---|---|
| CO₂, límite operativo | Promedio de 1 h **≤ 3 mmHg** | NASA-STD-3001 Vol. 2 · [OCHMO-TB-004 Carbon Dioxide](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf) |
| CO₂, objetivo para evitar cefaleas | Promedio de 7 días **< 2,5 mmHg**; cefaleas reportadas entre 2,8 y 4,5 mmHg | Mismo documento |
| CO₂, máximo histórico de la ISS (180 días) | 5,3 mmHg (SMAC) | [NTRS · CO₂ on the ISS: An Operations Update](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20150019624.pdf) |
| Ruido continuo en zonas de trabajo | Curva **NC-50** (≈ 55 dBA, aproximación nuestra) | NASA-STD-3001 · [OCHMO-TB-035 Acoustics](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-035-acoustics.pdf) |
| Ruido en zonas de descanso (misiones > 30 días) | Curva **NC-40** (≈ 45 dB) | Mismo documento · [Sleep Accommodations](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-041-sleep-accommodations.pdf) |
| O₂ de cabina | 19,5–23,5 % a presión de nivel del mar | **Orientativo** (rango general de seguridad ocupacional, no sale de la NASA) |

## Cómo lo usa AstroVitals

- **Dosímetro personal:** dosis acumulada = tránsito (180 días × 1,8) + soles en superficie × 0,64, con un pequeño extra por tiempo en EVA. Se muestra contra el límite de 600 mSv y con la proyección al regreso.
- **Tormenta solar (evento de partículas solares):** botón de simulación que dispara la alerta roja y el checklist de refugio.
- **Atmósfera y ruido:** valores simulados por sol que alimentan el panel y las zonas Pulmones y Oído interno del mapa corporal.
- **Nada de esto entra al semáforo personal** del tripulante: es un riesgo ambiental compartido y se muestra aparte.
