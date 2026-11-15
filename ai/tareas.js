// Tareas que el servidor sabe pedirle a Claude. El navegador manda solo `tipo` + datos: las
// instrucciones, el contexto y el esfuerzo los decide el servidor (el cliente nunca arma el prompt).
import { getContext } from './contexto.js';
import { HERRAMIENTA_REGISTRAR_MEDICION, IDS_DE_VOZ, INSTRUCCIONES_CHEQUEO, validarMedicion } from './chequeo/indicadores.js';
import { INSTRUCCIONES_VEGA } from './vega.js';
import { elegirRiesgos } from './vega/riesgos.js';
import { tareaCara } from './cara/tarea.js';
import { tareaEntrenador } from './entrenador/tarea.js';
import { tareaJunta } from './junta/tarea.js';
import { datosComoTexto, ErrorDePeticion, validarEsfuerzo, validarHistorial, validarRiesgos, validarTexto } from './validar.js';

export { ErrorDePeticion };

const MAX_PREGUNTA = 500;

/**
 * answer: una pregunta de texto para VYTA/Vega. Esfuerzo `low` por defecto (voz: la latencia importa más).
 * body: { pregunta, riesgos?: string[], datosDelDia?: object|string, contextoPantalla?: string, historial?: Array, esfuerzo? }
 */
function tareaAnswer(body) {
  const pregunta = validarTexto(body.pregunta, 'pregunta', MAX_PREGUNTA);
  const historial = validarHistorial(body.historial);
  const contextoPantalla = body.contextoPantalla === undefined ? '' : validarTexto(body.contextoPantalla, 'contextoPantalla', 600);
  // Si el navegador no dice qué riesgos tocan, se eligen por la pregunta (y el hilo reciente en seguimientos).
  let riesgos;
  if (body.riesgos !== undefined) {
    riesgos = validarRiesgos(body.riesgos);
  } else {
    riesgos = elegirRiesgos(pregunta);
    if (!riesgos.length && historial.length) {
      const recientes = historial.filter((h) => h.role === 'user').slice(-2).map((h) => h.text).join(' ');
      if (recientes) riesgos = elegirRiesgos(recientes);
    }
  }
  const datos = datosComoTexto(body.datosDelDia);
  const ctx = riesgos.length ? getContext(riesgos) : null;

  return {
    kind: 'answer',
    instrucciones: INSTRUCCIONES_VEGA,
    contexto: ctx?.texto ?? '',
    historial,
    variable:
      (datos ? `<datos_del_dia>\n${datos}\n</datos_del_dia>\n\n` : '') +
      (contextoPantalla ? `<contexto_pantalla>\n${contextoPantalla}\n</contexto_pantalla>\n\n` : '') +
      `Pregunta del tripulante: ${pregunta}`,
    esfuerzo: validarEsfuerzo(body.esfuerzo, 'low'),
    maxTokens: 1500, // el razonamiento también cuenta
    entrada: { pregunta, riesgos },
    citas: ctx?.citas ?? [],
  };
}

/**
 * check: convierte una frase dicha ("anotá 37 con 6 de temperatura") en mediciones con la herramienta
 * registrar_medicion. Nunca usa una respuesta guardada: sería registrar el valor de otra persona.
 * body: { texto, pendientes?: string[] }  →  respuesta: { mediciones, rechazadas, mensaje }
 */
function tareaCheck(body) {
  const texto = validarTexto(body.texto, 'texto', 300);
  const pendientes = body.pendientes ?? [];
  if (!Array.isArray(pendientes) || pendientes.some((id) => !IDS_DE_VOZ.includes(id))) {
    throw new ErrorDePeticion('"pendientes" debe ser una lista de indicadores válidos');
  }
  return {
    kind: 'answer',
    sinRespaldo: true,
    guardar: false,
    instrucciones: INSTRUCCIONES_CHEQUEO,
    variable: (pendientes.length ? `Indicadores que se esperan ahora: ${pendientes.join(', ')}.\n` : '') + `Frase del tripulante: «${texto}»`,
    esfuerzo: 'low',
    maxTokens: 1200,
    herramientas: [HERRAMIENTA_REGISTRAR_MEDICION],
    entrada: { texto, pendientes },
    procesar(resultado) {
      const mediciones = [];
      const rechazadas = [];
      for (const llamada of resultado.llamadas ?? []) {
        if (llamada.nombre !== 'registrar_medicion') continue;
        const validada = validarMedicion(llamada.entrada);
        if (validada.ok) mediciones.push(validada.medicion);
        else rechazadas.push({ ...llamada.entrada, motivo: validada.motivo, mensaje: validada.mensaje });
      }
      return { mediciones, rechazadas, mensaje: resultado.texto ?? '' };
    },
  };
}

export const TAREAS = { answer: tareaAnswer, check: tareaCheck, board: tareaJunta, exercise: tareaEntrenador, face: tareaCara };

export function construirTarea(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ErrorDePeticion('El cuerpo debe ser un objeto JSON');
  const tarea = TAREAS[body.tipo];
  if (!tarea) throw new ErrorDePeticion(`Tipo desconocido "${body.tipo}". Válidos: ${Object.keys(TAREAS).join(', ')}`);
  return tarea(body);
}
