// Lecturas (indicadores medidos) sobre el guardado local de #2 (lib/db.js, IndexedDB).
// Las pantallas usan estas dos funciones; cambian solo si cambia de dónde salen los datos.
//
// Extra sobre el contrato `Reading`: `sol` (día de misión) para agrupar por día mientras
// no exista el reloj de misión (#11).

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { addReading, getReadings } from '@/lib/db';
import { leerTripulanteActivo, useTripulanteActivo } from '@/lib/datos/tripulante';

const SIN_LECTURAS = [];

/**
 * Guarda lecturas ({ indicator, value, sol, source?, note? }). La unidad la completa db.js.
 * @returns {Promise<import('@/lib/tipos').Reading[]>}
 */
export function guardarLecturas(nuevas, astronautId = leerTripulanteActivo()) {
  return Promise.all(nuevas.map((l) => addReading({ astronautId, ...l })));
}

/** Lectura puntual desde IndexedDB (útil antes de enviar una consulta a la IA). */
export const leerLecturas = (astronautId = leerTripulanteActivo()) => getReadings(astronautId);

/** Lecturas del tripulante, de la más vieja a la más nueva. Se actualiza sola cuando alguien guarda. */
export function useLecturas(explicitId = null) {
  const activoId = useTripulanteActivo();
  const astronautId = explicitId || activoId;
  const [lecturas, setLecturas] = useState(SIN_LECTURAS);

  useEffect(() => {
    const suscripcion = liveQuery(() => getReadings(astronautId)).subscribe({
      next: setLecturas,
      error: (e) => console.error('Could not load readings', e),
    });
    return () => suscripcion.unsubscribe();
  }, [astronautId]);

  return lecturas;
}
