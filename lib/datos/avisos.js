// Avisos al oficial médico (desde Vega, el motor de reglas, etc.). Almacén provisorio en localStorage:
// lo leen las notificaciones (#12) y el enlace con Tierra (#17).
//
// Aviso { nivel: 'alta'|'critica', categoria, motivo, origen: 'vega'|…, ts }

import { crearAlmacen } from './almacen';

const almacen = crearAlmacen('astrovitals:avisos:v1');

export function guardarAviso(aviso) {
  almacen.agregar([{ id: `${Date.now()}`, ts: new Date().toISOString(), ...aviso }]);
}

/** Avisos guardados (se actualiza solo cuando se agrega uno). */
export const useAvisos = almacen.useItems;
