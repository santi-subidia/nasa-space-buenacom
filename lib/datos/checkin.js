'use client';

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { getCheckinPorSol, getChequeoFacialPorSol } from '@/lib/db';
import { useTripulanteActivo } from '@/lib/datos/tripulante';

export function useCheckinPorSol(sol) {
  const astronautId = useTripulanteActivo();
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    if (!Number.isInteger(sol)) return;
    const suscripcion = liveQuery(async () => {
      const [registro, facial] = await Promise.all([
        getCheckinPorSol(astronautId, sol), getChequeoFacialPorSol(astronautId, sol),
      ]);
      return { astronautId, sol, registro, facial, error: null };
    }).subscribe({
      next: setEstado,
      error: () => setEstado({ astronautId, sol, registro: null, facial: null, error: 'Could not query check-in for this sol. Reload the page to retry.' }),
    });
    return () => suscripcion.unsubscribe();
  }, [astronautId, sol]);

  const cargando = !Number.isInteger(sol) || estado?.astronautId !== astronautId || estado?.sol !== sol;
  return {
    astronautId,
    sol,
    cargando,
    completado: !cargando && Boolean(estado?.registro),
    facialCompletado: !cargando && Boolean(estado?.facial),
    error: cargando ? null : estado?.error,
  };
}
