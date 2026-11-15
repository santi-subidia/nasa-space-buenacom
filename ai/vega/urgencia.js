// Detección de urgencias en el navegador, SIN IA y sin red: si alguien nombra una señal roja, la app
// reacciona al instante (pasos de primera respuesta + aviso al oficial médico) sin esperar a Claude.
// Es una red de seguridad conservadora: prefiere avisar de más.
//
// Los protocolos (qué hacer, de qué procedimiento de la NASA sale) viven en ./protocolos.js.
import { mensajeDeProtocolo, NIVELES_TRIAJE, RETRASO_TIERRA_POR_DEFECTO_MIN, triar } from './protocolos.js';

/**
 * Solo emergencias y urgencias (los avisos leves no disparan nada solos).
 * @param {string} texto
 * @param {{retrasoMin?: number}} [opciones]  demora de un tramo con Tierra, para el cierre del mensaje
 * @returns {{nivel:'critica'|'alta', triaje:'emergencia'|'urgente', categoria:string, protocolo:string,
 *            titulo:string, mensaje:string, citas:object[]}|null}
 */
export function detectarUrgencia(texto, { retrasoMin = RETRASO_TIERRA_POR_DEFECTO_MIN } = {}) {
  const resultado = triar(texto);
  if (!resultado || resultado.nivel === 'aviso') return null;
  const { protocolo } = resultado;
  return {
    nivel: NIVELES_TRIAJE[resultado.nivel].nivelAviso,
    triaje: resultado.nivel,
    categoria: protocolo.categoria,
    protocolo: protocolo.id,
    titulo: protocolo.titulo,
    mensaje: mensajeDeProtocolo(protocolo, { retrasoMin }),
    citas: protocolo.fuentes ?? [],
  };
}
