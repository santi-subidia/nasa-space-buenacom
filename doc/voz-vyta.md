# Voz de la card VYTA AI

La card conserva el diseño de Figma. Al tocarla pide acceso al micrófono, graba y detecta 1,8 segundos de silencio después de una frase. Envía el audio a Gemini para transcribirlo y responder, usando la configuración de `D:\Proyectos\chatbot-con-voz`.

La respuesta se reproduce automáticamente con la voz del navegador, a velocidad 0,95. Se prioriza Elena en español argentino, luego otra voz argentina y finalmente una voz en español disponible en el dispositivo. El globo pulsa y brilla durante la reproducción y tiene una animación suave al pasar el mouse.

Configuración en `.env.local` en la raíz de VYTA:

```dotenv
GEMINI_API_KEY=tu_clave
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_TRANSCRIPTION_MODEL=gemini-3.5-flash-lite
```

Reiniciar `npm run dev` después de configurar las variables. Las claves se usan exclusivamente en el servidor.

No se muestra un chat ni se guarda el historial en disco. Se conservan los últimos diez intercambios en memoria mientras la card esté montada. El micrófono se libera al terminar de grabar, cancelar, salir de la página o cambiar de pestaña. Una nueva pulsación durante la respuesta la interrumpe e inicia otra escucha; durante la grabación permite enviarla manualmente.

La grabación está limitada a 60 segundos y 5 MB. Si no se detecta voz durante 15 segundos, se descarta sin enviarla. Hace falta HTTPS o localhost, un micrófono y un navegador con MediaRecorder, Web Audio y síntesis de voz.
