// Niveles del semáforo. El color nunca va solo: cada nivel tiene forma y texto.
export const NIVELES = {
  green: { etiqueta: 'Normal', forma: 'circulo', orden: 0 },
  yellow: { etiqueta: 'Atención', forma: 'triangulo', orden: 1 },
  orange: { etiqueta: 'Alerta', forma: 'rombo', orden: 2 },
  red: { etiqueta: 'Crítico', forma: 'cuadrado', orden: 3 },
};

/** El peor de varios niveles (el estado de una zona o el global es el máximo). */
export function maxNivel(...niveles) {
  return niveles
    .flat()
    .filter((n) => n in NIVELES)
    .reduce((peor, n) => (NIVELES[n].orden > NIVELES[peor].orden ? n : peor), 'green');
}
