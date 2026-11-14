// Conteo de tokens SIN red ni clave: es una estimación pensada para quedarse corta de forma segura.
//
// El corpus completo mide ~529.000 caracteres y el plan lo estima en ~125K tokens (≈ 4,2 car/token).
// Acá usamos 3,5 caracteres por token, que sobreestima ~20 %: preferimos pasarnos de
// precavidos antes que cruzar el umbral de 100K tokens, donde Haiku 5.5 cuesta 5 veces más.
//
// Cuando exista el servidor (#5) se puede contrastar con el conteo exacto de la API
// (`client.messages.countTokens`) para calibrar este número.

export const CARACTERES_POR_TOKEN = 3.5;

/** Por encima de esto Haiku 5.5 cobra 5× (US$ 0,50 / US$ 2,50 por millón en vez de 0,10 / 0,50). */
export const UMBRAL_PRECIO_TOKENS = 100_000;

/** Estimación por exceso de los tokens de un texto. */
export function estimarTokens(texto) {
  if (!texto) return 0;
  return Math.ceil(texto.length / CARACTERES_POR_TOKEN);
}
