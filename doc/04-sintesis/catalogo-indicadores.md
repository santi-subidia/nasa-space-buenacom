# Catálogo de indicadores de salud para la app

> Une los indicadores que pide el desafío (**presión arterial, frecuencia cardíaca, glucosa, temperatura, horas de sueño y ánimo**) con lo que mide la NASA (carpetas 02 y 03).
>
> ⚠️ **Los rangos de referencia son valores clínicos generales para adultos sanos, de conocimiento médico común. No salen de las páginas de la NASA extraídas.** Úsalos en el prototipo como **valores por defecto configurables** y combínalos con la **línea base personal** previa al vuelo. No son consejo médico.

## Semáforo general

- 🟢 **Normal:** dentro del rango y sin cambios relevantes respecto a la línea base.
- 🟡 **Atención:** fuera del rango leve, o una tendencia desfavorable. La app da consejo de **autocuidado**.
- 🟠 **Avisar a la tripulación:** persiste o hay varios indicadores alterados. Se notifica al **oficial médico de la tripulación** (*Crew Medical Officer*).
- 🔴 **Escalar a los médicos de vuelo** (o emergencia): valor crítico o síntoma de alarma.

## Tier 1 · Indicadores del MVP (pedidos por el desafío)

| Indicador | Unidad | Entrada | Frecuencia | 🟢 | 🟡 | 🔴 (orientativo) | Riesgos NASA |
|---|---|---|---|---|---|---|---|
| Presión arterial | mmHg | Teclado / BLE | Diaria (mañana) | 90–129 / 60–84 | 130–139 / 85–89, o < 90/60 sin síntomas | ≥ 180/120, o < 90/60 **con mareo/síncope** | [CV](../02-riesgos/fisiologia/cardiovascular.md) |
| Frecuencia cardíaca en reposo | lpm | Teclado / *wearable* | Diaria | 50–90 (o base ± 10) | 91–100, o +10 sobre la base | > 120 o < 40 en reposo, o ritmo irregular | CV, capacidad física, inmunidad |
| Glucosa en sangre | mg/dL | Glucómetro | Semanal o según protocolo | 70–99 en ayunas | 100–125 en ayunas | < 70 (o < 54 grave), o > 250 | [Nutrición](../02-riesgos/fisiologia/nutricion.md) |
| Temperatura corporal | °C | Termómetro | Diaria | 36,1–37,2 | 37,3–37,9 | ≥ 38,0, o < 35 | [Inmunidad](../02-riesgos/fisiologia/inmunidad.md) |
| Horas de sueño | h | Manual / actigrafía | Diaria | 7–9 | 6–7 | < 5, o < 6 durante 3 noches | [Sueño](../02-riesgos/conducta/sueno-horarios.md) |
| Ánimo | escala 1–5 | Emojis | Diaria | 4–5 | 3, o tendencia negativa | ≤ 2 durante 3 días, o ideas de autolesión → contacto inmediato | [Conducta](../02-riesgos/conducta/conducta-psiquiatria.md) |

## Tier 2 · Indicadores que nos diferencian

| Indicador | Unidad | Entrada | Por qué (NASA) |
|---|---|---|---|
| SpO₂ | % | Oxímetro | [Hipoxia](../02-riesgos/fisiologia/hipoxia.md) con la cabina despresurizada (🔴 < 90 %) |
| Ejercicio | min/día, tipo | Registro | 1,5 h al día, 6–7 días por semana; [capacidad física](../02-riesgos/fisiologia/capacidad-fisica.md) y [hueso](../02-riesgos/fisiologia/hueso.md) |
| Agua | ml/día | Registro | Cálculos renales y presión baja al aterrizar |
| Ingesta y masa corporal | kcal, kg | Registro | Fatiga de menú y pérdida de masa |
| Estrés / fatiga | 1–10 | Escala | Inmunidad y conducta |
| Agudeza visual | test | **Minitest en pantalla** | [SANS](../02-riesgos/fisiologia/sans-ojos.md) (~70 % de afectados) |
| Tiempo de reacción | ms | **Minijuego tipo PVT** | Sueño, radiación en el SNC, cognición |
| Síntomas | checklist | Clics en el **mapa corporal** | Todos |
| Foto de la piel o lesión | imagen | **Cámara** | Inmunidad (erupción, herpes) |
| Dosis de radiación | mSv | Dosímetro (simulado) | [Cáncer](../02-riesgos/radiacion/cancer-por-radiacion.md), SNC |
| CO₂ / O₂ / ruido de cabina | ppm, %, dB | Sensor (simulado) | Riesgos HSRB de CO₂, acústica e hipoxia |

## Tier 3 · Opcionales o futuros

- ECG de 1 derivación (fibrilación auricular).
- **Ecografía guiada** (sube la imagen y la revisa un médico; trombo yugular, corazón).
- Imagen **OCT** o de fondo de ojo.
- Muestras de saliva, sangre u orina (recordatorio y seguimiento de la cadena de custodia).
- Encuesta de **cohesión del equipo**.
- **Aceptabilidad de la comida** (escala hedónica de 1 a 9).

## Reglas compuestas (ejemplos que dan valor clínico)

| Patrón | Interpretación | Acción |
|---|---|---|
| Sueño < 6 h × 3 + estrés ≥ 7 + erupción o herpes labial | Posible **reactivación viral** por estrés | 🟠 Avisar al oficial médico, higiene, descanso |
| PA en descenso + FC en ascenso + < 1,5 L de agua, días antes del aterrizaje | Riesgo de **intolerancia ortostática** | 🟡 Hidratación + prenda de compresión |
| Hinchazón o dolor en un lado del cuello o en un brazo | Posible **trombo yugular** (55 % con flujo anómalo) | 🔴 Escalar + ecografía guiada |
| Cefalea + SpO₂ < 94 % + CO₂ de cabina alto | **Hipoxia o CO₂** | 🟠 Revisar el ambiente, reposo |
| Visión borrosa + agudeza peor que la base | **SANS** | 🟠 Programar OCT |
| Ejercicio < 50 % del plan × 7 días | Más pérdida ósea y muscular | 🟡 Recordatorio + gamificación |
| Ánimo ≤ 2 × 3 días | Riesgo conductual | 🟠 Autocuidado + contacto confidencial |
| Dolor en el flanco + poca agua | Posible **cálculo renal** (no se puede tratar en exploración) | 🔴 Escalar |

## Ajustes por entorno

| Entorno | Particularidades |
|---|---|
| Nave en tránsito (0 g) | Hueso, músculo, SANS y fluidos. Sin báscula: masa con dispositivo inercial |
| Estación (ISS o Gateway) | Igual + 16 amaneceres al día (circadiano). Comunicación ~inmediata (ISS) |
| Rover / EVA lunar | Descompresión, hipoxia, fatiga en el traje, polvo |
| Base en Marte (3/8 g) | **Retraso de hasta 20 min**, autonomía, sol de 24 h 37 min, salida sin apoyo tras aterrizar |
