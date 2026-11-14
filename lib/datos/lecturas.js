// Almacén PROVISORIO de lecturas (localStorage) para que Registrar → Inicio funcione ya.
// Se reemplaza por el modelo de datos y almacenamiento de #2 manteniendo estas tres funciones.
//
// Reading { id, astronautId, indicator, value, unit, ts, sol, source: 'manual'|'voice'|'watch_sim'|'camera' }

import { useSyncExternalStore } from 'react';

const CLAVE = 'astrovitals:lecturas:v1';
const VACIO = [];
let cache = null;
const oyentes = new Set();

function cargar() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(CLAVE) || '[]');
  } catch {
    cache = [];
  }
  return cache;
}

function persistir(lecturas) {
  cache = lecturas;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lecturas));
  } catch {
    // sin almacenamiento (modo privado): queda solo en memoria
  }
  oyentes.forEach((f) => f());
}

export function guardarLecturas(nuevas) {
  const ahora = new Date().toISOString();
  const conId = nuevas.map((l, i) => ({
    id: `${Date.now()}-${i}`,
    astronautId: 'ana',
    ts: ahora,
    source: 'manual',
    ...l,
  }));
  persistir([...cargar(), ...conId]);
  return conId;
}

export function borrarLecturas() {
  persistir([]);
}

function suscribir(avisar) {
  oyentes.add(avisar);
  const enOtraPestana = (e) => {
    if (e.key === CLAVE) {
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

/** Lecturas guardadas (se actualiza solo cuando otra pantalla guarda). */
export function useLecturas() {
  return useSyncExternalStore(suscribir, cargar, () => VACIO);
}
