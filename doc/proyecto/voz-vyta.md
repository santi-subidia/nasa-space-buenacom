# Voz unificada de VYTA AI (Vega)

La card de Inicio y Salud conserva el diseño de Figma. Al tocarla pide acceso al micrófono, graba con `MediaRecorder` + `AudioContext` (compatible con Safari, Chrome, Edge y Firefox) y detecta 1,8 segundos de silencio después de una frase. Envía el audio a `/api/voz/transcribir` (Gemini) y luego consulta `/api/claude` con los datos reales del tripulante (`datosDelDia`), el contexto de pantalla, el historial reciente y las fichas/fuentes de la NASA, incluyendo detección local de urgencias (`detectarUrgencia` → aviso al oficial médico) y respaldo offline (`IA_APAGADA=1`).

La respuesta se reproduce automáticamente con la voz del navegador (`speechSynthesis`) en fragmentos cortos a velocidad 0,95. Se prioriza Elena en español argentino, luego otra voz argentina y finalmente una voz en español disponible en el dispositivo. El globo pulsa y brilla durante la reproducción y tiene una animación suave al pasar el mouse. Este mismo motor de voz alimenta también a `/vega` (conversación con citas y chequeo matutino por voz) y al Entrenador.

Configuración en `.env.local` en la raíz de VYTA:

```dotenv
GEMINI_API_KEY=tu_clave_gemini
GEMINI_TRANSCRIPTION_MODEL=gemini-3.5-flash-lite
ANTHROPIC_API_KEY=tu_clave_claude
```

Reiniciar `npm run dev` después de configurar las variables. Las claves se usan exclusivamente en el servidor.

La card no muestra un chat ni guarda historial en disco; conserva los últimos diez intercambios en memoria mientras está montada. El micrófono se libera al terminar de grabar, cancelar, salir de la página o cambiar de pestaña. Una nueva pulsación durante la respuesta la interrumpe e inicia otra escucha; durante la grabación permite enviarla manualmente.

## Cuando el tripulante se siente mal: triaje local con protocolos de la NASA

En una emergencia la fuente más rápida es la que ya está a bordo. Desde Base Marte, Houston tarda unos 30 minutos en responder: 14 de ida, 2 de evaluación y 14 de vuelta. Por eso **VYTA reconoce las señales rojas en el navegador, sin IA y sin red** (`ai/vega/protocolos.js`). Responde con los primeros pasos de la checklist médica de la ISS y avisa al oficial médico.

| Nivel | Qué hace VYTA | ¿Espera a Claude? |
|---|---|---|
| **Emergencia**: no responde o no respira, atragantamiento, alergia grave, no puede respirar, convulsión, tóxico o humo, posible ACV, sangrado abundante, autolesión | Lee los pasos del procedimiento de la ISS (1.101 a 1.108), muestra la cita y manda un aviso **crítico**. Deja claro que no hay que esperar a Houston | No |
| **Urgente**: dolor de pecho, desmayo, posible coágulo, dolor abdominal fuerte, fiebre alta, golpe en la cabeza, ojo, síntomas después de una EVA, no poder orinar, cálculo renal | Lee los primeros pasos y manda un aviso **alto**. Claude completa en paralelo | Sí, en paralelo |
| **Aviso**: náuseas o mareo, dolor de cabeza, congestión, espalda, fiebre leve | No alerta sola: responde Claude con la ficha y aparece el botón "Avisar al oficial". Sin red, responde el protocolo local | Sí |

- **"Me siento mal"** sin detalles: VYTA primero pregunta por las señales rojas (respirar, pecho, desmayo, sangrado). Un "sí" se trata como urgente.
- **"Avisá al oficial médico"** dicho en voz alta registra el aviso con lo que la persona contó y lo deja para la conferencia médica privada.
- VYTA **no dosifica medicamentos**: nombra el paquete del botiquín y qué medir. Las dosis son de la checklist y del cirujano de vuelo.
- La documentación está en [`doc/nasa/riesgos/operaciones/emergencias-medicas.md`](../nasa/riesgos/operaciones/emergencias-medicas.md) y las fuentes, en `doc/nasa/fuentes/06-operaciones-medicas/`.

La grabación está limitada a 60 segundos y 5 MB. Si no se detecta voz durante 15 segundos, se descarta sin enviarla. Hace falta HTTPS o localhost, un micrófono y un navegador con MediaRecorder, Web Audio y síntesis de voz.
