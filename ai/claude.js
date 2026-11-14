// Cliente de Claude Haiku 5.5 con respuestas guardadas de respaldo (issue #5).
//
// consultarClaude() NUNCA lanza por culpa de la red o de la IA: si no hay clave, no hay red, la API
// falla o la respuesta termina en "refusal" / "max_tokens" / JSON inválido, devuelve la última
// respuesta guardada de ese tipo. La demo no puede depender de la red.
//
// Reglas de Haiku 5.5 que se respetan acá:
//  - sin temperature / top_p / top_k (dan 400) y sin prefill;
//  - el razonamiento es adaptativo y viene activado: se controla con output_config.effort y el
//    contenido se lee por `type`, no por posición;
//  - el razonamiento cuenta para max_tokens, así que los topes dejan margen;
//  - antes de leer el contenido se mira stop_reason (refusal no tiene respaldo automático).
import Anthropic from '@anthropic-ai/sdk';

import { claveDeEntrada, crearAlmacenEnArchivo } from './almacen.js';

export const MODELO = 'claude-haiku-5-5';
export const ESFUERZOS = ['low', 'medium', 'high'];

/** Por qué se usó (o no) una respuesta guardada. */
export const MOTIVOS = ['ia_apagada', 'sin_clave', 'clave_invalida', 'red', 'api', 'refusal', 'max_tokens', 'json_invalido'];

let clientePorDefecto = null;
function obtenerCliente() {
  clientePorDefecto ??= new Anthropic({ maxRetries: 1, timeout: 30_000 });
  return clientePorDefecto;
}

let almacenPorDefecto = null;
const obtenerAlmacen = () => (almacenPorDefecto ??= crearAlmacenEnArchivo());

function clasificarError(error) {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return 'clave_invalida';
  if (error instanceof Anthropic.APIConnectionError) return 'red';
  return 'api';
}

/** Arma los parámetros de messages.create. Lo fijo va primero (cacheable); lo variable, al final. */
export function armarParametros(peticion, modelo = MODELO) {
  const {
    instrucciones,
    contexto = '',
    variable,
    imagenes = [],
    esfuerzo = 'medium',
    maxTokens = 2048,
    formato,
    herramientas,
  } = peticion;

  if (!ESFUERZOS.includes(esfuerzo)) throw new Error(`Esfuerzo "${esfuerzo}" inválido. Válidos: ${ESFUERZOS.join(', ')}`);
  if (!variable) throw new Error('Falta la parte variable del mensaje (pregunta, datos del día…)');

  // El breakpoint de caché va en el ÚLTIMO bloque fijo: cachea instrucciones + fichas juntas.
  const system = [{ type: 'text', text: instrucciones }];
  if (contexto) system.push({ type: 'text', text: contexto });
  system[system.length - 1].cache_control = { type: 'ephemeral' };

  const content = [
    ...imagenes.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } })),
    { type: 'text', text: variable },
  ];

  const parametros = {
    model: modelo,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
    output_config: { effort: esfuerzo, ...(formato ? { format: { type: 'json_schema', schema: formato } } : {}) },
  };
  if (herramientas?.length) parametros.tools = herramientas.map((t) => ({ ...t, strict: true }));
  return parametros;
}

/** Lee la respuesta por tipo de bloque (puede empezar con bloques `thinking`). */
function leerRespuesta(respuesta, esperaJson) {
  let texto = '';
  const llamadas = [];
  for (const bloque of respuesta.content) {
    if (bloque.type === 'text') texto += bloque.text;
    else if (bloque.type === 'tool_use') llamadas.push({ id: bloque.id, nombre: bloque.name, entrada: bloque.input });
  }
  texto = texto.trim();
  let json = null;
  if (esperaJson) {
    try {
      json = JSON.parse(texto);
    } catch {
      return { error: 'json_invalido' };
    }
  }
  return { texto, json, llamadas };
}

const resumirUso = (u = {}) => ({
  entrada: u.input_tokens ?? 0,
  salida: u.output_tokens ?? 0,
  cacheLectura: u.cache_read_input_tokens ?? 0,
  cacheEscritura: u.cache_creation_input_tokens ?? 0,
});

/**
 * @param {object} peticion
 * @param {'answer'|'board'|'exercise'|'face'} peticion.kind  tipo de AiResult (para guardar y respaldar)
 * @param {string}  peticion.instrucciones  parte fija 1: instrucciones del sistema (p. ej. INSTRUCCIONES_VEGA)
 * @param {string}  [peticion.contexto]     parte fija 2: fichas de getContext(...).texto
 * @param {string}  peticion.variable       parte variable: datos del día + pregunta
 * @param {object[]} [peticion.imagenes]    [{ media_type: 'image/jpeg', data: <base64> }]
 * @param {'low'|'medium'|'high'} [peticion.esfuerzo='medium']  low = voz, medium = junta
 * @param {number}  [peticion.maxTokens=2048]
 * @param {object}  [peticion.formato]      JSON Schema de la salida (output_config.format)
 * @param {object[]} [peticion.herramientas] herramientas con strict: true
 * @param {*}       [peticion.entrada]      lo que identifica la consulta (para elegir la respuesta guardada)
 * @param {boolean} [peticion.guardar=true]
 * @param {boolean} [peticion.sinRespaldo=false]  no devolver nunca una respuesta guardada (mediciones)
 * @param {object}  [dependencias]  { cliente, almacen, modelo, env } (para pruebas)
 */
export async function consultarClaude(peticion, dependencias = {}) {
  const { kind, entrada = peticion.variable, guardar = true } = peticion;
  const almacen = dependencias.almacen ?? obtenerAlmacen();
  const env = dependencias.env ?? process.env;
  const clave = claveDeEntrada(entrada);

  const respaldo = (motivo, extra = {}) => {
    // Hay respuestas que NUNCA se reemplazan por otra vieja (p. ej. una medición: registraría un valor ajeno).
    const guardada = peticion.sinRespaldo ? null : almacen.buscar(kind, clave);
    if (!guardada) return { ok: false, origen: 'ninguna', kind, motivo, ...extra };
    return {
      ok: true,
      origen: 'guardada',
      kind,
      motivo,
      ...guardada.output,
      id: guardada.id,
      ts: guardada.ts,
      exacta: guardada.clave === clave,
      ...extra,
    };
  };

  if (env.IA_APAGADA === '1') return respaldo('ia_apagada');
  if (!dependencias.cliente && !env.ANTHROPIC_API_KEY) return respaldo('sin_clave');

  const parametros = armarParametros(peticion, dependencias.modelo); // si la petición está mal armada, es un bug: que lance

  let respuesta;
  try {
    respuesta = await (dependencias.cliente ?? obtenerCliente()).messages.create(parametros);
  } catch (error) {
    return respaldo(clasificarError(error));
  }

  // 1) stop_reason antes de tocar el contenido.
  const uso = resumirUso(respuesta.usage);
  if (respuesta.stop_reason === 'refusal') return respaldo('refusal', { uso, categoria: respuesta.stop_details?.category ?? null });
  if (respuesta.stop_reason === 'max_tokens') return respaldo('max_tokens', { uso });

  // 2) Contenido por tipo de bloque.
  const leido = leerRespuesta(respuesta, Boolean(peticion.formato));
  if (leido.error) return respaldo(leido.error, { uso });

  const output = { texto: leido.texto, json: leido.json, llamadas: leido.llamadas };
  const guardado = guardar ? almacen.guardar({ kind, input: entrada, output, clave }) : null;
  return {
    ok: true,
    origen: 'claude',
    kind,
    motivo: null,
    ...output,
    id: guardado?.id ?? null,
    ts: guardado?.ts ?? new Date().toISOString(),
    exacta: true,
    modelo: respuesta.model ?? MODELO,
    stopReason: respuesta.stop_reason,
    uso,
  };
}
