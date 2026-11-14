// Estado cliente del Enlace con Tierra (issue #17).
// Persiste la simulación de retraso en `localStorage` con `useSyncExternalStore`,
// lee el informe técnico más reciente de la Junta (`findAiResult('board')`) y
// crea los recordatorios médicos en IndexedDB (`getTasks`/`saveTasks`).

import { useEffect, useSyncExternalStore } from 'react';
import { findAiResult, getTasks, saveTasks } from '@/lib/db';
import { leerTripulanteActivo } from '@/lib/datos/tripulante';
import {
  armarInformeParaTierra,
  construirRecordatoriosDeRespuesta,
  DURACION_TOTAL_MIN,
  INFORME_TECNICO_RESPALDO_SOL42,
} from '@/lib/enlace/logicaEnlace';

export const CLAVE_ENLACE = 'astrovitals:enlace-tierra:v1';

const ESTADO_SERVIDOR = Object.freeze({
  iniciado: false,
  minutosTranscurridos: null,
  autoAvance: false,
  recordatoriosCreados: false,
  informe: INFORME_TECNICO_RESPALDO_SOL42,
});

let cache = null;
const oyentes = new Set();

function normalizarEstado(valor) {
  if (!valor || typeof valor !== 'object') return { ...ESTADO_SERVIDOR };
  const minutos =
    valor.minutosTranscurridos === null || valor.minutosTranscurridos === undefined
      ? null
      : Number(valor.minutosTranscurridos);
  return {
    iniciado: Boolean(valor.iniciado),
    minutosTranscurridos: Number.isFinite(minutos) ? minutos : null,
    autoAvance: Boolean(valor.autoAvance),
    recordatoriosCreados: Boolean(valor.recordatoriosCreados),
    informe: valor.informe?.resumen ? valor.informe : INFORME_TECNICO_RESPALDO_SOL42,
  };
}

function cargar() {
  if (typeof window === 'undefined') return ESTADO_SERVIDOR;
  if (cache) return cache;
  try {
    const crudo = localStorage.getItem(CLAVE_ENLACE);
    cache = crudo ? normalizarEstado(JSON.parse(crudo)) : { ...ESTADO_SERVIDOR };
  } catch {
    cache = { ...ESTADO_SERVIDOR };
  }
  return cache;
}

function guardar(siguiente) {
  const normalizado = normalizarEstado(siguiente);
  cache = normalizado;
  try {
    localStorage.setItem(CLAVE_ENLACE, JSON.stringify(normalizado));
  } catch {
    /* modo privado: queda en memoria */
  }
  oyentes.forEach((f) => f());
  return normalizado;
}

function suscribir(avisar) {
  oyentes.add(avisar);
  const enOtraPestana = (e) => {
    if (e.key === CLAVE_ENLACE) {
      cache = null;
      avisar();
    }
  };
  window.addEventListener('storage', enOtraPestana);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener('storage', enOtraPestana);
  };
}

export function leerEstadoEnlace() {
  return cargar();
}

/** Inicia la transmisión del informe técnico desde Base Marte hacia Houston (t = 0 min). */
export function enviarInformeAhora() {
  const actual = cargar();
  return guardar({
    ...actual,
    iniciado: true,
    minutosTranscurridos: 0,
  });
}

/** Avanza la transmisión simulada en `deltaMin` minutos (acotado al máximo ida y vuelta). */
export function avanzarTransmision(deltaMin = 5) {
  const actual = cargar();
  const base = actual.iniciado && actual.minutosTranscurridos != null ? actual.minutosTranscurridos : 0;
  const siguienteMin = Math.max(0, Math.min(DURACION_TOTAL_MIN, base + Number(deltaMin || 0)));
  const completado = siguienteMin >= DURACION_TOTAL_MIN;
  return guardar({
    ...actual,
    iniciado: true,
    minutosTranscurridos: siguienteMin,
    autoAvance: completado ? false : actual.autoAvance,
  });
}

/**
 * Si hay una transmisión en curso hacia Tierra, la hace avanzar según el reloj de misión.
 */
export function avanzarTransmisionSiActiva(deltaMin = 1) {
  if (typeof window === 'undefined' || Number(deltaMin) <= 0) return null;
  const actual = cargar();
  if (!actual.iniciado) return actual;
  if ((actual.minutosTranscurridos ?? 0) >= DURACION_TOTAL_MIN) return actual;
  return avanzarTransmision(deltaMin);
}

/** Activa o pausa el avance automático segundo a segundo (1 s real = 1 min simulado). */
export function alternarAutoAvance() {
  const actual = cargar();
  const activar = !actual.autoAvance;
  const yaCompleto = (actual.minutosTranscurridos ?? -1) >= DURACION_TOTAL_MIN;
  if (activar && yaCompleto) return actual;
  return guardar({
    ...actual,
    iniciado: activar ? true : actual.iniciado,
    minutosTranscurridos: activar && actual.minutosTranscurridos == null ? 0 : actual.minutosTranscurridos,
    autoAvance: activar,
  });
}

/** Reinicia la simulación del enlace con Tierra manteniendo el informe técnico cargado. */
export function reiniciarEnlace() {
  const actual = cargar();
  return guardar({
    ...ESTADO_SERVIDOR,
    informe: actual.informe ?? INFORME_TECNICO_RESPALDO_SOL42,
  });
}

/** Consulta la última Junta médica guardada en IndexedDB y actualiza el informe si existe. */
export async function sincronizarInformeDesdeJunta() {
  try {
    const ultimoBoard = await findAiResult('board');
    const informe = armarInformeParaTierra(ultimoBoard);
    const actual = cargar();
    if (
      actual.informe?.resumen !== informe.resumen ||
      actual.informe?.origen !== informe.origen ||
      actual.informe?.ts !== informe.ts
    ) {
      return guardar({ ...actual, informe });
    }
    return actual;
  } catch {
    return cargar();
  }
}

/**
 * Crea en IndexedDB los 3 recordatorios indicados por Houston evitando duplicar títulos existentes.
 */
export async function crearRecordatoriosEnJornada(astronautId = leerTripulanteActivo()) {
  const actual = cargar();
  const sol = actual.informe?.sol ?? 42;
  const candidatas = construirRecordatoriosDeRespuesta(astronautId, sol);
  const existentes = await getTasks(astronautId);
  const titulosExistentes = new Set(existentes.map((t) => t.title.trim().toLowerCase()));
  const nuevas = candidatas.filter((t) => !titulosExistentes.has(t.title.trim().toLowerCase()));

  if (nuevas.length > 0) {
    await saveTasks(nuevas);
  }

  guardar({
    ...actual,
    recordatoriosCreados: true,
  });

  return {
    creadas: nuevas.length,
    total: candidatas.length,
    yaExistian: candidatas.length - nuevas.length,
  };
}

/** Hook reactivo para la pantalla `/enlace`. */
export function useEnlace() {
  const estado = useSyncExternalStore(suscribir, cargar, () => ESTADO_SERVIDOR);

  useEffect(() => {
    sincronizarInformeDesdeJunta();
  }, []);

  useEffect(() => {
    if (!estado.autoAvance || !estado.iniciado) return undefined;
    if ((estado.minutosTranscurridos ?? 0) >= DURACION_TOTAL_MIN) return undefined;

    const id = setInterval(() => {
      avanzarTransmision(1);
    }, 1000);
    return () => clearInterval(id);
  }, [estado.autoAvance, estado.iniciado, estado.minutosTranscurridos]);

  return estado;
}
