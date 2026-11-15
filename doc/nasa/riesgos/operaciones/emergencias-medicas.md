# Emergencias y condiciones médicas en vuelo (*Inflight Medical Conditions*)

> Fuentes: [Manual de emergencias de la ISS](../../fuentes/06-operaciones-medicas/iss-emergency-medical-procedures.md) · [OCHMO-TB-033 Medical Care](../../fuentes/06-operaciones-medicas/spaceflight-experience-and-medical-care.md) · [EIMO ConOps](../../fuentes/06-operaciones-medicas/eimo-concept-of-operations.md) · [HSRB Inflight Medical Conditions](../../fuentes/05-human-system-risk-board/risk-of-adverse-health-outcomes-and-decrements-in-performance-due-to-inflight-medical-conditions.md)
> **Peligros:** D (distancia de la Tierra), E (entorno hostil y cerrado), G (microgravedad)

## Qué hace hoy la NASA cuando alguien se siente mal

- **Todos** reciben formación médica básica. En la ISS, de 6 tripulantes, **4 son oficiales médicos de tripulación (CMO)**, con unas **25 horas** de entrenamiento y formación casi siempre técnica, no médica.
- El CMO trabaja con la **checklist médica de la ISS** (pasos dirigidos, uno por uno) y con el **equipo médico de Tierra**.
- El paso que se repite en todos los procedimientos es *«Call MCC-H to request PMC»*: llamar a Control de Misión en Houston y pedir una **conferencia médica privada (PMC)** con el **cirujano de vuelo**.
  - Las PMC también son **rutinarias** (semanales) y protegidas por la ley de privacidad.
- Botiquín: **paquete rojo** de emergencia (epinefrina, material de vía aérea e intraósea), **DEA** (desfibrilador), **paquete respiratorio** (oxígeno y bolsa AMBU), **paquete azul** de diagnóstico (tensiómetro, oxímetro, estetoscopio) y el **sistema de sujeción médica** (*Crew Medical Restraint System*) para atender en ingravidez.
- Antecedentes reales:
  - **Trombo en la yugular** (2020): se detectó por ecografía en vuelo y se trató a distancia, guiado desde Tierra.
  - **Crew-11** (enero de 2026): primera evacuación médica de la ISS; la persona estaba **estable** y la vuelta no fue de emergencia.

## Por qué en Marte cambia todo

- En la ISS hay **comunicación en tiempo real** y la **evacuación es posible**.
- Hacia Marte no hay ninguna de las dos: la demora llega a **más de 20 minutos por tramo**, hay apagones y no hay reabastecimiento.
- La NASA plantea las **operaciones médicas independientes de la Tierra (EIMO)**:
  - pasar de a poco la decisión médica a la nave;
  - usar un **sistema de apoyo a la decisión clínica a bordo**, con IA y lenguaje natural, y entrenamiento "justo a tiempo".
- Ante una **emergencia aguda**, la latencia y el poco ancho de banda obligan a que la **primera respuesta** salga de a bordo.

## Contramedidas

- **Selección** estricta: no vuela quien tenga un riesgo importante de enfermedad grave. Por eso infarto, arritmias graves, convulsiones y ACV son **poco probables**, aunque no imposibles.
- **Programa de estabilización de salud** antes del vuelo (cuarentena) contra infecciones.
- Botiquín diseñado a partir de un **análisis probabilístico de riesgo** (*Integrated Medical Model*).
- **Conocimiento aumentado** a bordo: checklist, dispositivos inteligentes, terapia por computadora y entrenamiento "justo a tiempo". **Ese es el papel de VYTA.**

## Triaje de VYTA: aviso, urgencia o emergencia

| Nivel | Cuándo | Qué hace la tripulación | Ejemplos (procedimiento de la ISS) |
|---|---|---|---|
| 🔴 **Emergencia** | Hay riesgo para la vida y se actúa en segundos | **Actuar ya**, con la checklist y con otro compañero. **No esperar a Tierra.** El aviso al cirujano sale en paralelo | No responde o no respira (1.102 RCP + DEA), atragantamiento (1.105), reacción alérgica grave (1.101), no puede respirar (1.108), convulsión (1.107), exposición tóxica o humo (1.106), riesgo de autolesión |
| 🟠 **Urgente** | Puede agravarse en minutos u horas | El **CMO evalúa ahora**: signos vitales y oxímetro. Se pide **PMC prioritaria** | Dolor de pecho, desmayo, cuello o brazo hinchado (trombo), dolor de barriga fuerte, sangrado, fiebre alta, golpe en la cabeza, producto químico en el ojo, pérdida brusca de visión, síntomas después de una EVA, no poder orinar |
| 🟡 **Aviso** | Molestia esperable en vuelo | Se **registra** y se informa al cirujano en la **próxima PMC**. Se aplican medidas simples | Náuseas o mareo de adaptación (50-70 %), congestión (más del 50 %), dolor de espalda (52 %), dolor de cabeza (revisar el CO₂), mal sueño, ánimo bajo |

- Ante un "me siento mal" sin detalles, VYTA **primero pregunta por las señales rojas** (respirar, pecho, desmayo, sangrado) antes de dar consejos.
- VYTA **no receta ni dosifica**: las dosis las fijan la checklist y el cirujano de vuelo. VYTA solo recuerda los **primeros pasos**, qué paquete del botiquín abrir y a quién avisar.

## Indicadores para la app

| Indicador | Cómo medir | Frecuencia | Notas |
|---|---|---|---|
| Nivel de triaje | Frase del tripulante → reglas locales de VYTA (sin red) | En cada consulta | Emergencia y urgencia avisan al oficial médico al instante |
| SpO₂ y frecuencia cardíaca | Oxímetro del paquete azul | Ante cualquier síntoma urgente | Son los primeros datos que pide la checklist para el cirujano |
| Frecuencia respiratoria | Contar 15 segundos y multiplicar por 4 | Ante dificultad para respirar | Alarma: menos de 12 o más de 30 por minuto |
| Tiempo hasta Tierra | Demora del enlace (ida y vuelta) | Continuo | Define si se espera la PMC o se actúa a bordo |
