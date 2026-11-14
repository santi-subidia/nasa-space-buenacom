# 🚀 Desafío NASA Space Apps 2026 · Software de monitoreo de salud para astronautas

La documentación está separada en dos bloques según **quién lo dice**:

| Carpeta | Qué contiene | Quién lo escribe |
|---|---|---|
| **[nasa/](nasa/README.md)** | Lo que dice la NASA: el enunciado del desafío, las páginas originales de nasa.gov y los resúmenes en español de esas páginas | La NASA (los resúmenes los redactamos nosotros, pero **no agregan nada propio**) |
| **[proyecto/](proyecto/README.md)** | Lo que decidimos y construimos: síntesis de indicadores, plan final, prototipo, trazabilidad y guion de demo | Nosotros |

**Regla práctica:** si es un dato sobre la salud en el espacio, vive en `nasa/`. Si es una decisión, un umbral que elegimos o algo de la app, vive en `proyecto/`.

## Cómo leer este árbol

1. Empieza por **[nasa/desafio](nasa/desafio/desafio.md)**: qué pide el desafío.
2. Entiende el **porqué** con **[nasa/peligros](nasa/peligros/README.md)** (los 5 peligros RIDGE) y **[nasa/riesgos](nasa/riesgos/README.md)** (la tabla maestra de riesgos).
3. Mira **qué mide la NASA hoy** en **[nasa/investigaciones](nasa/investigaciones/README.md)**.
4. Usa la **síntesis** de **[proyecto/sintesis](proyecto/sintesis/)** para decidir indicadores, reglas y UI.
5. Ejecuta con **[proyecto/plan](proyecto/plan/)**; las decisiones finales están en [plan-final.md](proyecto/plan/plan-final.md).
6. Si necesitas el texto original o los PDFs técnicos, ve a **[nasa/fuentes](nasa/fuentes/INDICE.md)**.

## Árbol

```
doc/
├─ README.md                          ← estás aquí
├─ nasa/                              ← DOCUMENTACIÓN DE LA NASA
│  ├─ README.md
│  ├─ desafio/
│  │  └─ desafio.md                   ← enunciado, objetivos, consideraciones, recursos
│  ├─ fuentes/                        ← 76 páginas ORIGINALES de nasa.gov (EN) + índice de PDFs
│  │  ├─ INDICE.md                    ← todas las URL + Evidence Reports + Risk Records + DAGs
│  │  ├─ 01-peligros/ (6)  02-riesgos/ (18)  03-investigaciones/ (22)
│  │  ├─ 04-articulos-profundizacion/ (15)
│  │  └─ 05-human-system-risk-board/ (31)
│  ├─ peligros/                       ← resumen en español de los 5 peligros (RIDGE)
│  │  ├─ README.md
│  │  ├─ radiacion.md                 (R)
│  │  ├─ aislamiento-confinamiento.md (I)
│  │  ├─ distancia-tierra.md          (D)
│  │  ├─ gravedad.md                  (G)
│  │  └─ entorno-hostil-cerrado.md    (E)
│  ├─ riesgos/                        ← resumen en español de los 17 riesgos del HRP + extras del HSRB
│  │  ├─ README.md                    ← TABLA MAESTRA de riesgos
│  │  ├─ fisiologia/   inmunidad · sensoriomotor-vestibular · cardiovascular · descompresion ·
│  │  │                microorganismos · hipoxia · nutricion · eva · capacidad-fisica · sans-ojos · hueso
│  │  ├─ conducta/     conducta-psiquiatria · trabajo-en-equipo · sueno-horarios ·
│  │  │                soporte-sistemas · cargas-dinamicas
│  │  └─ radiacion/    cancer-por-radiacion
│  └─ investigaciones/
│     └─ README.md                    ← Artemis II, ISS (CIPHER ×14…), pasadas (Tempus Pro…)
└─ proyecto/                          ← DOCUMENTACIÓN Y DECISIONES DEL PROYECTO
   ├─ README.md
   ├─ sintesis/                       ← de la NASA a nuestro diseño
   │  ├─ catalogo-indicadores.md      ← indicadores, unidades, umbrales 🟢🟡🔴, reglas compuestas
   │  ├─ matriz-peligro-riesgo-indicador.md ← base del MAPA CORPORAL clicable
   │  ├─ cabina-y-radiacion.md
   │  └─ ideas-ux-gamificacion.md
   ├─ voz-vyta.md                     ← voz de la card VYTA AI (Gemini, micrófono y respuesta hablada)
   └─ plan/
      ├─ plan-final.md                ← ⭐ DECISIONES FINALES: solo notebook, jornada, notificaciones, Claude Haiku 5.5, cámara, reparto
      ├─ plan-proyecto.md             ← problema, propuesta de valor, alcance MVP, cronograma de 48 h
      ├─ prototipo.md                 ← stack, modelo de datos, motor de reglas, pantallas, demo
      ├─ trazabilidad.md              ← funcionalidad ↔ desafío ↔ documentación NASA ↔ código, y huecos
      ├─ dispositivos-y-sensores.md   ← hardware disponible (iPhone, Android, Watch, AirPods, notebook) y qué medir
      └─ guion-demo.md                ← guion de la demo
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

Los resúmenes en español de `nasa/` condensan el contenido de la NASA. Los **umbrales clínicos** del catálogo (`proyecto/sintesis/`) son valores generales orientativos (no salen de las páginas de la NASA) y el prototipo es **educativo, no un dispositivo médico**.
