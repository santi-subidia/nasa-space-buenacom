// Cliente reactivo para el reloj de misión marciano y la jornada del astronauta (#11).

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';
import { SOL_ACTUAL, useEstadoMision } from '@/lib/datos/demo';
import { avanzarTransmisionSiActiva } from '@/lib/datos/enlace';
import { useTripulanteActivo } from '@/lib/datos/tripulante';
import { getTasks, setTaskDone } from '@/lib/db';
import {
  DIAS_SEMANA,
  avanzarTiempoMision,
  esSuenoProtegido,
  formatearHoraMision,
  generarTareasJornada,
  normalizarMinutosSol,
} from '@/lib/reloj/relojMision';

const CLAVE_RELOJ = 'astrovitals:reloj-mision:v1';
const CLAVE_OVERRIDES = 'astrovitals:jornada-hechas:v1';
const MINUTOS_DESPERTAR = 6 * 60 + 30; // 06:30

const ESTADO_BASE = {
  sol: SOL_ACTUAL,
  minutos: MINUTOS_DESPERTAR,
  pausado: true,
  acelerado: true,
  diaSemana: 'jueves',
};

function enriquecerReloj(estado) {
  const sol = Number.isFinite(estado?.sol) && estado.sol >= 1 ? Math.floor(estado.sol) : SOL_ACTUAL;
  const minutos = normalizarMinutosSol(
    Number.isFinite(estado?.minutos) ? estado.minutos : MINUTOS_DESPERTAR,
  );
  const pausado = estado?.pausado !== undefined ? Boolean(estado.pausado) : true;
  const acelerado = estado?.acelerado !== undefined ? Boolean(estado.acelerado) : true;
  const diaSemana = DIAS_SEMANA.includes(estado?.diaSemana) ? estado.diaSemana : 'jueves';

  return {
    sol,
    minutos,
    pausado,
    acelerado,
    diaSemana,
    horaFormateada: formatearHoraMision(minutos),
    suenoProtegido: esSuenoProtegido(minutos),
  };
}

const SNAPSHOT_SERVIDOR_RELOJ = Object.freeze(enriquecerReloj(ESTADO_BASE));
const SNAPSHOT_SERVIDOR_OVERRIDES = Object.freeze({});

let cacheReloj = null;
const oyentesReloj = new Set();
let intervaloReloj = null;
let intervaloMs = null;

function cargarReloj() {
  if (typeof window === 'undefined') return SNAPSHOT_SERVIDOR_RELOJ;
  if (cacheReloj) return cacheReloj;
  try {
    const crudo = localStorage.getItem(CLAVE_RELOJ);
    cacheReloj = crudo ? enriquecerReloj(JSON.parse(crudo)) : enriquecerReloj(ESTADO_BASE);
  } catch {
    cacheReloj = enriquecerReloj(ESTADO_BASE);
  }
  sincronizarTemporizador();
  return cacheReloj;
}

function persistirReloj(nuevoEstado) {
  const siguiente = enriquecerReloj(nuevoEstado);
  cacheReloj = siguiente;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        CLAVE_RELOJ,
        JSON.stringify({
          sol: siguiente.sol,
          minutos: siguiente.minutos,
          pausado: siguiente.pausado,
          acelerado: siguiente.acelerado,
          diaSemana: siguiente.diaSemana,
        }),
      );
    } catch {
      /* modo privado: queda solo en memoria */
    }
  }
  sincronizarTemporizador();
  oyentesReloj.forEach((f) => f());
  return siguiente;
}

function detenerTemporizador() {
  if (intervaloReloj != null) {
    clearInterval(intervaloReloj);
    intervaloReloj = null;
    intervaloMs = null;
  }
}

function sincronizarTemporizador() {
  if (typeof window === 'undefined') return;
  const actual = cacheReloj;
  if (!actual || actual.pausado || oyentesReloj.size === 0) {
    detenerTemporizador();
    return;
  }
  // Acelerado: 1 min real = 1 h de misión (+1 min misión cada 1 s real).
  // Tiempo real: +1 min misión cada 60 s reales.
  const msNecesarios = actual.acelerado ? 1000 : 60_000;
  if (intervaloReloj != null && intervaloMs === msNecesarios) return;

  detenerTemporizador();
  intervaloMs = msNecesarios;
  intervaloReloj = window.setInterval(() => {
    const ahora = cargarReloj();
    if (ahora.pausado) return;
    const avanzado = avanzarTiempoMision(ahora.sol, ahora.minutos, 1);
    persistirReloj({ ...ahora, ...avanzado });
    avanzarTransmisionSiActiva(1);
  }, msNecesarios);
}

function suscribirReloj(avisar) {
  oyentesReloj.add(avisar);
  cargarReloj();
  sincronizarTemporizador();

  const enOtraPestana = (e) => {
    if (e.key === CLAVE_RELOJ) {
      cacheReloj = null;
      cargarReloj();
      avisar();
    }
  };
  window.addEventListener('storage', enOtraPestana);

  return () => {
    oyentesReloj.delete(avisar);
    window.removeEventListener('storage', enOtraPestana);
    if (oyentesReloj.size === 0) detenerTemporizador();
  };
}

/** Suscripción reactiva al reloj de misión marciano. */
export function useRelojMision() {
  return useSyncExternalStore(suscribirReloj, cargarReloj, () => SNAPSHOT_SERVIDOR_RELOJ);
}

/** Inicia o pausa el avance automático del reloj de misión. */
export function alternarPausa() {
  const actual = cargarReloj();
  return persistirReloj({ ...actual, pausado: !actual.pausado });
}

/** Alterna entre modo acelerado (1 min real = 1 h misión) y tiempo real (1:1). */
export function alternarAcelerado() {
  const actual = cargarReloj();
  return persistirReloj({ ...actual, acelerado: !actual.acelerado });
}

/** Adelanta (o retrocede) el reloj marciano en `delta` minutos con rollover de sol. */
export function adelantarMinutos(delta = 15) {
  const actual = cargarReloj();
  const avanzado = avanzarTiempoMision(actual.sol, actual.minutos, delta);
  const res = persistirReloj({ ...actual, ...avanzado });
  if (Number(delta) > 0) avanzarTransmisionSiActiva(Number(delta));
  return res;
}

/** Fija una hora de misión exacta (y opcionalmente un sol). */
export function fijarHoraMision(min, sol) {
  const actual = cargarReloj();
  return persistirReloj({
    ...actual,
    minutos: normalizarMinutosSol(min),
    ...(Number.isFinite(sol) && sol >= 1 ? { sol: Math.floor(sol) } : {}),
  });
}

/** Cambia el día semanal de prueba para visualizar tareas semanales. */
export function cambiarDiaSemana(diaSemana) {
  const actual = cargarReloj();
  return persistirReloj({ ...actual, diaSemana });
}

/** Reinicia el reloj al despertar del Sol 42 (06:30, pausado, modo acelerado). */
export function reiniciarReloj() {
  return persistirReloj(ESTADO_BASE);
}

// ─── Overrides locales de tareas completadas ───────────────────────────────

let cacheOverrides = null;
const oyentesOverrides = new Set();

function cargarOverrides() {
  if (typeof window === 'undefined') return SNAPSHOT_SERVIDOR_OVERRIDES;
  if (cacheOverrides) return cacheOverrides;
  try {
    const crudo = localStorage.getItem(CLAVE_OVERRIDES);
    const parsed = crudo ? JSON.parse(crudo) : {};
    cacheOverrides = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    cacheOverrides = {};
  }
  return cacheOverrides;
}

function guardarOverrides(mapa) {
  cacheOverrides = mapa;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CLAVE_OVERRIDES, JSON.stringify(mapa));
    } catch {
      /* modo privado */
    }
  }
  oyentesOverrides.forEach((f) => f());
}

function suscribirOverrides(avisar) {
  oyentesOverrides.add(avisar);
  const enOtraPestana = (e) => {
    if (e.key === CLAVE_OVERRIDES) {
      cacheOverrides = null;
      avisar();
    }
  };
  window.addEventListener('storage', enOtraPestana);
  return () => {
    oyentesOverrides.delete(avisar);
    window.removeEventListener('storage', enOtraPestana);
  };
}

function useOverridesJornada() {
  return useSyncExternalStore(
    suscribirOverrides,
    cargarOverrides,
    () => SNAPSHOT_SERVIDOR_OVERRIDES,
  );
}

export function limpiarOverridesJornada() {
  guardarOverrides({});
}

/**
 * Hook principal de la pantalla Jornada: combina reloj marciano, estado clínico del motor,
 * lecturas del día, tareas guardadas en IndexedDB y overrides interactivos locales.
 */
export function useJornada(explicitId = null, sol) {
  const activoId = useTripulanteActivo();
  const astronautId = explicitId || activoId;
  const reloj = useRelojMision();
  const solActivo = Number.isFinite(sol) && sol >= 1 ? Math.floor(sol) : reloj.sol;
  const estadoMision = useEstadoMision(astronautId, solActivo);
  const overrides = useOverridesJornada();
  const [tareasGuardadas, setTareasGuardadas] = useState([]);

  useEffect(() => {
    const sub = liveQuery(() => getTasks(astronautId)).subscribe({
      next: (lista) => setTareasGuardadas(lista || []),
      error: (e) => console.error('Error al leer tareas de jornada', e),
    });
    return () => sub.unsubscribe();
  }, [astronautId]);

  const lecturasHoy = useMemo(
    () => (estadoMision.lecturas || []).filter((r) => r.sol === solActivo),
    [estadoMision.lecturas, solActivo],
  );

  const tareas = useMemo(() => {
    const base = generarTareasJornada({
      astronautId,
      sol: solActivo,
      diaSemana: reloj.diaSemana,
      evaluacion: estadoMision.evaluacion,
      lecturasHoy,
      tareasGuardadas,
    });

    return base.map((t) => {
      if (Object.prototype.hasOwnProperty.call(overrides, t.id)) {
        return { ...t, done: Boolean(overrides[t.id]) };
      }
      return t;
    });
  }, [
    astronautId,
    solActivo,
    reloj.diaSemana,
    estadoMision.evaluacion,
    lecturasHoy,
    tareasGuardadas,
    overrides,
  ]);

  const alternarTarea = useCallback(async (tarea) => {
    if (!tarea?.id) return;
    const siguienteDone = !tarea.done;
    const actuales = cargarOverrides();
    guardarOverrides({ ...actuales, [tarea.id]: siguienteDone });

    const idDb = tarea.dbId || (tarea.guardada ? tarea.id : null);
    if (idDb) {
      try {
        await setTaskDone(idDb, siguienteDone);
      } catch (e) {
        console.error('No se pudo actualizar la tarea en IndexedDB', e);
      }
    }
  }, []);

  const completadas = tareas.filter((t) => t.done).length;
  const total = tareas.length;
  const progresoPct = total > 0 ? Math.round((completadas / total) * 100) : 0;

  return {
    cargando: estadoMision.cargando,
    reloj,
    sol: solActivo,
    diaSemana: reloj.diaSemana,
    astronauta: estadoMision.astronauta,
    evaluacion: estadoMision.evaluacion,
    tareas,
    completadas,
    total,
    progresoPct,
    alternarTarea,
    cambiarDiaSemana,
  };
}
