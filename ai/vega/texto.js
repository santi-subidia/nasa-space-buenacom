// Utilidades de texto compartidas por servidor y navegador.

/** Minúsculas y sin tildes, para comparar palabras ("sueño" → "sueno", "estrés" → "estres"). */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** Ids de cita ([F1], [F2]…) que aparecen en el texto, en orden y sin repetir. */
export function idsCitados(texto) {
  const ids = [];
  for (const [, n] of String(texto ?? '').matchAll(/\[F(\d+)\]/g)) {
    const id = `F${n}`;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** De todas las citas disponibles, solo las que Claude usó (las que se muestran en pantalla). */
export function citasUsadas(texto, citas = []) {
  const usadas = idsCitados(texto);
  return citas.filter((c) => usadas.includes(c.id)).sort((a, b) => usadas.indexOf(a.id) - usadas.indexOf(b.id));
}

/** Texto que se lee en voz alta: sin marcas [F1], sin markdown, con espacios normales. */
export function textoParaVoz(texto) {
  return String(texto ?? '')
    .replace(/\s*\[F\d+\]/g, '')
    .replace(/[*_`#>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}
