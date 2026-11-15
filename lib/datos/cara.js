// Persistencia local de la foto base (`baselinePhotoId`) para "¿Cómo me ves hoy?" (#20).
// Guarda el Blob en IndexedDB (reutiliza `guardarFoto`/`leerFoto`) y el id en `localStorage` + Dexie (`Astronaut.baselinePhotoId`).

import { getAstronaut, saveAstronaut } from '@/lib/db';
import { guardarFoto, leerFoto } from '@/lib/datos/sintomas';
import { leerTripulanteActivo } from '@/lib/datos/tripulante';
import { TRIPULANTES } from '@/lib/demo/generador';

const claveBaseline = (id = leerTripulanteActivo()) => `astrovitals:baseline-photo:${id}:v1`;
const MAX_CARACTERES_IMAGEN = 2_500_000;

export function leerBaselinePhotoId(astronautId = leerTripulanteActivo()) {
  try {
    return localStorage.getItem(claveBaseline(astronautId)) || null;
  } catch {
    return null;
  }
}

export async function guardarFotoBase(blob, astronautId = leerTripulanteActivo()) {
  const photoId = await guardarFoto(blob);
  try {
    localStorage.setItem(claveBaseline(astronautId), photoId);
  } catch {
    /* modo privado */
  }
  try {
    const actual = await getAstronaut(astronautId);
    const meta = TRIPULANTES.find((t) => t.id === astronautId) || TRIPULANTES[0];
    await saveAstronaut({
      id: astronautId,
      name: meta.name,
      role: meta.role,
      baseline: actual?.baseline ?? meta.baseline ?? {},
      ...actual,
      baselinePhotoId: photoId,
    });
  } catch {
    /* IndexedDB de Dexie opcional si no se inicializó */
  }
  return photoId;
}

export async function cargarFotoBase(astronautId = leerTripulanteActivo()) {
  let id = leerBaselinePhotoId(astronautId);
  if (!id) {
    try {
      const a = await getAstronaut(astronautId);
      id = a?.baselinePhotoId ?? null;
    } catch {
      id = null;
    }
  }
  if (!id) return null;
  try {
    const blob = await leerFoto(id);
    if (!blob) return null;
    const foto = await blobABase64(blob);
    return { id, blob, foto };
  } catch {
    return null;
  }
}

export function blobABase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      const match = url.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
      if (!match) {
        reject(new Error('Unsupported image format'));
        return;
      }
      resolve({ media_type: match[1], data: match[2] });
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'));
    reader.readAsDataURL(blob);
  });
}

/** Redimensiona un `<video>` o `HTMLImageElement` a JPEG (máx. 640 px) y devuelve `{ blob, foto }`. */
export async function capturarImagenJpeg(fuente, anchoOrigen, altoOrigen) {
  if (!anchoOrigen || !altoOrigen) return null;
  const escala = Math.min(1, 640 / anchoOrigen);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(anchoOrigen * escala));
  canvas.height = Math.max(1, Math.round(altoOrigen * escala));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(fuente, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  const data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
  if (!data || data.length > MAX_CARACTERES_IMAGEN) return null;

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  if (!blob) return null;
  return { blob, foto: { media_type: 'image/jpeg', data } };
}
