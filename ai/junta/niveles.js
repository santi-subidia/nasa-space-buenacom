// Niveles del semáforo y la regla que los une: el motor de reglas es determinista y la IA solo puede
// SUBIR el nivel, nunca bajarlo ("¿y si la IA se equivoca?"). Mismos valores que `Level` en
// doc/05-plan/prototipo.md. Si P2 ya tiene un mergeLevel en el motor (#3), este debe comportarse igual.

export const NIVELES = ['green', 'yellow', 'orange', 'red'];

const orden = (nivel) => {
  const i = NIVELES.indexOf(nivel);
  if (i === -1) throw new Error(`Nivel desconocido "${nivel}". Válidos: ${NIVELES.join(', ')}`);
  return i;
};

export const esNivel = (nivel) => NIVELES.includes(nivel);

/** El nivel más alto de la lista (el estado de una zona es el máximo de sus indicadores y alertas). */
export const maxNivel = (niveles) => niveles.reduce((a, b) => (orden(b) > orden(a) ? b : a), 'green');

/**
 * Nivel final = el más alto entre el motor y la junta: la junta nunca baja lo que decidió el motor.
 * Si la junta no dio nivel, manda el motor.
 */
export function mergeLevel(motor, junta) {
  if (!junta) return motor;
  return orden(junta) > orden(motor) ? junta : motor;
}
