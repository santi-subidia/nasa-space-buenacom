import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearDetectorFinDeFrase, elegirVozVyta, fragmentosParaVoz } from '../ai/voz/audio.js';
import { crearRutasVoz } from '../ai/voz/servidor.js';
import { crearVoz } from '../ai/vega/voz.js';
import { crearSesionVega } from '../ai/vega/sesion.js';

const pausa = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

function navegadorDePrueba({
  pedirMicrofono,
  formato = 'audio/mp4',
  transcripcion = '¿Cómo puedo descansar mejor?',
  respuestaClaude = 'Podemos pensar juntos una rutina de descanso.',
  alAvisarOficial = () => {},
} = {}) {
  let reloj = 0;
  let rms = 0;
  let intervalo;
  let accesosMicrofono = 0;
  let tracksDetenidos = 0;
  let contextosCerrados = 0;
  let cancelacionesVoz = 0;
  const solicitudes = [];
  const discursos = [];
  const stream = { getTracks: () => [{ stop: () => tracksDetenidos++ }] };

  class Recorder {
    static isTypeSupported(tipo) { return tipo === formato; }
    constructor(_stream, opciones) { this.mimeType = opciones.mimeType; this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['audio de prueba']) });
      queueMicrotask(() => this.onstop?.());
    }
  }
  class Contexto {
    async resume() {}
    createAnalyser() { return { fftSize: 2048, getFloatTimeDomainData: (datos) => datos.fill(rms) }; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    async close() { contextosCerrados++; }
  }

  const ventana = {
    isSecureContext: true,
    navigator: { mediaDevices: { getUserMedia: pedirMicrofono || (async () => { accesosMicrofono++; return stream; }) } },
    MediaRecorder: Recorder,
    AudioContext: Contexto,
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: {
      getVoices: () => [{ name: 'Microsoft Elena', lang: 'es-AR' }],
      speak: (speech) => {
        discursos.push(speech);
        speech.onstart?.();
      },
      cancel: () => cancelacionesVoz++,
    },
  };

  let sesion;
  const voz = crearVoz({
    ventana,
    ahora: () => reloj,
    cada: (fn) => { intervalo = fn; return 1; },
    limpiar: () => { intervalo = null; },
    alCambiar: (fase) => sesion?.ponerFaseVoz(fase),
    fetchFn: async (url, opciones) => {
      solicitudes.push({ url, opciones, tracksDetenidos });
      if (url.includes('transcribir')) {
        const text = typeof transcripcion === 'function' ? transcripcion() : transcripcion;
        return Response.json({ text });
      }
      const reply = typeof respuestaClaude === 'function' ? respuestaClaude(JSON.parse(opciones.body)) : respuestaClaude;
      return Response.json({ ok: true, origen: 'claude', texto: reply, textoVoz: reply, citasUsadas: [] });
    },
  });

  sesion = crearSesionVega({
    voz,
    alAvisarOficial,
    obtenerDatosDelDia: () => ({ tripulante: 'Ana Ríos', sol: 42, indicadores: { Sueño: '5.3 h' } }),
    obtenerContextoPantalla: () => 'Sección: mental. Resumen visible: Sueño bajo esta semana.',
    fetchFn: async (url, opciones) => {
      solicitudes.push({ url, opciones, tracksDetenidos });
      const reply = typeof respuestaClaude === 'function' ? respuestaClaude(JSON.parse(opciones.body)) : respuestaClaude;
      return Response.json({ ok: true, origen: 'claude', texto: reply, textoVoz: reply, citasUsadas: [] });
    },
  });

  return {
    sesion, solicitudes, discursos, stream,
    tick(ms, nivel = 0) { reloj += ms; rms = nivel; intervalo?.(); },
    contadores: () => ({ accesosMicrofono, tracksDetenidos, contextosCerrados, cancelacionesVoz }),
  };
}

test('VYTA detecta fin de frase por silencio y no manda una grabación sin voz', () => {
  const detectar = crearDetectorFinDeFrase(0);
  for (let t = 50; t <= 250; t += 50) assert.equal(detectar(0.1, t).terminar, false);
  assert.equal(detectar(0, 2000).terminar, false);
  assert.deepEqual(detectar(0, 2050), { terminar: true, enviar: true });
  const silencio = crearDetectorFinDeFrase(0);
  assert.deepEqual(silencio(0, 15000), { terminar: true, enviar: false });
  const ruidoCorto = crearDetectorFinDeFrase(0);
  ruidoCorto(0.2, 50);
  assert.deepEqual(ruidoCorto(0, 15000), { terminar: true, enviar: false });
});

test('VYTA elige voz argentina y fragmenta respuestas largas sin perder palabras', () => {
  const voces = [{ name: 'English', lang: 'en-US' }, { name: 'Español', lang: 'es-ES' }, { name: 'Microsoft Elena', lang: 'es-AR' }];
  assert.equal(elegirVozVyta(voces).name, 'Microsoft Elena');
  const texto = 'Podemos conversar con calma. '.repeat(30).trim();
  const partes = fragmentosParaVoz(texto);
  assert.ok(partes.every((p) => p.length <= 180));
  assert.equal(partes.join(' '), texto);
});

test('flujo unificado (Safari audio/mp4): graba, transcribe con Gemini, consulta /api/claude con datos del día e historial y reproduce voz', async () => {
  let turnoTexto = '¿Cómo puedo descansar mejor?';
  const prueba = navegadorDePrueba({ formato: 'audio/mp4', transcripcion: () => turnoTexto });
  const fases = [];
  prueba.sesion.suscribir(() => {
    const f = prueba.sesion.obtener().fase;
    if (fases.at(-1) !== f) fases.push(f);
  });

  const turno1 = prueba.sesion.tocar();
  await pausa();
  assert.equal(prueba.sesion.obtener().fase, 'escuchando');
  for (let i = 0; i < 4; i++) prueba.tick(50, 0.1);
  prueba.tick(1800, 0);
  await pausa();

  assert.equal(prueba.solicitudes.length, 2);
  assert.ok(prueba.solicitudes[0].tracksDetenidos > 0, 'el micrófono se libera antes de enviar el audio');
  assert.equal(prueba.solicitudes[0].url, '/api/voz/transcribir');
  assert.equal(prueba.solicitudes[0].opciones.body.type, 'audio/mp4');

  const body1 = JSON.parse(prueba.solicitudes[1].opciones.body);
  assert.equal(prueba.solicitudes[1].url, '/api/claude');
  assert.equal(body1.tipo, 'answer');
  assert.equal(body1.pregunta, '¿Cómo puedo descansar mejor?');
  assert.equal(body1.datosDelDia.sol, 42);
  assert.match(body1.contextoPantalla, /Sección: mental/);
  assert.equal(body1.historial, undefined);

  assert.equal(prueba.sesion.obtener().fase, 'hablando');
  assert.equal(prueba.discursos[0].voice.name, 'Microsoft Elena');
  assert.equal(prueba.discursos[0].rate, 0.95);
  prueba.discursos[0].onend();
  await turno1;
  assert.equal(prueba.sesion.obtener().fase, 'inactivo');
  assert.ok(fases.includes('solicitando'));
  assert.ok(fases.includes('transcribiendo'));
  assert.ok(fases.includes('pensando'));
  assert.equal(prueba.contadores().contextosCerrados, 1);

  // Segundo turno: envía historial de la conversación previa.
  turnoTexto = '¿Y qué rutina recomendás?';
  const turno2 = prueba.sesion.tocar();
  await pausa();
  for (let i = 0; i < 4; i++) prueba.tick(50, 0.1);
  prueba.tick(1800, 0);
  await pausa();
  const body2 = JSON.parse(prueba.solicitudes[3].opciones.body);
  assert.deepEqual(body2.historial, [
    { role: 'user', text: '¿Cómo puedo descansar mejor?' },
    { role: 'assistant', text: 'Podemos pensar juntos una rutina de descanso.' },
  ]);
  prueba.discursos[1].onend();
  await turno2;
});

test('el silencio inicial se descarta y cancelar al pedir permiso libera un micrófono que llega tarde', async () => {
  const prueba = navegadorDePrueba();
  const turno = prueba.sesion.tocar();
  await pausa();
  prueba.tick(15000, 0);
  await turno;
  assert.equal(prueba.solicitudes.length, 0);
  assert.match(prueba.sesion.obtener().error, /No se escuchó/);

  let resolver;
  let detenidos = 0;
  const tarde = navegadorDePrueba({ pedirMicrofono: () => new Promise((resolve) => { resolver = resolve; }) });
  const pendiente = tarde.sesion.tocar();
  tarde.sesion.cancelar();
  resolver({ getTracks: () => [{ stop: () => detenidos++ }] });
  await pendiente;
  assert.equal(detenidos, 1);
  assert.equal(tarde.solicitudes.length, 0);
  assert.equal(tarde.sesion.obtener().fase, 'inactivo');
});

test('cancelar una respuesta hablada detiene el audio y una señal roja dispara aviso al oficial médico', async () => {
  const prueba = navegadorDePrueba();
  const turno = prueba.sesion.tocar();
  await pausa();
  prueba.sesion.terminarEscucha();
  await pausa();
  assert.equal(prueba.sesion.obtener().fase, 'hablando');
  prueba.sesion.cancelar();
  await turno;
  assert.equal(prueba.contadores().cancelacionesVoz, 1);
  assert.equal(prueba.sesion.obtener().fase, 'inactivo');
  assert.equal(prueba.sesion.obtener().error, '');

  const avisos = [];
  const urgente = navegadorDePrueba({
    transcripcion: 'tengo dolor en el pecho',
    alAvisarOficial: (a) => avisos.push(a),
  });
  const turnoUrgente = urgente.sesion.tocar();
  await pausa();
  urgente.sesion.terminarEscucha();
  await pausa();
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].nivel, 'alta');
  // Primero termina la lectura del aviso local, luego se lee la respuesta de Claude.
  urgente.discursos[0].onend?.();
  await pausa();
  urgente.discursos[1].onend?.();
  await turnoUrgente;
});

test('la ruta /api/voz/transcribir valida formatos (incluyendo audio/mp4 de Safari) y transcribe con Gemini', async () => {
  const llamadas = [];
  const rutas = crearRutasVoz({
    entorno: { GEMINI_API_KEY: 'clave-de-prueba', GEMINI_TRANSCRIPTION_MODEL: 'modelo-transcripcion' },
    crearCliente: () => ({ models: { generateContent: async (peticion) => {
      llamadas.push(peticion);
      return { text: '{"text":"Hola VYTA"}' };
    } } }),
  });
  const texto = await rutas.transcribir(new Request('http://localhost/api/voz/transcribir', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/mp4;codecs=mp4a.40.2' },
    body: 'audio',
  }));
  assert.deepEqual(await texto.json(), { text: 'Hola VYTA' });
  assert.equal(llamadas[0].model, 'modelo-transcripcion');
  assert.equal(texto.headers.get('Cache-Control'), 'no-store');
  const invalida = await rutas.transcribir(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'texto' }));
  assert.equal(invalida.status, 415);
});

test('sin clave Gemini la transcripción devuelve un error claro y no llama al proveedor', async () => {
  const rutas = crearRutasVoz({ entorno: {}, crearCliente: () => { throw new Error('No debe llamarse'); } });
  const respuesta = await rutas.transcribir(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: 'audio' }));
  assert.equal(respuesta.status, 503);
  assert.match((await respuesta.json()).error, /GEMINI_API_KEY/);
});

test('modo continuo (Jarvis local): encadena dos turnos sin volver a tocar y cierra con frase de pausa', async () => {
  const frases = ['¿Cómo dormí?', '¿Puedo salir hoy?', 'Chau VYTA'];
  const prueba = navegadorDePrueba({
    transcripcion: () => frases.shift(),
    respuestaClaude: ({ pregunta }) => `Respuesta a: ${pregunta}`,
  });

  const charla = prueba.sesion.tocarContinuo();
  await pausa();
  assert.equal(prueba.sesion.obtener().continuo, true);
  assert.equal(prueba.sesion.obtener().fase, 'escuchando');

  // Turno 1: habla y calla 1.4s
  prueba.tick(100, 0.2);
  prueba.tick(100, 0.2);
  prueba.tick(1500, 0);
  await pausa();
  assert.equal(prueba.sesion.obtener().fase, 'hablando');
  assert.equal(prueba.discursos[0].text, 'Respuesta a: ¿Cómo dormí?');
  prueba.discursos[0].onend?.();
  await pausa();

  // Turno 2 automático sin volver a tocar la esfera y sin reabrir micrófono
  assert.equal(prueba.sesion.obtener().continuo, true);
  assert.equal(prueba.sesion.obtener().fase, 'escuchando');
  assert.equal(prueba.contadores().accesosMicrofono, 1);
  assert.equal(prueba.contadores().tracksDetenidos, 0);

  prueba.tick(100, 0.2);
  prueba.tick(100, 0.2);
  prueba.tick(1500, 0);
  await pausa();
  assert.equal(prueba.discursos[1].text, 'Respuesta a: ¿Puedo salir hoy?');
  prueba.discursos[1].onend?.();
  await pausa();

  // Turno 3: frase de cierre
  prueba.tick(100, 0.2);
  prueba.tick(100, 0.2);
  prueba.tick(1500, 0);
  await pausa();
  assert.match(prueba.discursos[2].text, /pauso la charla/i);
  prueba.discursos[2].onend?.();
  await charla;

  assert.equal(prueba.sesion.obtener().continuo, false);
  assert.equal(prueba.sesion.obtener().fase, 'inactivo');
  assert.deepEqual(prueba.contadores(), {
    accesosMicrofono: 1,
    tracksDetenidos: 1,
    contextosCerrados: 1,
    cancelacionesVoz: 0,
  });
});

test('barge-in en modo continuo: interrumpir hablando corta TTS y vuelve a escuchar en el mismo canal', async () => {
  const prueba = navegadorDePrueba({ transcripcion: 'Explicame mi estrés' });
  const charla = prueba.sesion.tocarContinuo();
  await pausa();

  prueba.tick(100, 0.2);
  prueba.tick(100, 0.2);
  prueba.tick(1500, 0);
  await pausa();
  assert.equal(prueba.sesion.obtener().fase, 'hablando');

  // Pasa período de gracia (350ms) y habla por encima del umbral (0.055) durante > 220ms
  prueba.tick(200, 0);
  prueba.tick(200, 0);
  prueba.tick(100, 0.12);
  prueba.tick(100, 0.12);
  prueba.tick(50, 0.12);
  await pausa();

  assert.equal(prueba.contadores().cancelacionesVoz, 1);
  assert.equal(prueba.contadores().tracksDetenidos, 0);
  assert.equal(prueba.sesion.obtener().continuo, true);
  assert.equal(prueba.sesion.obtener().fase, 'escuchando');

  prueba.sesion.tocarContinuo();
  await charla;
  assert.equal(prueba.sesion.obtener().continuo, false);
  assert.equal(prueba.contadores().tracksDetenidos, 1);
  assert.equal(prueba.contadores().contextosCerrados, 1);
});
