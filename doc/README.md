# 🚀 Desafío NASA Space Apps 2026 · Software de monitoreo de salud para astronautas

Base de conocimiento extraída de los recursos oficiales del desafío y de la NASA (HRP), organizada para **diseñar el plan y el prototipo**.

## Cómo leer este árbol

1. Empieza por **[00-desafio](00-desafio/desafio.md)**: qué pide el desafío.
2. Entiende el **porqué** con **[01-peligros](01-peligros/README.md)** (los 5 peligros RIDGE) y **[02-riesgos](02-riesgos/README.md)** (la tabla maestra de riesgos).
3. Mira **qué mide la NASA hoy** en **[03-investigaciones](03-investigaciones/README.md)**.
4. Usa la **síntesis** de **[04-sintesis](04-sintesis/)** para decidir indicadores, reglas y UI.
5. Ejecuta con **[05-plan](05-plan/)**.
6. Si necesitas el texto original o los PDFs técnicos, ve a **[fuentes](fuentes/INDICE.md)**.

## Árbol

```
desafio-health-monitoring/
├─ README.md                          ← estás aquí
├─ 00-desafio/
│  └─ desafio.md                      ← enunciado, objetivos, consideraciones, recursos
├─ 01-peligros/                       ← los 5 peligros (RIDGE)
│  ├─ README.md
│  ├─ radiacion.md                    (R)
│  ├─ aislamiento-confinamiento.md    (I)
│  ├─ distancia-tierra.md             (D)
│  ├─ gravedad.md                     (G)
│  └─ entorno-hostil-cerrado.md       (E)
├─ 02-riesgos/                        ← 17 riesgos del HRP + extras del HSRB
│  ├─ README.md                       ← TABLA MAESTRA + prioridad para la app
│  ├─ fisiologia/   inmunidad · sensoriomotor-vestibular · cardiovascular · descompresion ·
│  │                microorganismos · hipoxia · nutricion · eva · capacidad-fisica · sans-ojos · hueso
│  ├─ conducta/     conducta-psiquiatria · trabajo-en-equipo · sueno-horarios ·
│  │                soporte-sistemas · cargas-dinamicas
│  └─ radiacion/    cancer-por-radiacion
├─ 03-investigaciones/
│  └─ README.md                       ← Artemis II, ISS (CIPHER ×14…), pasadas (Tempus Pro…)
├─ 04-sintesis/
│  ├─ catalogo-indicadores.md         ← indicadores, unidades, umbrales 🟢🟡🔴, reglas compuestas
│  ├─ matriz-peligro-riesgo-indicador.md ← base del MAPA CORPORAL clicable
│  └─ ideas-ux-gamificacion.md
├─ 05-plan/
│  ├─ plan-proyecto.md                ← problema, propuesta de valor, alcance MVP, cronograma de 48 h
│  └─ prototipo.md                    ← stack, modelo de datos, motor de reglas, pantallas, demo
└─ fuentes/                           ← 76 páginas originales de nasa.gov (EN) + índice de PDFs
   ├─ INDICE.md                       ← todas las URL + Evidence Reports + Risk Records + DAGs
   ├─ 01-peligros/ (6)  02-riesgos/ (18)  03-investigaciones/ (22)
   ├─ 04-articulos-profundizacion/ (15)
   └─ 05-human-system-risk-board/ (31)
```

## Los 10 datos más útiles para el pitch

1. **Retraso de comunicación de hasta 20 min por trayecto** con Marte, en una misión de unos 3 años: hace falta autonomía médica.
2. **Pérdida ósea de 1–1,5 % al mes** en microgravedad.
3. **Pérdida de fuerza y capacidad aeróbica del 10–12 %**. Entre el 12 % y el 38 % de los tripulantes pierde más del 20 %.
4. **Alrededor del 70 %** de los astronautas de la ISS tiene edema en el fondo del ojo (SANS).
5. **55 % (6 de 11)** tenía flujo anómalo en la vena yugular hacia el día 50, y **1 tuvo un trombo** tratado en vuelo.
6. **La mayoría** sufre mareo espacial, y marearse en la Tierra no lo predice.
7. **16 amaneceres al día** en la ISS y un día marciano de **24 h 37 min**.
8. Ejercicio de **1,5 h al día, 6–7 días por semana** en la ISS.
9. La NASA reconoce que **no hay contramedidas conductuales validadas** para misiones de exploración.
10. La NASA investiga un **sistema de apoyo a la decisión médica** (AMO) y prueba **Tempus Pro** (telemedicina). **Nuestra app encaja justo ahí.**

## Aviso

Las síntesis en español resumen el contenido de la NASA. Los **umbrales clínicos** del catálogo son valores generales orientativos (no salen de las páginas de la NASA) y el prototipo es **educativo, no un dispositivo médico**.
