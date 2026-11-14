# Riesgo de hipoxia (*Hypoxia*)

> Fuentes: [HRP](../../fuentes/02-riesgos/risk-of-hypoxia.md) · [HSRB](../../fuentes/05-human-system-risk-board/risk-of-reduced-crew-health-and-performance-due-to-hypoxia.md)
> **Peligro:** E (atmósfera de cabina)

## Qué pasa

- Para hacer EVA frecuentes sin horas de prerrespiración, las naves de espacio profundo vivirán en **despresurización parcial constante** de la cabina.
- Eso reduce el nitrógeno corporal, pero aumenta el riesgo de **hipoxia leve**: oxígeno bajo en los tejidos.
- **Síntomas si no se trata:**
  - **confusión**
  - **dolor de cabeza**
  - **problemas de visión**
  - **dificultad para dormir**
- La NASA lo considera un **riesgo relativamente bajo**, parecido al **mal de altura** al llegar a una ciudad de montaña. Pero se suma a todos los demás factores de estrés.

## Investigación

- Protocolos que equilibren la concentración de O₂ y la presión.
- Trajes con presión ajustable.
- Cámaras de presión con voluntarios.
- Datos históricos de EVA.
- **Nuevos protocolos de monitoreo** en las operaciones médicas, que es justo el terreno de nuestra app.

## Indicadores para la app

| Indicador | Cómo medir | Notas |
|---|---|---|
| **SpO₂ (%)** | Oxímetro de pulso | Una caída sostenida frente a la línea base personal → alerta |
| Síntomas: cefalea, confusión, visión, sueño | Checklist | Cruzar con SpO₂ y con el O₂/presión de la cabina |
| O₂ de cabina (%) y presión (kPa/psi) | Sensor (simulado) | Contexto |
