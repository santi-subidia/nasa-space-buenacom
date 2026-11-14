// Ejercicio del día. La racha de la misión llega hasta ayer (mock, #4); hoy suma un día
// en cuanto hay ejercicio registrado (por ejemplo desde el Entrenador).

/** Minutos de ejercicio registrados en un sol (lecturas `exercise_min`). */
export function minutosHoy(lecturas, sol) {
  return lecturas.filter((l) => l.indicator === 'exercise_min' && l.sol === sol).reduce((s, l) => s + l.value, 0);
}
