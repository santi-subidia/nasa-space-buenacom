// Conteo de tokens SIN red ni clave: es una estimación pensada para quedarse corta de forma segura.
//
// Calibrado contra el conteo oficial de la API (client.messages.countTokens, claude-haiku-5-5) con las
// fichas de doc/: 2,2 a 2,6 caracteres por token (texto en español con tablas y símbolos). Se usa 2,0
// para sobreestimar un poco: preferimos pasarnos de precavidos antes que cruzar el umbral de 100K
// tokens, donde Haiku 5.5 cuesta 5 veces más. Con esta medida el corpus completo (~529.000 caracteres)
// son ~250K tokens, el doble de lo que suponía el plan.
export const CARACTERES_POR_TOKEN = 2.0;

/** Por encima de esto Haiku 5.5 cobra 5× (US$ 0,50 / US$ 2,50 por millón en vez de 0,10 / 0,50). */
export const UMBRAL_PRECIO_TOKENS = 100_000;

/** Estimación por exceso de los tokens de un texto. */
export function estimarTokens(texto) {
  if (!texto) return 0;
  return Math.ceil(texto.length / CARACTERES_POR_TOKEN);
}
