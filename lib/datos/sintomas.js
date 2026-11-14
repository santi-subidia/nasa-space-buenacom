// Síntomas (con foto opcional). El síntoma va a lib/db.js (#2); las fotos son pesadas y
// van aparte, a su propia base IndexedDB (el síntoma guarda solo el `photoBlobId`).
//
// Symptom { id, astronautId, bodyZone, code: 'rash'|'cold_sore'|'other', severity: 1|2|3, ts, sol, photoBlobId? }

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { addSymptom, getSymptoms } from '@/lib/db';
import { MISION } from '@/lib/mock/mision';

const SIN_SINTOMAS = [];

export function guardarSintoma(sintoma, astronautId = MISION.astronauta.id) {
  return addSymptom({ astronautId, ...sintoma });
}

/** Lectura puntual desde IndexedDB (útil antes de enviar una consulta a la IA). */
export const leerSintomas = (astronautId = MISION.astronauta.id) => getSymptoms(astronautId);

/** Síntomas del tripulante, del más viejo al más nuevo. Se actualiza sola cuando alguien guarda. */
export function useSintomas(astronautId = MISION.astronauta.id) {
  const [sintomas, setSintomas] = useState(SIN_SINTOMAS);

  useEffect(() => {
    const suscripcion = liveQuery(() => getSymptoms(astronautId)).subscribe({
      next: setSintomas,
      error: (e) => console.error('No se pudieron leer los síntomas', e),
    });
    return () => suscripcion.unsubscribe();
  }, [astronautId]);

  return sintomas;
}

// ── Fotos ──
const BD = 'astrovitals-fotos';
const TABLA = 'fotos';

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TABLA);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarFoto(blob) {
  const id = `foto-${Date.now()}`;
  const bd = await abrir();
  await new Promise((resolve, reject) => {
    const tx = bd.transaction(TABLA, 'readwrite');
    tx.objectStore(TABLA).put(blob, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  bd.close();
  return id;
}

export async function leerFoto(id) {
  const bd = await abrir();
  const blob = await new Promise((resolve, reject) => {
    const req = bd.transaction(TABLA).objectStore(TABLA).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  bd.close();
  return blob;
}
