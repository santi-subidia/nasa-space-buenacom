'use client';

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { getCheckinDiario } from '@/lib/db';
import { fechaCheckin } from '@/lib/checkin';
import { useTripulanteActivo } from '@/lib/datos/tripulante';

export function useCheckinDiario() {
  const astronautId = useTripulanteActivo();
  const [fecha, setFecha] = useState(null);
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    const actualizarFecha = () => setFecha(fechaCheckin());
    actualizarFecha();
    const intervalo = setInterval(actualizarFecha, 1000);
    window.addEventListener('focus', actualizarFecha);
    document.addEventListener('visibilitychange', actualizarFecha);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', actualizarFecha);
      document.removeEventListener('visibilitychange', actualizarFecha);
    };
  }, []);

  useEffect(() => {
    if (!fecha) return;
    const suscripcion = liveQuery(() => getCheckinDiario(astronautId, fecha)).subscribe({
      next: (registro) => setEstado({ astronautId, fecha, registro, error: null }),
      error: () => setEstado({ astronautId, fecha, registro: null, error: 'No se pudo consultar el check-in de hoy. Recargá la página para reintentar.' }),
    });
    return () => suscripcion.unsubscribe();
  }, [astronautId, fecha]);

  const cargando = estado?.astronautId !== astronautId || estado?.fecha !== fecha;
  return {
    astronautId,
    fecha,
    cargando,
    completado: !cargando && Boolean(estado?.registro),
    error: cargando ? null : estado?.error,
  };
}
