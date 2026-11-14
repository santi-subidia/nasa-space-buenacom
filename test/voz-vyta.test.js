import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearDetectorFinDeFrase, elegirVozVyta, fragmentosParaVoz } from '../ai/voz/audio.js';
import { crearSesionVoz } from '../ai/voz/sesion.js';
import { crearRutasVoz } from '../ai/voz/servidor.js';

const pausa = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function navegadorDePrueba({ pedirMicrofono } = {}) {
  let reloj = 0;
  let rms = 0;
  let intervalo;
  let tracksDetenidos = 0;
  let contextosCerrados = 0;
  let cancelacionesVoz = 0;
  const solicitudes = [];
  const discursos = [];
  const stream = { getTracks: () => [{ stop: () => tracksDetenidos++ }] };
  class Recorder {
    static isTypeSupported(tipo) { return tipo.startsWith('audio/webm'); }
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
  const entorno = {
    isSecureContext: true,
    navigator: { mediaDevices: { getUserMedia: pedirMicrofono || (async () => stream) } },
    MediaRecorder: Recorder, AudioContext: Contexto,
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: {
      getVoices: () => [{ name: 'Microsoft Elena', lang: 'es-AR' }],
      speak: (speech) => discursos.push(speech),
      cancel: () => cancelacionesVoz++,
    },
  };
  const sesion = crearSesionVoz({
    entorno, ahora: () => reloj,
    cada: (fn) => { intervalo = fn; return 1; }, limpiar: () => { intervalo = null; },
    fetchFn: async (url, opciones) => {
      solicitudes.push({ url, opciones, tracksDetenidos });
      return Response.json(url.includes('transcribir') ? { text: '¿Cómo puedo descansar mejor?' } : { reply: 'Podemos pensar juntos una rutina de descanso.' });
    },
  });
  return {
    sesion, solicitudes, discursos, stream,
    tick(ms, nivel = 0) { reloj += ms; rms = nivel; intervalo?.(); },
    contadores: () => ({ tracksDetenidos, contextosCerrados, cancelacionesVoz }),
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

test('un toque graba, el silencio envía, Gemini responde y la fase hablando sigue al audio real', async () => {
  const prueba = navegadorDePrueba();
  const fases = [];
  prueba.sesion.suscribir(() => fases.push(prueba.sesion.obtener().fase));
  const turno = prueba.sesion.tocar();
  await pausa();
  assert.equal(prueba.sesion.obtener().fase, 'escuchando');
  for (let i = 0; i < 4; i++) prueba.tick(50, 0.1);
  prueba.tick(1800, 0);
  await pausa();
  assert.equal(prueba.solicitudes.length, 2);
  assert.ok(prueba.solicitudes[0].tracksDetenidos > 0, 'el micrófono se libera antes de enviar el audio');
  assert.equal(prueba.solicitudes[0].opciones.body.type, 'audio/webm;codecs=opus');
  assert.equal(JSON.parse(prueba.solicitudes[1].opciones.body).message, '¿Cómo puedo descansar mejor?');
  assert.equal(prueba.sesion.obtener().fase, 'pensando');
  prueba.discursos[0].onstart();
  assert.equal(prueba.sesion.obtener().fase, 'hablando');
  assert.equal(prueba.discursos[0].voice.name, 'Microsoft Elena');
  assert.equal(prueba.discursos[0].rate, 0.95);
  prueba.discursos[0].onend();
  await turno;
  assert.equal(prueba.sesion.obtener().fase, 'inactivo');
  assert.ok(fases.includes('transcribiendo'));
  assert.equal(prueba.contadores().contextosCerrados, 1);
});

test('el silencio inicial se descarta y cancelar al pedir permiso libera un micrófono que llega tarde', async () => {
  const prueba = navegadorDePrueba();
  const turno = prueba.sesion.iniciar();
  await pausa();
  prueba.tick(15000, 0);
  await turno;
  assert.equal(prueba.solicitudes.length, 0);
  assert.match(prueba.sesion.obtener().error, /No se escuchó/);
  let resolver;
  let detenidos = 0;
  const tarde = navegadorDePrueba({ pedirMicrofono: () => new Promise((resolve) => { resolver = resolve; }) });
  const pendiente = tarde.sesion.iniciar();
  tarde.sesion.cancelar();
  resolver({ getTracks: () => [{ stop: () => detenidos++ }] });
  await pendiente;
  assert.equal(detenidos, 1);
  assert.equal(tarde.solicitudes.length, 0);
  assert.equal(tarde.sesion.obtener().fase, 'inactivo');
});

test('cancelar una respuesta hablada detiene el audio sin volver a escuchar ni dejar errores', async () => {
  const prueba = navegadorDePrueba();
  const turno = prueba.sesion.iniciar();
  await pausa();
  prueba.sesion.terminarEscucha();
  await pausa();
  prueba.discursos[0].onstart();
  prueba.sesion.cancelar();
  await turno;
  assert.equal(prueba.contadores().cancelacionesVoz, 1);
  assert.deepEqual(prueba.sesion.obtener(), { fase: 'inactivo', error: '' });
});

test('las rutas de voz usan la configuración del proyecto de referencia y validan audio e historial', async () => {
  const llamadas = [];
  const rutas = crearRutasVoz({
    entorno: { GEMINI_API_KEY: 'clave-de-prueba', GEMINI_MODEL: 'modelo-conversacion', GEMINI_TRANSCRIPTION_MODEL: 'modelo-transcripcion' },
    crearCliente: () => ({ models: { generateContent: async (peticion) => {
      llamadas.push(peticion);
      return { text: peticion.model === 'modelo-transcripcion' ? '{"text":"Hola VYTA"}' : 'Hola, ¿cómo venís hoy?' };
    } } }),
  });
  const texto = await rutas.transcribir(new Request('http://localhost/api/voz/transcribir', { method: 'POST', headers: { 'Content-Type': 'audio/webm;codecs=opus' }, body: 'audio' }));
  assert.deepEqual(await texto.json(), { text: 'Hola VYTA' });
  assert.equal(llamadas[0].model, 'modelo-transcripcion');
  const respuesta = await rutas.responder(new Request('http://localhost/api/voz/responder', { method: 'POST', body: JSON.stringify({ message: 'Hola', history: [] }) }));
  assert.equal(respuesta.status, 200);
  assert.equal(llamadas[1].model, 'modelo-conversacion');
  assert.match(llamadas[1].config.systemInstruction, /español argentino/);
  assert.match(llamadas[1].config.systemInstruction, /exclusivamente por voz/);
  assert.equal(respuesta.headers.get('Cache-Control'), 'no-store');
  const invalida = await rutas.transcribir(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'texto' }));
  assert.equal(invalida.status, 415);
  const historialInvalido = await rutas.responder(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ message: 'Hola', history: [{ role: 'assistant', text: 'No corresponde' }] }) }));
  assert.equal(historialInvalido.status, 400);
});

test('sin clave Gemini las rutas devuelven un error claro y no llaman al proveedor', async () => {
  const rutas = crearRutasVoz({ entorno: {}, crearCliente: () => { throw new Error('No debe llamarse'); } });
  const respuesta = await rutas.responder(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ message: 'Hola', history: [] }) }));
  assert.equal(respuesta.status, 503);
  assert.match((await respuesta.json()).error, /GEMINI_API_KEY/);
});
