// Enlaces a las zonas del cuerpo dentro de Salud (sin dependencias: se usa también desde tests de Node).
// El mapa corporal vive repartido en Salud: el cerebro en Mental, el resto del cuerpo en Física.

export const IDS_ZONAS = ['brain', 'eyes', 'inner_ear', 'heart', 'lungs', 'immune', 'kidneys', 'muscles', 'bones'];

export function esZonaValida(id) {
  return IDS_ZONAS.includes(id);
}

/** Subcategoría de Salud donde vive una zona. */
export function seccionDeZona(id) {
  return id === 'brain' ? 'mental' : 'fisica';
}

/** Enlace a la guía de una zona dentro de Salud (sustituye a `/mapa?zona=`). */
export function rutaZona(id) {
  const zona = esZonaValida(id) ? id : 'immune';
  return `/salud/${seccionDeZona(zona)}?zona=${zona}#mapa`;
}
