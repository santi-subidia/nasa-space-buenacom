// Almacén PROVISORIO en localStorage (una lista por clave). Se reemplaza por #2 (modelo de datos).
// `useItems()` se actualiza solo cuando otra pantalla (u otra pestaña) agrega datos.

import { useSyncExternalStore } from 'react';

export function crearAlmacen(clave) {
  const VACIO = [];
  let cache = null;
  const oyentes = new Set();

  function cargar() {
    if (cache) return cache;
    try {
      cache = JSON.parse(localStorage.getItem(clave) || '[]');
    } catch {
      cache = [];
    }
    return cache;
  }

  function persistir(items) {
    cache = items;
    try {
      localStorage.setItem(clave, JSON.stringify(items));
    } catch {
      // sin almacenamiento (modo privado): queda solo en memoria
    }
    oyentes.forEach((f) => f());
  }

  function suscribir(avisar) {
    oyentes.add(avisar);
    const enOtraPestana = (e) => {
      if (e.key === clave) {
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

  return {
    agregar: (nuevos) => persistir([...cargar(), ...nuevos]),
    borrar: () => persistir([]),
    useItems: () => useSyncExternalStore(suscribir, cargar, () => VACIO),
  };
}
