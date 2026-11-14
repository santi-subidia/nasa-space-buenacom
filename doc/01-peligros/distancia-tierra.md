# D · Distancia a la Tierra

> Fuentes: [hazard-distance-from-earth](../fuentes/01-peligros/hazard-distance-from-earth.md), [communicating-with-missions](../fuentes/04-articulos-profundizacion/communicating-with-missions.md), [houston-do-you-copy (HERA)](../fuentes/04-articulos-profundizacion/houston-do-you-copy-hera-crew-navigates-communication-delays.md), [menu-for-mars](../fuentes/04-articulos-profundizacion/the-menu-for-mars-designing-a-deep-space-food-system.md)

## Datos clave

- Marte está, de media, a **225 millones de km** (140 millones de millas). La misión duraría **unos 3 años** en total, frente a los ~3 días que se tarda en llegar a la Luna.
- **Retraso de comunicación de hasta 20 minutos por trayecto**, es decir, hasta 40 min ida y vuelta. Hay periodos sin comunicación posible.
- Los ensayos en HERA usan **retrasos de hasta 5 minutos por trayecto**.
- No hay reabastecimiento: comida, fármacos y repuestos hay que **racionarlos**.

## Consecuencias

- **Autosuficiencia:** la tripulación debe gestionar fallos de equipos y **emergencias médicas** con poco apoyo de tierra.
- Ver los riesgos [Soporte inadecuado de sistemas y operaciones](../02-riesgos/conducta/soporte-sistemas.md), la [nutrición](../02-riesgos/fisiologia/nutricion.md) y, en el HSRB, **"Earth Independent Human-Systems Operations (EIHSO)"** y **"Inflight Medical Conditions"** ([fuentes/05](../fuentes/05-human-system-risk-board/)).
- La NASA investiga un **Medical Decision Support System** (proyecto AMO) para ampliar la capacidad médica de la tripulación cuando no hay contacto directo con la Tierra. **Nuestra app es una versión ligera de eso.**

## 💡 Qué puede hacer nuestra app

- **Funcionar sin conexión** y localmente (*offline-first*). Los datos se sincronizan con los médicos de vuelo cuando hay enlace.
- **Mensajería asíncrona con los médicos de vuelo**, con un indicador del retraso actual ("tu mensaje llega en 12 min").
- **Guías paso a paso** para hacer mediciones y responder a alertas, sin suponer que el astronauta es médico.
- **Árbol de decisión**: puedo resolverlo yo, aviso al oficial médico de la tripulación o escalo a tierra.
- Control de **inventario** del botiquín y de la comida (calorías por día).
