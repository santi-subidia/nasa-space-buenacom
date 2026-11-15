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

export function validarHistorial(historial = []) {
  if (historial === undefined || historial === null) return [];
  if (!Array.isArray(historial) || historial.length > 20 || historial.length % 2 !== 0) {
    throw new ErrorDePeticion('"historial" debe ser una lista par de hasta 20 turnos');
  }
  return historial.map((item, index) => {
    const rolEsperado = index % 2 === 0 ? 'user' : 'assistant';
    if (!item || item.role !== rolEsperado || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 4000) {
      throw new ErrorDePeticion('"historial" contiene un turno inválido');
    }
    return { role: item.role, text: item.text.trim() };
  });
}

const TIPOS_DE_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_CARACTERES_IMAGEN = 2_500_000; // ~1,8 MB de imagen en base64
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Fotos que manda el navegador: [{ media_type, data }] con `data` en base64 (sin el prefijo data:).
 * Solo se aceptan jpeg/png/webp y un máximo de fotos por consulta.
 */
export function validarImagenes(imagenes = [], { max = 3, campo = 'fotos' } = {}) {
  if (!Array.isArray(imagenes) || imagenes.length > max) throw new ErrorDePeticion(`"${campo}" debe ser una lista de hasta ${max} imágenes`);
  return imagenes.map((img, i) => {
    if (!TIPOS_DE_IMAGEN.includes(img?.media_type)) throw new ErrorDePeticion(`"${campo}[${i}]": el tipo debe ser ${TIPOS_DE_IMAGEN.join(', ')}`);
    if (typeof img.data !== 'string' || !img.data || img.data.length > MAX_CARACTERES_IMAGEN || !BASE64.test(img.data)) {
      throw new ErrorDePeticion(`"${campo}[${i}]": la imagen debe venir en base64 y pesar menos de ~1,8 MB`);
    }
    return { media_type: img.media_type, data: img.data };
  });
}
