// Capa cliente para los datos de demo de 60 soles (#4) y la evaluación en vivo del motor (#3).

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { getAstronaut, getReadings, getSymptoms, listAstronauts } from '@/lib/db';
import { guardarFoto } from '@/lib/datos/sintomas';
import { leerTripulanteActivo, useTripulanteActivo } from '@/lib/datos/tripulante';
import { MISION_BASE, SOL_ACTUAL, TRIPULANTES } from '@/lib/demo/generador';
import { DEMO_DATA, reiniciarDemo, sembrarDemo, sincronizarWatch } from '@/lib/demo/sembrar';
import { evaluate } from '@/lib/motor/evaluar';

export { SOL_ACTUAL };

const CLAVE_AVISOS = 'astrovitals:avisos:v1';

/** Siembra los 60 soles en IndexedDB si aún no existen (idempotente). */
export function asegurarDemo() {
  return sembrarDemo({ savePhoto: guardarFoto });
}

/** Carga la noche de hoy desde el reloj simulado (`watch_sim`) y re-evalúa alertas. */
export function accionSincronizarWatch(sol = SOL_ACTUAL, astronautId = leerTripulanteActivo()) {
  return sincronizarWatch(sol, astronautId);
}

/** Reinicia la demo completa a su estado inicial de 60 soles. */
export async function accionReiniciarDemo() {
  try {
    localStorage.removeItem(CLAVE_AVISOS);
    localStorage.removeItem('astrovitals:reloj-mision:v1');
    localStorage.removeItem('astrovitals:jornada-hechas:v1');
    localStorage.removeItem('astrovitals:enlace-tierra:v1');
  } catch {
    /* modo privado */
  }
  return reiniciarDemo({ savePhoto: guardarFoto });
}

const ESTADO_INICIAL = {
  cargando: true,
  activoId: 'ana',
  astronauta: TRIPULANTES[0],
  tripulacion: TRIPULANTES,
  lecturas: [],
  sintomas: [],
  watchSincronizadoHoy: false,
  evaluacion: evaluate([], {}, MISION_BASE.entorno, { sol: SOL_ACTUAL }),
  evaluacionAna: evaluate([], {}, MISION_BASE.entorno, { sol: SOL_ACTUAL }),
  evaluacionMarcos: evaluate([], {}, MISION_BASE.entorno, { sol: SOL_ACTUAL }),
};

/**
 * Suscripción reactiva al estado del tripulante (IndexedDB + motor de reglas #3).
 * Si no se pasa `explicitId`, sigue al tripulante activo (`useTripulanteActivo`).
 */
export function useEstadoMision(explicitId = null, sol = SOL_ACTUAL) {
  const tripulanteActivo = useTripulanteActivo();
  const astronautId = explicitId || tripulanteActivo;
  const [estado, setEstado] = useState(ESTADO_INICIAL);

  useEffect(() => {
    asegurarDemo().catch((e) => console.error('No se pudo sembrar la demo', e));

    const sub = liveQuery(async () => {
      const [astronauta, tripulacionDb, lecturasDb, sintomasDb, anaDb, rAnaDb, sAnaDb, marcosDb, rMarcosDb, sMarcosDb] =
        await Promise.all([
          getAstronaut(astronautId),
          listAstronauts(),
          getReadings(astronautId),
          getSymptoms(astronautId),
          getAstronaut('ana'),
          getReadings('ana'),
          getSymptoms('ana'),
          getAstronaut('marcos'),
          getReadings('marcos'),
          getSymptoms('marcos'),
        ]);

      const tripulacion = tripulacionDb.length > 0 ? tripulacionDb : TRIPULANTES;
      const metaActivo = TRIPULANTES.find((t) => t.id === astronautId) || TRIPULANTES[0];

      const lecturas =
        lecturasDb.length > 0
          ? lecturasDb
          : DEMO_DATA.readings.filter((r) => r.astronautId === astronautId);
      const sintomas =
        lecturasDb.length > 0
          ? sintomasDb
          : DEMO_DATA.symptoms.filter((s) => s.astronautId === astronautId);

      const evaluacion = evaluate(
        lecturas,
        astronauta?.baseline || metaActivo.baseline || {},
        MISION_BASE.entorno,
        { symptoms: sintomas, sol },
      );

      const lecturasAna = rAnaDb.length > 0 ? rAnaDb : DEMO_DATA.readings.filter((r) => r.astronautId === 'ana');
      const sintomasAna = rAnaDb.length > 0 ? sAnaDb : DEMO_DATA.symptoms.filter((s) => s.astronautId === 'ana');
      const evaluacionAna = evaluate(
        lecturasAna,
        anaDb?.baseline || TRIPULANTES[0].baseline || {},
        MISION_BASE.entorno,
        { symptoms: sintomasAna, sol },
      );

      const lecturasMarcos = rMarcosDb.length > 0 ? rMarcosDb : DEMO_DATA.readings.filter((r) => r.astronautId === 'marcos');
      const evaluacionMarcos = evaluate(
        lecturasMarcos,
        marcosDb?.baseline || TRIPULANTES[1].baseline || {},
        MISION_BASE.entorno,
        { symptoms: sMarcosDb, sol },
      );

      const watchSincronizadoHoy = lecturas.some(
        (r) => r.sol === sol && r.source === 'watch_sim',
      );

      return {
        cargando: false,
        activoId: astronautId,
        astronauta: astronauta || metaActivo,
        tripulacion,
        lecturas,
        sintomas,
        watchSincronizadoHoy,
        evaluacion,
        evaluacionAna,
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
