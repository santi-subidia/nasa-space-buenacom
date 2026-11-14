// Validaciones compartidas por las tareas del servidor.
import { listarRiesgos } from './contexto.js';
import { ESFUERZOS } from './claude.js';

export class ErrorDePeticion extends Error {}

export const MAX_DATOS = 8000;

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
