// Síntomas (con foto opcional). Almacén provisorio, se reemplaza por #2.
//
// Symptom { id, astronautId, bodyZone, code: 'rash'|'cold_sore'|'other', severity: 1|2|3, ts, sol, photoBlobId? }

import { crearAlmacen } from './almacen';

const almacen = crearAlmacen('astrovitals:sintomas:v1');

export function guardarSintoma(sintoma) {
  const completo = {
    id: `s-${Date.now()}`,
    astronautId: 'ana',
    ts: new Date().toISOString(),
    ...sintoma,
  };
  almacen.agregar([completo]);
  return completo;
}

export const useSintomas = almacen.useItems;

// ── Fotos: las imágenes son pesadas, van a IndexedDB (el síntoma guarda solo el id) ──
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
