// Racha real y minutos de ejercicio del día calculados directamente desde las lecturas de la BD.

import { rachaEjercicioDesdeLecturas } from '../datos/indicadores.js';

/** Minutos de ejercicio registrados en un sol (lecturas `exercise_min`). */
export function minutosHoy(lecturas, sol) {
  return lecturas.filter((l) => l.indicator === 'exercise_min' && l.sol === sol).reduce((s, l) => s + l.value, 0);
}

/** Racha de soles consecutivos cumpliendo ejercicio (>= 20 min) según las lecturas guardadas en la BD. */
export function rachaEjercicio(lecturas = [], solActual = 42) {
  return rachaEjercicioDesdeLecturas(lecturas, solActual, 20);
}
