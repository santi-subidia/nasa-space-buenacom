import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getContext } from '../contexto.js';
import { elegirRiesgos } from '../vega/riesgos.js';
import { crearSesionVega, MENSAJE_SIN_CONEXION, SUGERENCIAS } from '../vega/sesion.js';
import { citasUsadas, idsCitados, normalizar, textoParaVoz } from '../vega/texto.js';
import { detectarUrgencia } from '../vega/urgencia.js';
import { crearVoz, elegirVoz } from '../vega/voz.js';
import { crearManejador } from '../route.js';
import { consultarClaude } from '../claude.js';
import { crearAlmacenEnMemoria } from '../almacen.js';

// ---------- texto, citas y riesgos ----------

test('textoParaVoz quita citas y markdown; citasUsadas devuelve solo las citadas, en orden', () => {
  const texto = 'El **estrés** y el poco sueño [F2] pueden reactivar el virus [F1]. Avisá al oficial médico.';
  assert.equal(textoParaVoz(texto), 'El estrés y el poco sueño pueden reactivar el virus. Avisá al oficial médico.');
  assert.deepEqual(idsCitados(texto), ['F2', 'F1']);
  const citas = [{ id: 'F1', titulo: 'a' }, { id: 'F2', titulo: 'b' }, { id: 'F3', titulo: 'c' }];
  assert.deepEqual(citasUsadas(texto, citas).map((c) => c.id), ['F2', 'F1']);
  assert.equal(normalizar('Estrés Sueño'), 'estres sueno');
});

test('elegirRiesgos: la pregunta de la demo trae las fichas de inmunidad', () => {
  assert.equal(elegirRiesgos('¿por qué me salió herpes?')[0], 'inmunidad');
  assert.ok(elegirRiesgos('Explicame mi sueño').includes('sueno-horarios'));
  const eva = elegirRiesgos('¿Puedo hacer la EVA de mañana?');
  assert.equal(eva[0], 'eva');
  assert.ok(eva.includes('descompresion'));
  assert.deepEqual(elegirRiesgos('hola, ¿qué tal?'), []);
  assert.deepEqual(elegirRiesgos('enojo'), []); // "ojo" solo cuenta al comienzo de una palabra
  for (const pregunta of SUGERENCIAS) assert.ok(elegirRiesgos(pregunta).length > 0, pregunta);
});

test('elegirRiesgos devuelve como mucho 3 riesgos y la consulta queda muy por debajo de 100K tokens', () => {
  const r = elegirRiesgos('mi sueño, el estrés, la fiebre, el corazón, los huesos y la comida');
  assert.ok(r.length <= 3);
  assert.ok(getContext(r).tokens < 20_000);
});

// ---------- urgencias ----------

test('detectarUrgencia: señales rojas y autolesión se detectan sin IA', () => {
  assert.equal(detectarUrgencia('a veces pienso en hacerme daño').nivel, 'critica');
  assert.equal(detectarUrgencia('NO QUIERO SEGUIR así').categoria, 'autolesion');
  assert.equal(detectarUrgencia('tengo dolor en el pecho').nivel, 'alta');
  assert.equal(detectarUrgencia('me cuesta respirar').categoria, 'cardiorrespiratoria');
  assert.equal(detectarUrgencia('tengo el brazo hinchado').categoria, 'trombosis');
  assert.equal(detectarUrgencia('¿Por qué me salió herpes?'), null);
  assert.equal(detectarUrgencia('Explicame mi sueño'), null);
});

// ---------- voz ----------

test('elegirVoz prefiere es-AR y cae a cualquier español; null si no hay', () => {
  const v = (lang) => ({ lang, name: lang });
  assert.equal(elegirVoz([v('en-US'), v('es-ES'), v('es-AR')]).lang, 'es-AR');
  assert.equal(elegirVoz([v('en-US'), v('es_ES')]).lang, 'es_ES');
  assert.equal(elegirVoz([v('en-US')]), null);
});

function ventanaFalsa({ errorAlEscuchar, frase = 'por qué me salió herpes' } = {}) {
  const registro = { habladas: [], cancelaciones: 0 };
  class Reconocimiento {
    start() {
      setTimeout(() => {
        if (errorAlEscuchar) this.onerror({ error: errorAlEscuchar });
        else {
          this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'por qué' }], { isFinal: false })] });
          this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: frase }], { isFinal: true })] });
        }
        this.onend();
      }, 0);
    }
    abort() {}
  }
  class Enunciado {
    constructor(texto) {
      this.text = texto;
    }
  }
  const speechSynthesis = {
    getVoices: () => [{ lang: 'es-AR', name: 'Voz' }],
    speak(e) {
      registro.habladas.push(e);
      setTimeout(() => e.onend?.(), 0);
    },
    cancel() {
      registro.cancelaciones++;
    },
  };
  return { ventana: { webkitSpeechRecognition: Reconocimiento, SpeechSynthesisUtterance: Enunciado, speechSynthesis }, registro };
}

test('voz: escucha una frase, informa parciales y habla con voz en español', async () => {
  const { ventana, registro } = ventanaFalsa();
  const estados = [];
  const parciales = [];
  const voz = crearVoz({ ventana, alCambiar: (e) => estados.push(e), alOirParcial: (t) => parciales.push(t) });
  assert.equal(voz.soportaReconocimiento && voz.soportaSintesis, true);

  assert.equal(await voz.escuchar(), 'por qué me salió herpes');
  assert.deepEqual(parciales, ['por qué', 'por qué me salió herpes']);
  assert.deepEqual(estados.slice(0, 2), ['escuchando', 'inactivo']);

  await voz.hablar('Hola');
  assert.equal(registro.habladas[0].lang, 'es-AR');
  assert.equal(registro.habladas[0].voice.name, 'Voz');
  assert.equal(estados.at(-2), 'hablando');
  assert.equal(estados.at(-1), 'inactivo');
});

test('voz: errores del micrófono llegan con un mensaje claro y navegadores sin soporte no rompen', async () => {
  const { ventana } = ventanaFalsa({ errorAlEscuchar: 'not-allowed' });
  await assert.rejects(crearVoz({ ventana }).escuchar(), (e) => e.codigo === 'not-allowed' && /permiso/.test(e.mensaje));

  const sin = crearVoz({ ventana: {} });
  assert.equal(sin.soportaReconocimiento, false);
  await assert.rejects(sin.escuchar(), (e) => e.codigo === 'no-soportado');
  await sin.hablar('no pasa nada'); // sin síntesis resuelve igual
});

// ---------- sesión ----------

function respuestaFetch(cuerpo, ok = true) {
  return async () => ({ ok, json: async () => cuerpo });
}

const cuerpoDeVega = (texto, extra = {}) => ({
  ok: true,
  origen: 'claude',
  texto,
  textoVoz: textoParaVoz(texto),
  citasUsadas: [{ id: 'F1', titulo: 'Risk of Altered Immune System Responses', url: 'https://www.nasa.gov/reference/risk-of-altered-immune-system-responses/' }],
  ...extra,
});

test('sesión: pregunta → respuesta con citas, leída en voz alta', async () => {
  const { ventana, registro } = ventanaFalsa();
  const voz = crearVoz({ ventana });
  const pedidos = [];
  const vega = crearSesionVega({
    voz,
    obtenerDatosDelDia: () => ({ sol: 42, sueno_horas: 5.3 }),
    fetchFn: async (url, init) => {
      pedidos.push({ url, cuerpo: JSON.parse(init.body) });
      return { ok: true, json: async () => cuerpoDeVega('El estrés y el poco sueño pueden reactivar el herpes [F1].') };
    },
  });
  await vega.preguntar('¿Por qué me salió herpes?');

  assert.equal(pedidos[0].url, '/api/claude');
  assert.equal(pedidos[0].cuerpo.tipo, 'answer');
  assert.deepEqual(pedidos[0].cuerpo.datosDelDia, { sol: 42, sueno_horas: 5.3 });
  assert.equal('riesgos' in pedidos[0].cuerpo, false); // las elige el servidor
  const { mensajes, fase } = vega.obtener();
  assert.deepEqual(mensajes.map((m) => m.rol), ['usuario', 'vega']);
  assert.equal(mensajes[1].texto, 'El estrés y el poco sueño pueden reactivar el herpes.');
  assert.equal(mensajes[1].citas.length, 1);
  assert.equal(registro.habladas[0].text, 'El estrés y el poco sueño pueden reactivar el herpes.');
  assert.equal(fase, 'inactivo');
});

test('sesión: pasa por escuchando → pensando → hablando', async () => {
  const { ventana } = ventanaFalsa();
  const vega = crearSesionVega({ voz: crearVoz({ ventana }), fetchFn: respuestaFetch(cuerpoDeVega('Respuesta.')) });
  const fases = [];
  vega.suscribir(() => {
    const f = vega.obtener().fase;
    if (fases.at(-1) !== f) fases.push(f);
  });
  await vega.preguntarPorVoz();
  assert.deepEqual(fases.filter((f) => f !== 'inactivo'), ['escuchando', 'pensando', 'hablando']);
  assert.equal(vega.obtener().mensajes[0].texto, 'por qué me salió herpes');
});

test('sesión: sin conexión muestra un mensaje de Vega y sugiere avisar al oficial', async () => {
  const vega = crearSesionVega({ voz: null, fetchFn: async () => { throw new TypeError('fetch failed'); } });
  await vega.preguntar('¿Cómo duermo mejor?', { hablar: false });
  const { mensajes, sugerirAviso, fase } = vega.obtener();
  assert.equal(mensajes.at(-1).texto, MENSAJE_SIN_CONEXION);
  assert.equal(mensajes.at(-1).origen, 'local');
  assert.equal(sugerirAviso, true);
  assert.equal(fase, 'inactivo');
});

test('sesión: una señal crítica avisa al oficial al instante y NO espera a la IA', async () => {
  const avisos = [];
  let llamadas = 0;
  const vega = crearSesionVega({
    voz: null,
    alAvisarOficial: (a) => avisos.push(a),
    fetchFn: async () => { llamadas++; return { ok: true, json: async () => cuerpoDeVega('x') }; },
  });
  await vega.preguntar('no quiero seguir', { hablar: false });
  assert.equal(llamadas, 0);
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].nivel, 'critica');
  assert.equal(avisos[0].origen, 'vega');
  assert.equal(vega.obtener().mensajes.at(-1).urgente, true);
});

test('sesión: una señal alta avisa y además consulta a la IA', async () => {
  const avisos = [];
  const vega = crearSesionVega({ voz: null, alAvisarOficial: (a) => avisos.push(a), fetchFn: respuestaFetch(cuerpoDeVega('Avisá al oficial médico.')) });
  await vega.preguntar('tengo dolor en el pecho', { hablar: false });
  assert.equal(avisos.length, 1);
  assert.equal(vega.obtener().mensajes.length, 3); // usuario, aviso local, respuesta de la IA
  assert.equal(vega.obtener().sugerirAviso, true);
});

test('sesión: avisarOficial() desde la conversación y sugerencia cuando Vega menciona al oficial', async () => {
  const avisos = [];
  const vega = crearSesionVega({ voz: null, alAvisarOficial: (a) => avisos.push(a), fetchFn: respuestaFetch(cuerpoDeVega('Conviene avisar al oficial médico.')) });
  await vega.preguntar('tengo fiebre de 38', { hablar: false });
  assert.equal(vega.obtener().sugerirAviso, true);
  vega.avisarOficial();
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].categoria, 'manual');
  assert.equal(vega.obtener().sugerirAviso, false);
});

test('sesión: una respuesta vieja no pisa a la pregunta más nueva', async () => {
  const resolvers = [];
  const vega = crearSesionVega({
    voz: null,
    fetchFn: () => new Promise((resolver) => resolvers.push(resolver)),
  });
  const a = vega.preguntar('primera', { hablar: false });
  const b = vega.preguntar('segunda', { hablar: false });
  resolvers[1]({ ok: true, json: async () => cuerpoDeVega('Respuesta a la segunda.') });
  resolvers[0]({ ok: true, json: async () => cuerpoDeVega('Respuesta a la primera.') });
  await Promise.all([a, b]);
  const textos = vega.obtener().mensajes.filter((m) => m.rol === 'vega').map((m) => m.texto);
  assert.deepEqual(textos, ['Respuesta a la segunda.']);
});

test('sesión: sin reconocimiento de voz avisa en vez de romper', async () => {
  const vega = crearSesionVega({ voz: crearVoz({ ventana: {} }), fetchFn: respuestaFetch({}) });
  await vega.preguntarPorVoz();
  assert.match(vega.obtener().error, /no reconoce voz/);
});

// ---------- servidor: de punta a punta con un cliente simulado ----------

test('POST /api/claude con "¿por qué me salió herpes?": elige fichas de inmunidad y devuelve 1–2 citas', async () => {
  const llamadas = [];
  const cliente = {
    messages: {
      create: async (params) => {
        llamadas.push(params);
        return {
          model: 'claude-haiku-5-5',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'El estrés y el poco sueño pueden reactivar un virus latente [F1][F2]. Si aparece fiebre, avisá al oficial médico.' }],
          usage: { input_tokens: 3000, output_tokens: 40 },
        };
      },
    },
  };
  const POST = crearManejador({ consultar: (p) => consultarClaude(p, { cliente, almacen: crearAlmacenEnMemoria(), env: { ANTHROPIC_API_KEY: 'x' } }) });
  const res = await POST(new Request('http://x/api/claude', {
    method: 'POST',
    body: JSON.stringify({ tipo: 'answer', pregunta: '¿Por qué me salió herpes?', datosDelDia: { sol: 42, sueno_horas: 5.3 } }),
  }));
  const cuerpo = await res.json();

  assert.match(llamadas[0].system[1].text, /<ficha riesgo="inmunidad"/);
  assert.match(llamadas[0].messages[0].content[0].text, /sueno_horas/);
  assert.equal(llamadas[0].output_config.effort, 'low');
  assert.deepEqual(cuerpo.citasUsadas.map((c) => c.id), ['F1', 'F2']);
  assert.ok(cuerpo.citasUsadas.every((c) => c.url.startsWith('https://www.nasa.gov/')));
  assert.doesNotMatch(cuerpo.textoVoz, /\[F\d\]/);
});

test('sesión: ante una señal alta, consulta a la IA mientras todavía lee el aviso, y lee la respuesta después', async () => {
  const eventos = [];
  let terminarAviso;
  const voz = {
    soportaSintesis: true,
    callar() {},
    hablar: (texto) => {
      eventos.push(`habla: ${texto.slice(0, 12)}`);
      return texto.startsWith('Eso puede') ? new Promise((r) => { terminarAviso = r; }) : Promise.resolve();
    },
  };
  const fetchFn = async () => {
    eventos.push('consulta');
    return { ok: true, json: async () => cuerpoDeVega('Avisá al oficial médico.') };
  };
  const vega = crearSesionVega({ voz, fetchFn });
  const hecho = vega.preguntar('tengo dolor en el pecho');
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(eventos, ['habla: Eso puede se', 'consulta']); // la consulta no espera al aviso
  assert.equal(vega.obtener().mensajes.at(-1).texto, 'Avisá al oficial médico.');
  assert.equal(eventos.includes('habla: Avisá al ofi'), false); // la respuesta todavía no se lee
  terminarAviso();
  await hecho;
  assert.equal(eventos.at(-1), 'habla: Avisá al ofi');
});
