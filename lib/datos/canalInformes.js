'use client';

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { findAiResult, getDb } from '@/lib/db';
import { sincronizarCanal } from '@/lib/enlace/canal';
import { juntaDelTripulante } from '@/lib/enlace/informes';

export function useCanalInformes(astronautId, sol) {
  const [datos, setDatos] = useState({ astronautId: null, junta: null, transmisiones: [] });
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const suscripcion = liveQuery(async () => ({
      astronautId,
      junta: await findAiResult('board', (input) => juntaDelTripulante(input, astronautId, sol)),
      transmisiones: await getDb().transmisionesEnlace.where('astronaut_id').equals(astronautId).toArray(),
    })).subscribe({ next: setDatos, error: (error) => console.error('No se pudo leer el canal de informes', error) });
    return () => suscripcion.unsubscribe();
  }, [astronautId, sol]);

  useEffect(() => {
    let vigente = true;
    async function actualizar() {
      if (!navigator.onLine) {
        if (vigente) setConectado(false);
        return;
      }
      try {
        const resultado = await sincronizarCanal(astronautId);
        if (vigente) setConectado(resultado.ok);
      } catch {
        if (vigente) setConectado(false);
      }
    }
    actualizar();
    const intervalo = setInterval(actualizar, 10000);
    const desconectar = () => setConectado(false);
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', desconectar);
    window.addEventListener('focus', actualizar);
    return () => {
      vigente = false;
      clearInterval(intervalo);
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', desconectar);
      window.removeEventListener('focus', actualizar);
    };
  }, [astronautId]);

  if (datos.astronautId !== astronautId) return { junta: null, transmisiones: [], conectado: false };
  return { junta: datos.junta, transmisiones: datos.transmisiones, conectado };
}
