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

La grabación está limitada a 60 segundos y 5 MB. Si no se detecta voz durante 15 segundos, se descarta sin enviarla. Hace falta HTTPS o localhost, un micrófono y un navegador con MediaRecorder, Web Audio y síntesis de voz.
