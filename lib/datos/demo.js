// Capa cliente para los datos de demo de 60 soles (#4) y la evaluación en vivo del motor (#3).

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { getAstronaut, getReadings, getSymptoms, listAstronauts } from '@/lib/db';
import { guardarFoto } from '@/lib/datos/sintomas';
import { MISION_BASE, SOL_ACTUAL } from '@/lib/demo/generador';
import { reiniciarDemo, sembrarDemo, sincronizarWatch } from '@/lib/demo/sembrar';
import { evaluate } from '@/lib/motor/evaluar';

export { SOL_ACTUAL };

const CLAVE_AVISOS = 'astrovitals:avisos:v1';

/** Siembra los 60 soles en IndexedDB si aún no existen (idempotente). */
export function asegurarDemo() {
  return sembrarDemo({ savePhoto: guardarFoto });
}

/** Carga la noche de hoy desde el reloj simulado (`watch_sim`) y re-evalúa alertas. */
export function accionSincronizarWatch(sol = SOL_ACTUAL, astronautId = 'ana') {
  return sincronizarWatch(sol, astronautId);
}

/** Reinicia la demo completa a su estado inicial de 60 soles. */
export async function accionReiniciarDemo() {
  try {
    localStorage.removeItem(CLAVE_AVISOS);
  } catch {
    /* modo privado */
  }
  return reiniciarDemo({ savePhoto: guardarFoto });
}

const ESTADO_INICIAL = {
  cargando: true,
  astronauta: null,
  tripulacion: [],
  lecturas: [],
  sintomas: [],
  watchSincronizadoHoy: false,
  evaluacion: evaluate([], {}, MISION_BASE.entorno, { sol: SOL_ACTUAL }),
  evaluacionMarcos: evaluate([], {}, MISION_BASE.entorno, { sol: SOL_ACTUAL }),
};

/**
 * Suscripción reactiva al estado del tripulante (IndexedDB + motor de reglas #3).
 * Si la base está vacía, siembra los 60 soles automáticamente.
 */
export function useEstadoMision(astronautId = 'ana', sol = SOL_ACTUAL) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);

  useEffect(() => {
    asegurarDemo().catch((e) => console.error('No se pudo sembrar la demo', e));

    const sub = liveQuery(async () => {
      const [astronauta, tripulacion, lecturas, sintomas, marcos, lecturasMarcos, sintomasMarcos] =
        await Promise.all([
          getAstronaut(astronautId),
          listAstronauts(),
          getReadings(astronautId),
          getSymptoms(astronautId),
          getAstronaut('marcos'),
          getReadings('marcos'),
          getSymptoms('marcos'),
        ]);

      const evaluacion = evaluate(
        lecturas,
        astronauta?.baseline || {},
        MISION_BASE.entorno,
        { symptoms: sintomas, sol },
      );

      const evaluacionMarcos = evaluate(
        lecturasMarcos,
        marcos?.baseline || {},
        MISION_BASE.entorno,
        { symptoms: sintomasMarcos, sol },
      );

      const watchSincronizadoHoy = lecturas.some(
        (r) => r.sol === sol && r.source === 'watch_sim',
      );

      return {
        cargando: false,
        astronauta: astronauta || null,
        tripulacion,
        lecturas,
        sintomas,
        watchSincronizadoHoy,
        evaluacion,
        evaluacionMarcos,
      };
    }).subscribe({
      next: setEstado,
      error: (e) => console.error('Error al leer estado de misión', e),
    });

    return () => sub.unsubscribe();
  }, [astronautId, sol]);

  return estado;
}
