// Capa cliente reactiva 100% respaldada por base de datos (IndexedDB + sincronización bidireccional con Supabase).

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import {
  getCabinTelemetry,
  getDb,
  getMissionState,
  getReadings,
  getSymptoms,
  listAstronauts,
  replaceAlerts,
  saveCabinTelemetry,
  saveMissionState,
} from '@/lib/db';
import { guardarFoto } from '@/lib/datos/sintomas';
import { leerTripulanteActivo, useTripulanteActivo } from '@/lib/datos/tripulante';
import { FOTO_DEMO_SVG, MISION_BASE, SOL_ACTUAL } from '@/lib/demo/generador';
import { asegurarCabinaYMision, reiniciarDemo, sembrarDemo, sincronizarWatch } from '@/lib/demo/sembrar';
import { evaluate } from '@/lib/motor/evaluar';
import {
  hidratarTodoDesdeSupabase,
  sincronizarCabinaRemota,
  sincronizarEstadoMisionRemoto,
} from '@/lib/supabase/sincronizar';

export { SOL_ACTUAL };

const CLAVE_AVISOS = 'astrovitals:avisos:v1';

let hidratacionPromise = null;

/**
 * Inicializa la base de datos local desde Supabase (si hay credenciales y red)
 * y completa la siembra base en IndexedDB si aún está vacía.
 */
export async function asegurarDemo({ forzarSupabase = false } = {}) {
  if (hidratacionPromise && !forzarSupabase) return hidratacionPromise;

  const ejecutar = async () => {
    const db = getDb();

    // 1. Intentamos hidratar desde Supabase (fuente cloud real).
    const remoto = typeof window !== 'undefined' ? await hidratarTodoDesdeSupabase() : null;
    if (remoto && (remoto.astronauts?.length > 0 || remoto.readings?.length > 0)) {
      const localesExistentes = await getReadings('ana');
      const tieneHistoriaCompleta = localesExistentes.length >= 600;

      // Si IndexedDB todavía no tiene los soles históricos locales o Supabase trae datos nuevos, fusionamos sin destruir.
      if (!tieneHistoriaCompleta && remoto.readings.length < 700) {
        await sembrarDemo({ savePhoto: guardarFoto });
      }

      if (remoto.astronauts?.length) {
        for (const a of remoto.astronauts) {
          const prev = await db.astronauts.get(a.id);
          await db.astronauts.put({ ...prev, ...a });
        }
      }
      if (remoto.readings?.length) {
        // Conservamos `sol`/`note`/`meta` locales si el esquema remoto aún no tiene esas columnas.
        const prevMap = new Map((await db.readings.toArray()).map((r) => [r.id, r]));
        const fusionadas = remoto.readings.map((r) => {
          const prev = prevMap.get(r.id);
          return {
            ...prev,
            ...r,
            sol: r.sol ?? prev?.sol ?? undefined,
            note: r.note ?? prev?.note ?? undefined,
            meta: r.meta ?? prev?.meta ?? undefined,
          };
        });
        await db.readings.bulkPut(fusionadas);
      }
      if (remoto.symptoms?.length) {
        const prevSymMap = new Map((await db.symptoms.toArray()).map((s) => [s.id, s]));
        const sintomasFusionados = [];
        for (const s of remoto.symptoms) {
          const prev = prevSymMap.get(s.id);
          let photoBlobId = s.photoBlobId ?? prev?.photoBlobId;
          if (s.code === 'cold_sore' && !photoBlobId && typeof Blob !== 'undefined') {
            try {
              photoBlobId = await guardarFoto(new Blob([FOTO_DEMO_SVG], { type: 'image/svg+xml' }));
            } catch {
              /* sin blob */
            }
          }
          sintomasFusionados.push({
            ...prev,
            ...s,
            sol: s.sol ?? prev?.sol ?? undefined,
            ...(photoBlobId ? { photoBlobId } : {}),
          });
        }
        await db.symptoms.bulkPut(sintomasFusionados);
      }
      if (remoto.aiResults?.length) {
        await db.aiResults.bulkPut(remoto.aiResults);
      }
      if (remoto.tasks?.length) {
        await db.tasks.bulkPut(remoto.tasks);
      }
      if (remoto.cabinTelemetry?.length) {
        await db.cabinTelemetry.bulkPut(remoto.cabinTelemetry);
      }
      if (remoto.notifications?.length) {
        await db.notifications.bulkPut(remoto.notifications);
      }
      if (remoto.missionState) {
        await db.missionState.put(remoto.missionState);
      }

      await asegurarCabinaYMision({ syncRemote: false });

      const estadoFinal = await getMissionState();
      const solEvaluar = estadoFinal?.solActual ?? SOL_ACTUAL;
      const trip = await listAstronauts();
      for (const a of trip) {
        const [r, s] = await Promise.all([getReadings(a.id), getSymptoms(a.id)]);
        const ev = evaluate(r, a.baseline || {}, estadoFinal?.entorno || MISION_BASE.entorno, {
          symptoms: s,
          sol: solEvaluar,
        });
        await replaceAlerts(a.id, ev.alerts);
      }
      return { seeded: true, fuente: 'supabase', readings: remoto.readings.length };
    }

    // 2. Modo offline / sin credenciales Supabase: semilla local en IndexedDB.
    return sembrarDemo({ savePhoto: guardarFoto });
  };

  hidratacionPromise = ejecutar().catch((err) => {
    hidratacionPromise = null;
    throw err;
  });
  return hidratacionPromise;
}

/** Carga la noche de hoy desde el reloj simulado (`watch_sim`) y re-evalúa alertas. */
export async function accionSincronizarWatch(sol, astronautId = leerTripulanteActivo()) {
  const estado = await getMissionState();
  return sincronizarWatch(sol ?? estado?.solActual ?? SOL_ACTUAL, astronautId);
}

/** Reinicia la demo completa a su estado inicial de 60 soles en IndexedDB y actualiza estado/cabina en Supabase. */
export async function accionReiniciarDemo() {
  try {
    localStorage.removeItem(CLAVE_AVISOS);
    localStorage.removeItem('astrovitals:reloj-mision:v1');
    localStorage.removeItem('astrovitals:jornada-hechas:v1');
    localStorage.removeItem('astrovitals:enlace-tierra:v1');
    localStorage.removeItem('astrovitals:notificaciones:v1');
    localStorage.removeItem('astrovitals:cabina:v1');
  } catch {
    /* modo privado */
  }
  hidratacionPromise = null;
  const res = await reiniciarDemo({ savePhoto: guardarFoto });
  const estado = await saveMissionState({
    id: 'ares-iv',
    missionName: MISION_BASE.nombre,
    entorno: MISION_BASE.entorno,
    solActual: SOL_ACTUAL,
    totalSoles: MISION_BASE.totalSoles,
    minutos: 390,
    diaSemana: 'jueves',
    pausado: true,
    acelerado: true,
  });
  const cab = await getCabinTelemetry();
  if (typeof window !== 'undefined') {
    await Promise.allSettled([
      sincronizarEstadoMisionRemoto(estado),
      sincronizarCabinaRemota(cab),
    ]);
  }
  return res;
}

const ESTADO_INICIAL = {
  cargando: true,
  activoId: 'ana',
  solActual: SOL_ACTUAL,
  mision: {
    id: 'ares-iv',
    missionName: MISION_BASE.nombre,
    entorno: MISION_BASE.entorno,
    solActual: SOL_ACTUAL,
    totalSoles: MISION_BASE.totalSoles,
  },
  cabina: null,
  cabinaSerie: [],
  astronauta: null,
  tripulacion: [],
  lecturas: [],
  sintomas: [],
  watchSincronizadoHoy: false,
  evaluacion: evaluate([], {}, MISION_BASE.entorno, { sol: SOL_ACTUAL }),
  evaluacionAna: evaluate([], {}, MISION_BASE.entorno, { sol: SOL_ACTUAL }),
  evaluacionMarcos: evaluate([], {}, MISION_BASE.entorno, { sol: SOL_ACTUAL }),
};

/**
 * Suscripción reactiva 100% respaldada por la base de datos (IndexedDB + Supabase sync).
 * Si no se pasa `explicitId`, sigue al tripulante activo (`useTripulanteActivo`).
 * Si `solExplicito` es null, toma el `solActual` vivo desde la tabla `missionState` de la BD.
 */
export function useEstadoMision(explicitId = null, solExplicito = null) {
  const tripulanteActivo = useTripulanteActivo();
  const astronautId = explicitId || tripulanteActivo;
  const [estado, setEstado] = useState(ESTADO_INICIAL);

  useEffect(() => {
    asegurarDemo().catch((e) => console.error('No se pudieron inicializar los datos de la BD', e));

    const sub = liveQuery(async () => {
      const [missionDb, cabDb, tripulacionDb, rAnaDb, sAnaDb, rMarcosDb, sMarcosDb] = await Promise.all([
        getMissionState(),
        getCabinTelemetry(),
        listAstronauts(),
        getReadings('ana'),
        getSymptoms('ana'),
        getReadings('marcos'),
        getSymptoms('marcos'),
      ]);

      const mision = missionDb ?? {
        id: 'ares-iv',
        missionName: MISION_BASE.nombre,
        entorno: MISION_BASE.entorno,
        solActual: SOL_ACTUAL,
        totalSoles: MISION_BASE.totalSoles,
      };
      const sol = Number.isInteger(solExplicito) ? solExplicito : mision.solActual ?? SOL_ACTUAL;
      const entorno = mision.entorno ?? MISION_BASE.entorno;

      const tripulacion = tripulacionDb;
      const astronauta = tripulacion.find((t) => t.id === astronautId) ?? null;
      const anaDb = tripulacion.find((t) => t.id === 'ana') ?? null;
      const marcosDb = tripulacion.find((t) => t.id === 'marcos') ?? null;

      const lecturas =
        astronautId === 'ana'
          ? rAnaDb
          : astronautId === 'marcos'
            ? rMarcosDb
            : await getReadings(astronautId);
      const sintomas =
        astronautId === 'ana'
          ? sAnaDb
          : astronautId === 'marcos'
            ? sMarcosDb
            : await getSymptoms(astronautId);

      const evaluacion = evaluate(lecturas, astronauta?.baseline || {}, entorno, {
        symptoms: sintomas,
        sol,
      });

      const evaluacionAna = evaluate(rAnaDb, anaDb?.baseline || {}, entorno, {
        symptoms: sAnaDb,
        sol,
      });

      const evaluacionMarcos = evaluate(rMarcosDb, marcosDb?.baseline || {}, entorno, {
        symptoms: sMarcosDb,
        sol,
      });

      const watchSincronizadoHoy = lecturas.some(
        (r) => r.sol === sol && r.source === 'watch_sim',
      );

      const cabina =
        cabDb.filter((c) => c.sol <= sol).sort((a, b) => a.sol - b.sol).at(-1) ?? null;

      return {
        cargando: false,
        activoId: astronautId,
        solActual: sol,
        mision,
        cabina,
        cabinaSerie: cabDb,
        astronauta,
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
      error: (e) => console.error('Error al leer estado de misión desde BD', e),
    });

    return () => sub.unsubscribe();
  }, [astronautId, solExplicito]);

  return estado;
}
