// Lecturas (indicadores medidos). Almacén provisorio: se reemplaza por #2 manteniendo estas funciones.
//
// Reading { id, astronautId, indicator, value, unit, ts, sol, source: 'manual'|'voice'|'watch_sim'|'camera' }

import { crearAlmacen } from './almacen';

const almacen = crearAlmacen('astrovitals:lecturas:v1');

export function guardarLecturas(nuevas) {
  const ahora = new Date().toISOString();
  const conId = nuevas.map((l, i) => ({
    id: `${Date.now()}-${i}`,
    astronautId: 'ana',
    ts: ahora,
    source: 'manual',
    ...l,
  }));
  almacen.agregar(conId);
  return conId;
}

export const borrarLecturas = almacen.borrar;

/** Lecturas guardadas (se actualiza solo cuando otra pantalla guarda). */
export const useLecturas = almacen.useItems;
