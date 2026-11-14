# Crear software de monitoreo de salud para astronautas en misiones espaciales

> **Título original:** *Create Health Monitoring Software for Astronauts on Space Missions*
> **Fuente:** https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/
> **Fecha de extracción:** 2026-11-14

## Ficha del desafío

| Campo | Valor |
|---|---|
| Evento | 2026 NASA Space Apps Challenge |
| Dificultad | Intermedia (*Intermediate*) |
| Temas | Exploración humana, Software, Exploración espacial |
| Inscripción de equipo | https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=teams |
| Preguntas / soporte | Space Apps Connect: https://github.com/nasa/spaceapps |

## Resumen

En las misiones de larga duración, los astronautas están expuestos a la radiación espacial, al aislamiento y el confinamiento, a una gravedad alterada y a un entorno cerrado hostil. Eso puede provocar cambios en el sistema inmune, pérdida ósea, eventos cardiovasculares y problemas de salud conductual. En estas misiones, gran parte de la responsabilidad de detectar esos cambios recae en los propios astronautas.

**El reto:** construir un software de monitoreo de salud que recopile indicadores de salud y permita a los astronautas evaluar su estado y actuar en consecuencia.

## Contexto (*Background*)

- Con la mayor inversión en tecnología e investigación espacial, las misiones son cada vez más ambiciosas. El programa **Artemis** de la NASA completó hace poco un sobrevuelo lunar tripulado, y la NASA y otras agencias planean enviar humanos a **Marte**.
- Cuanto más largas son las misiones, mayor es la exposición al entorno espacial y a sus riesgos físicos y mentales.
- El **Human Research Program (HRP)** de la NASA identifica **cinco peligros de los vuelos espaciales tripulados**:
  1. Radiación espacial
  2. Aislamiento y confinamiento
  3. Distancia a la Tierra
  4. Campos gravitatorios
  5. Entornos cerrados hostiles
- Estos peligros pueden causar o agravar:
  - cambios en el sistema inmune
  - pérdida de densidad ósea
  - eventos cardiovasculares
  - nutrición inadecuada
  - trastornos de salud conductual
  - otros problemas
- Los astronautas tienen que poder evaluar su propia salud durante la misión para prevenir y tratar los problemas que aparezcan.
- **Indicadores útiles que propone el desafío:** presión arterial, frecuencia cardíaca, glucosa en sangre, temperatura corporal, horas de sueño diarias y estado de ánimo.

## Objetivos

1. **Crear una herramienta visual** que ayude a los astronautas a **evaluar su propia salud** durante la misión y que les dé **orientación sobre tratamientos y mejoras de salud**.
2. **Entrada de datos libre:** el usuario puede introducir datos de cualquier forma: texto por teclado, clics del ratón o imágenes de cámara, por ejemplo.
3. **Cualquier tipo de dato**, siempre que represente un indicador de salud (por ejemplo, la glucosa en mg/dL o imágenes de ecografía).
4. **Base científica:** usar los recursos del HRP de la NASA y los recursos públicos de otras agencias espaciales para entender cómo afectan los peligros espaciales a la salud y elegir los indicadores más útiles para una evaluación rápida.

### Preguntas guía que plantea el desafío

- ¿Qué mediciones se pueden hacer en el espacio?
- ¿Por qué hace falta cada examen?
- ¿Cómo afectan los peligros del vuelo espacial a estos indicadores de salud?
- ¿Cuándo debería un resultado llamar la atención de la tripulación o de los **médicos de vuelo (*flight surgeons*)** en tierra?
- ¿Qué acciones se pueden tomar para evitar una condición de salud crítica?

### Interfaz de usuario (UI)

- El diseño de la interfaz es clave para presentar las métricas y los diagnósticos con claridad.
- Se recomienda usar **animaciones e interactividad**.
- **Ejemplo sugerido:** una **figura humana en la que cada parte del cuerpo se pueda pulsar** para ver información sobre su función y su estado de salud.

## Consideraciones opcionales (*Potential Considerations*)

No son obligatorias, pero se pueden tener en cuenta:

- **Varios entornos:** la herramienta puede dar información de salud en distintos contextos, como una nave espacial, una estación espacial, un rover o una base en otro planeta o luna.
- **Recordatorios de rutina:** la herramienta puede pedir a los astronautas que tomen mediciones o hagan ciertas acciones cada cierto tiempo, como parte de la rutina de la misión.
- **Funcionalidades sugeridas:**
  - **Gamificación** para motivar a los astronautas a hacer las tareas que favorecen su salud.
  - **Gráficos dinámicos** que muestren cómo cambian los indicadores con el tiempo.
  - **Códigos de color** para interpretar de un vistazo el estado de cada indicador.
- **No dar nada por sabido:** no hay que suponer que los astronautas saben todo sobre cómo evaluar su salud. La herramienta puede incluir instrucciones y explicaciones sencillas sobre mediciones, indicadores y riesgos.

## Recursos (pestaña *Resources*)

> Aviso de la NASA: la NASA no respalda a ninguna entidad que no pertenezca al Gobierno de EE. UU. y no se hace responsable de la información publicada en sitios ajenos a ese gobierno. En esos sitios, los participantes deben cumplir sus condiciones de uso de datos.
>
> Es posible que se añadan más recursos antes del hackathon.

### Datos y recursos de la NASA

| Recurso | Descripción | Enlace |
|---|---|---|
| 5 Hazards of Human Spaceflight | Información básica del HRP sobre los principales peligros para los humanos en misiones espaciales, con enlaces a artículos e informes detallados sobre cada uno. | https://www.nasa.gov/hrp/hazards/ |
| Risks of Human Spaceflight | Información básica del HRP sobre los principales riesgos de las misiones tripuladas, con enlaces a artículos e informes detallados sobre cada riesgo. | https://www.nasa.gov/hrp/risks/ |
| Ongoing HRP Research in Space | Artículos sobre la investigación en curso del Human Research Program. | https://www.nasa.gov/hrp/ongoing-hrp-research/ |

### Recursos de agencias espaciales socias

**CSA (Agencia Espacial Canadiense)**

| Recurso | Descripción | Enlace |
|---|---|---|
| Monitoring Radiation for Astronaut Health | Cómo ayuda la CSA a vigilar la radiación espacial para proteger la salud de los astronautas en misiones largas. Presenta tecnologías e investigación canadienses para medir la exposición a la radiación y entender mejor sus efectos en el cuerpo humano. | https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp |
| Why Do We Conduct Science Experiments in Space? | Explica por qué el entorno espacial permite experimentos imposibles en la Tierra y cómo la investigación en la Estación Espacial Internacional (ISS) mejora nuestro conocimiento de la salud humana, la tecnología y el universo. | https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp |

## Enlaces generales útiles

- Página del evento 2026: https://www.spaceappschallenge.org/2026/
- Lista de desafíos 2026: https://www.spaceappschallenge.org/2026/challenges/
- Eventos locales: https://www.spaceappschallenge.org/2026/local-events/
- Buscar equipo: https://www.spaceappschallenge.org/2026/find-a-team/
- Recursos generales: https://www.spaceappschallenge.org/resources/
- Preguntas frecuentes para participantes: https://www.spaceappschallenge.org/resources/participant-faqs/
- Agencias espaciales socias: https://www.spaceappschallenge.org/2026/space-agency-partners/
- Premios: https://www.spaceappschallenge.org/awards/
- Aviso legal: https://www.spaceappschallenge.org/legal/

## Checklist rápido para el equipo

- [ ] Elegir los indicadores de salud que se van a monitorear (presión arterial, frecuencia cardíaca, glucosa, temperatura, sueño, ánimo, etc.) y justificarlos con los peligros del HRP.
- [ ] Definir rangos normales, de alerta y críticos para cada indicador (con códigos de color).
- [ ] Definir cuándo se escala a la tripulación o a los médicos de vuelo en tierra.
- [ ] Diseñar la entrada de datos (formularios, clics, imágenes de cámara).
- [ ] Ofrecer recomendaciones o acciones preventivas y correctivas para cada estado.
- [ ] Hacer una UI visual e interactiva (por ejemplo, un mapa corporal clicable y gráficos históricos).
- [ ] (Opcional) Añadir recordatorios periódicos, gamificación y soporte para varios entornos (nave, estación, rover, base).
- [ ] Incluir explicaciones sencillas para usuarios no expertos.
