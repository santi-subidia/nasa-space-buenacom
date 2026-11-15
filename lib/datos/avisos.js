// Avisos al oficial médico (desde Vega, Junta médica, Cara, etc.). Almacén provisorio en localStorage:
// lo leen las notificaciones (#12) y el enlace con Tierra (#17).
//
// Aviso { nivel: 'alta'|'critica', categoria, motivo, origen: 'vega'|…, ts }

import { useSyncExternalStore } from 'react';
import { leerTripulanteActivo } from '@/lib/datos/tripulante';

const CLAVE = 'astrovitals:avisos:v1';
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

export function guardarAviso(aviso) {
  const actualizados = [
    ...cargar(),
    {
      id: `${Date.now()}`,
      ts: new Date().toISOString(),
      astronautId: aviso?.astronautId ?? leerTripulanteActivo(),
      ...aviso,
    },
  ];
  cache = actualizados;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actualizados));
  } catch {
    /* modo privado: queda solo en memoria */
  }
  oyentes.forEach((f) => f());
}

/** Avisos guardados (se actualiza solo cuando se agrega uno). */
export const useAvisos = () => useSyncExternalStore(suscribir, cargar, () => VACIO);
