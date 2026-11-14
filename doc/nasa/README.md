# NASA · documentación de referencia

Todo lo que hay aquí viene de la NASA o resume a la NASA. **No contiene decisiones del proyecto.** Si cambia algo del diseño de la app, va en [`../proyecto/`](../proyecto/README.md).

| Carpeta | Contenido | Estado |
|---|---|---|
| [desafio/](desafio/desafio.md) | Enunciado del desafío *Create Health Monitoring Software for Astronauts on Space Missions* (Space Apps 2026) | Traducción del original |
| [fuentes/](fuentes/INDICE.md) | 76 páginas originales de nasa.gov en inglés, más el índice de URL, Evidence Reports, Risk Records y DAGs | **Texto original, no se edita** |
| [peligros/](peligros/README.md) | Los 5 peligros del HRP (RIDGE) resumidos en español | Resumen fiel de `fuentes/01-peligros` |
| [riesgos/](riesgos/README.md) | Los 17 riesgos del HRP y extras del HSRB en fichas en español | Resumen fiel de `fuentes/02-riesgos` y `fuentes/05-human-system-risk-board` |
| [investigaciones/](investigaciones/README.md) | Qué mide la NASA hoy (Artemis II, ISS, estudios pasados) | Resumen fiel de `fuentes/03-investigaciones` |

## Reglas de esta carpeta

- Las fichas de `riesgos/` empiezan con una línea `> Fuentes: …` que enlaza al original en `fuentes/`. El índice de IA (`ai/fichas/indice.generado.json`) se genera leyendo esa línea, así que **no la quites ni cambies su formato**.
- Si una cifra no sale de la NASA (un umbral clínico, una regla de la app), **no va aquí**: va en `proyecto/sintesis/` y se marca como criterio propio.
- Para regenerar el índice tras editar las fichas: `npm run indice` dentro de `ai/`.
