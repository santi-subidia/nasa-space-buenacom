/** Un análisis de fotos o de parpadeo completado para el tripulante y sol indicados. */
export function esChequeoFacialCompletado(registro, astronautId, sol) {
  const resultado = registro?.output;
  return registro?.kind === 'face' &&
    (registro.astronautId ?? registro.input?.astronautId) === astronautId &&
    (registro.sol ?? registro.input?.sol) === sol &&
    resultado?.ok === true && Boolean(resultado.comparacionDeIA || resultado.fatiga);
}
