# Matriz peligro → riesgo → indicador → parte del cuerpo

> Sirve para construir el **mapa corporal clicable** que sugiere el desafío: cada zona del cuerpo muestra su función, sus riesgos y el estado de sus indicadores.

## Matriz

| Zona del cuerpo (mapa) | Función (texto educativo) | Riesgos | Peligros | Indicadores |
|---|---|---|---|---|
| 🧠 **Cerebro / mente** | Cognición, ánimo, sueño, orientación | Conducta/psiquiatría, sueño, SNC por radiación, hipoxia | I, R, E | Ánimo, estrés, sueño, tiempo de reacción, cefalea |
| 👁️ **Ojos** | Visión; el desplazamiento de fluidos los afecta | SANS, cataratas (radiación) | G, R | Agudeza visual, visión borrosa, OCT |
| 👂 **Oído interno** | Equilibrio y orientación | Sensoriomotor/vestibular, pérdida auditiva (acústica) | G, E | Escala de mareo, test de equilibrio, ruido en dB |
| 🫀 **Corazón y vasos** | Bombear sangre; se vuelve más esférico en 0 g | CV (ortostatismo, arritmia), TEV yugular | G, R | PA, FC, ritmo, cuello o brazo hinchado |
| 🫁 **Pulmones** | Oxigenación | Hipoxia, CO₂, polvo, capacidad aeróbica | E, G | SpO₂, frecuencia respiratoria, disnea |
| 🛡️ **Sistema inmune** (sangre, piel) | Defensa; latentes que se reactivan | Inmunidad alterada, microorganismos | E, R, I | Temperatura, erupción (foto), alergias, estrés |
| 🦴 **Huesos** (columna, cadera) | Soporte; −1–1,5 % al mes | Cambios óseos, fractura | G | Días en 0 g, ejercicio, calcio, densidad estimada |
| 💪 **Músculos** | Fuerza; −10–12 % | Capacidad musculoesquelética | G | Minutos de ejercicio, test de fuerza |
| 🫘 **Riñones** | Filtrar; el calcio forma cálculos | Cálculo renal, retención urinaria | G | Agua, diuresis, dolor en el flanco |
| 🍽️ **Sistema digestivo** | Nutrición, microbioma | Nutrición, microorganismos | D, E | kcal, masa, apetito, síntomas GI, aceptabilidad |
| 🧬 **ADN / células** | Integridad genética | Cáncer por radiación, telómeros | R | Dosis acumulada en mSv |
| 🧍 **Cuerpo entero** | Moverse y salir de la nave | Cargas dinámicas, EVA, descompresión | G, E | Checklist pre-EVA y pre-aterrizaje, dolor articular |

## Vista por peligro (para un filtro en la UI)

- **R:** ADN, ojos (cataratas), cerebro (SNC), corazón (degenerativo).
- **I:** cerebro (ánimo, sueño), equipo.
- **D:** todo, por la autonomía médica; digestivo (comida).
- **G:** huesos, músculos, ojos, oído interno, corazón, riñones.
- **E:** pulmones, sistema inmune, piel.
