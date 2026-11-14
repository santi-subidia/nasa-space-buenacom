// Lecturas (indicadores medidos) sobre el guardado local de #2 (lib/db.js, IndexedDB).
// Las pantallas usan estas dos funciones; cambian solo si cambia de dónde salen los datos.
//
// Extra sobre el contrato `Reading`: `sol` (día de misión) para agrupar por día mientras
// no exista el reloj de misión (#11).

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { addReading, getReadings } from '@/lib/db';
import { MISION } from '@/lib/mock/mision';

const SIN_LECTURAS = [];

/**
 * Guarda lecturas ({ indicator, value, sol, source?, note? }). La unidad la completa db.js.
 * @returns {Promise<import('@/lib/tipos').Reading[]>}
 */
export function guardarLecturas(nuevas, astronautId = MISION.astronauta.id) {
  return Promise.all(nuevas.map((l) => addReading({ astronautId, ...l })));
}

/** Lecturas del tripulante, de la más vieja a la más nueva. Se actualiza sola cuando alguien guarda. */
export function useLecturas(astronautId = MISION.astronauta.id) {
  const [lecturas, setLecturas] = useState(SIN_LECTURAS);

  useEffect(() => {
    const suscripcion = liveQuery(() => getReadings(astronautId)).subscribe({
      next: setLecturas,
      error: (e) => console.error('No se pudieron leer las lecturas', e),
    });
    return () => suscripcion.unsubscribe();
  }, [astronautId]);

  return lecturas;
}
