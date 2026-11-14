// Tareas que el servidor sabe pedirle a Claude. El navegador manda solo `tipo` + datos: las
// instrucciones, el contexto y el esfuerzo los decide el servidor (el cliente nunca arma el prompt).
import { getContext, listarRiesgos } from './contexto.js';
import { ESFUERZOS } from './claude.js';
import { INSTRUCCIONES_VEGA } from './vega.js';
import { elegirRiesgos } from './vega/riesgos.js';

export class ErrorDePeticion extends Error {}

const MAX_PREGUNTA = 500;
const MAX_DATOS = 8000;

export function validarTexto(valor, campo, max) {
  if (typeof valor !== 'string' || !valor.trim()) throw new ErrorDePeticion(`Falta "${campo}"`);
  if (valor.length > max) throw new ErrorDePeticion(`"${campo}" pasa de ${max} caracteres`);
  return valor.trim();
}

export function validarRiesgos(riesgos = []) {
  if (!Array.isArray(riesgos)) throw new ErrorDePeticion('"riesgos" debe ser una lista');
  const validos = new Set(listarRiesgos());
  const malos = riesgos.filter((r) => !validos.has(r));
  if (malos.length) throw new ErrorDePeticion(`Riesgos desconocidos: ${malos.join(', ')}`);
  return riesgos;
}

export function validarEsfuerzo(esfuerzo, porDefecto) {
  if (esfuerzo === undefined) return porDefecto;
  if (!ESFUERZOS.includes(esfuerzo)) throw new ErrorDePeticion(`"esfuerzo" debe ser: ${ESFUERZOS.join(', ')}`);
  return esfuerzo;
}

export function datosComoTexto(datos) {
  if (datos === undefined || datos === null) return '';
  const texto = typeof datos === 'string' ? datos : JSON.stringify(datos);
  if (texto.length > MAX_DATOS) throw new ErrorDePeticion(`"datosDelDia" pasa de ${MAX_DATOS} caracteres`);
  return texto;
}

/**
 * answer: una pregunta de texto para Vega. Esfuerzo `low` por defecto (voz: la latencia importa más).
 * body: { pregunta, riesgos?: string[], datosDelDia?: object|string, esfuerzo? }
 */
function tareaAnswer(body) {
  const pregunta = validarTexto(body.pregunta, 'pregunta', MAX_PREGUNTA);
  // Si el navegador no dice qué riesgos tocan, se eligen por la pregunta (solo esas fichas, no el corpus entero).
  const riesgos = body.riesgos === undefined ? elegirRiesgos(pregunta) : validarRiesgos(body.riesgos);
  const datos = datosComoTexto(body.datosDelDia);
  const ctx = riesgos.length ? getContext(riesgos) : null;

  return {
    kind: 'answer',
    instrucciones: INSTRUCCIONES_VEGA,
    contexto: ctx?.texto ?? '',
    variable: (datos ? `<datos_del_dia>\n${datos}\n</datos_del_dia>\n\n` : '') + `Pregunta del tripulante: ${pregunta}`,
    esfuerzo: validarEsfuerzo(body.esfuerzo, 'low'),
    maxTokens: 1500, // el razonamiento también cuenta
    entrada: { pregunta, riesgos },
    citas: ctx?.citas ?? [],
  };
}

export const TAREAS = { answer: tareaAnswer };

export function construirTarea(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ErrorDePeticion('El cuerpo debe ser un objeto JSON');
  const tarea = TAREAS[body.tipo];
  if (!tarea) throw new ErrorDePeticion(`Tipo desconocido "${body.tipo}". Válidos: ${Object.keys(TAREAS).join(', ')}`);
  return tarea(body);
}
