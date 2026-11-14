# Proyecto · documentación y decisiones

Todo lo que hay aquí lo decidimos o lo escribimos nosotros a partir de lo que dice la NASA. Los datos de origen están en [`../nasa/`](../nasa/README.md).

| Carpeta | Contenido |
|---|---|
| [sintesis/](sintesis/) | De la NASA a nuestro diseño: [catálogo de indicadores](sintesis/catalogo-indicadores.md) (umbrales 🟢🟡🔴 y reglas compuestas), [matriz peligro → riesgo → indicador](sintesis/matriz-peligro-riesgo-indicador.md) (base del mapa corporal), [cabina y radiación](sintesis/cabina-y-radiacion.md) e [ideas de UX y gamificación](sintesis/ideas-ux-gamificacion.md) |
| [voz-vyta.md](voz-vyta.md) | Cómo funciona la voz de la card VYTA AI (micrófono, Gemini y respuesta hablada) |
| [plan/](plan/) | Plan y decisiones: [plan-final.md](plan/plan-final.md) (**decisiones finales**), [plan-proyecto.md](plan/plan-proyecto.md), [prototipo.md](plan/prototipo.md), [trazabilidad.md](plan/trazabilidad.md), [dispositivos-y-sensores.md](plan/dispositivos-y-sensores.md) y [guion-demo.md](plan/guion-demo.md) |

## Reglas de esta carpeta

- Las **decisiones** viven en `plan/plan-final.md`. Si una decisión cambia, se corrige ahí y se anota en `plan/trazabilidad.md`.
- Los **umbrales clínicos** del catálogo son criterio del proyecto (valores generales orientativos), no datos de la NASA. El prototipo es educativo, no un dispositivo médico.
- El código cita estas rutas en comentarios y en `lib/motor/rules.json`; si mueves o renombras un archivo, busca `doc/proyecto/` en el repo.
