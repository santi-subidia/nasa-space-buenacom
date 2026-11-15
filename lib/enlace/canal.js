import { getDb } from '../db.js';
import { publicarTransmisionEnlaceRemota, listarTransmisionesEnlaceRemotas } from '../supabase/sincronizar.js';

const sincronizaciones = new Map();

export async function guardarEnvioCanal(transmision) {
  await getDb().transmisionesEnlace.add(transmision);
  return transmision;
}

/** Sincroniza por tripulante. Los envíos pendientes se reintentan con su id original. */
export function sincronizarCanal(astronautId) {
  if (sincronizaciones.has(astronautId)) return sincronizaciones.get(astronautId);
  const tarea = sincronizar(astronautId).finally(() => sincronizaciones.delete(astronautId));
  sincronizaciones.set(astronautId, tarea);
  return tarea;
}

async function sincronizar(astronautId) {
  const tabla = getDb().transmisionesEnlace;
  const locales = await tabla.where('astronaut_id').equals(astronautId).toArray();
  for (const envio of locales.filter((l) => l.sincronizacion === 'pendiente')) {
    const remoto = await publicarTransmisionEnlaceRemota(envio);
    if (remoto) await tabla.put({ ...remoto, sincronizacion: 'enviado' });
  }
  const resultado = await listarTransmisionesEnlaceRemotas({ astronautId, incluirRespaldo: false });
  if (resultado.ok) {
    await tabla.bulkPut(resultado.datos.map((remoto) => ({ ...remoto, sincronizacion: 'enviado' })));
  }
  return resultado;
}
