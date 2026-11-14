// Estado persistente del tripulante activo y permisos de privacidad con el oficial médico (issue #10).
// Usa `localStorage` + `useSyncExternalStore` con sincronización entre pestañas y suscriptores locales.

import { useSyncExternalStore } from 'react';
import { TRIPULANTES } from '@/lib/demo/generador';
import {
  CLAVE_PERMISOS_CMO,
  CLAVE_TRIPULANTE_ACTIVO,
  PERMISOS_DEFECTO,
  TRIPULANTE_DEFECTO,
} from '@/lib/tripulacion/logicaTripulante';

const IDS_VALIDOS = new Set(TRIPULANTES.map((t) => t.id));

let cacheActivo = null;
let cachePermisos = null;
const oyentesActivo = new Set();
const oyentesPermisos = new Set();
let escuchandoStorage = false;

function normalizarActivo(valor) {
  return typeof valor === 'string' && IDS_VALIDOS.has(valor) ? valor : TRIPULANTE_DEFECTO;
}

function normalizarPermisos(raw) {
  const base = { ...PERMISOS_DEFECTO };
  if (raw && typeof raw === 'object') {
    for (const id of IDS_VALIDOS) {
      if (id in raw) base[id] = Boolean(raw[id]);
    }
  }
  return base;
}

function asegurarListenerStorage() {
  if (escuchandoStorage || typeof window === 'undefined') return;
  escuchandoStorage = true;
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === CLAVE_TRIPULANTE_ACTIVO) {
      cacheActivo = null;
      oyentesActivo.forEach((f) => f());
    }
    if (e.key === null || e.key === CLAVE_PERMISOS_CMO) {
      cachePermisos = null;
      oyentesPermisos.forEach((f) => f());
    }
  });
}

function cargarActivo() {
  if (typeof window === 'undefined') return TRIPULANTE_DEFECTO;
  if (cacheActivo !== null) return cacheActivo;
  try {
    cacheActivo = normalizarActivo(localStorage.getItem(CLAVE_TRIPULANTE_ACTIVO));
  } catch {
    cacheActivo = TRIPULANTE_DEFECTO;
  }
  return cacheActivo;
}

function cargarPermisos() {
  if (typeof window === 'undefined') return PERMISOS_DEFECTO;
  if (cachePermisos !== null) return cachePermisos;
  try {
    const texto = localStorage.getItem(CLAVE_PERMISOS_CMO);
    cachePermisos = texto ? normalizarPermisos(JSON.parse(texto)) : PERMISOS_DEFECTO;
  } catch {
    cachePermisos = PERMISOS_DEFECTO;
  }
  return cachePermisos;
}

function suscribirActivo(avisar) {
  asegurarListenerStorage();
  oyentesActivo.add(avisar);
  return () => {
    oyentesActivo.delete(avisar);
  };
}

function suscribirPermisos(avisar) {
  asegurarListenerStorage();
  oyentesPermisos.add(avisar);
  return () => {
    oyentesPermisos.delete(avisar);
  };
}

/** Devuelve el id del tripulante activo ('ana' o 'marcos'). */
export function leerTripulanteActivo() {
  return cargarActivo();
}

/** Cambia el tripulante activo y notifica a los suscriptores locales. */
export function cambiarTripulanteActivo(id) {
  const siguiente = normalizarActivo(id);
  cacheActivo = siguiente;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CLAVE_TRIPULANTE_ACTIVO, siguiente);
    } catch {
      /* modo privado: queda solo en memoria */
    }
  }
  oyentesActivo.forEach((f) => f());
  return siguiente;
}

/** Suscripción reactiva al tripulante activo. */
export function useTripulanteActivo() {
  return useSyncExternalStore(suscribirActivo, cargarActivo, () => TRIPULANTE_DEFECTO);
}

/** Devuelve si un tripulante comparte sus mediciones detalladas con el CMO. */
export function leerPermisoCompartir(id) {
  const permisos = cargarPermisos();
  return Boolean(permisos[id]);
}

/** Actualiza el permiso de compartir mediciones detalladas con el CMO para `id`. */
export function cambiarPermisoCompartir(id, valor) {
  const actuales = cargarPermisos();
  const siguiente = normalizarPermisos({ ...actuales, [id]: Boolean(valor) });
  cachePermisos = siguiente;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CLAVE_PERMISOS_CMO, JSON.stringify(siguiente));
    } catch {
      /* modo privado: queda solo en memoria */
    }
  }
  oyentesPermisos.forEach((f) => f());
  return siguiente[id];
}

/** Suscripción reactiva al mapa de permisos de compartir con el CMO. */
export function usePermisosCompartir() {
  return useSyncExternalStore(suscribirPermisos, cargarPermisos, () => PERMISOS_DEFECTO);
}
