// Calibración previa por cámara para el Bloque 1:
// espera a detectar el dedo índice y ejecuta una cuenta regresiva antes de iniciar el cronómetro.

export const CUENTA_REGRESIVA_S = 3;
export const CUENTA_REGRESIVA_MS = CUENTA_REGRESIVA_S * 1000;
export const GRACIA_DEDO_PERDIDO_MS = 700;

/**
 * Crea el estado inicial de espera de detección del dedo.
 */
export function crearEstadoCalibracion() {
  return {
    fase: 'esperando_dedo',
    countdownInicioMs: null,
    ultimoDedoMs: null,
    dedoPerdido: false,
  };
}

/**
 * Avanza la máquina de estados de calibración previa del test con cámara.
 * No inicia el test hasta detectar el dedo y completar la cuenta regresiva.
 *
 * @param {{ fase: string, countdownInicioMs: number|null, ultimoDedoMs: number|null, dedoPerdido?: boolean }} estado
 * @param {{ dedoDetectado: boolean, ahoraMs: number, duracionMs?: number, graciaMs?: number }} entrada
 */
export function avanzarCalibracionDedo(estado, entrada) {
  const {
    dedoDetectado,
    ahoraMs,
    duracionMs = CUENTA_REGRESIVA_MS,
    graciaMs = GRACIA_DEDO_PERDIDO_MS,
  } = entrada;

  if (estado.fase === 'listo') {
    return { estado, iniciarTest: true, segundosRestantes: 0, progreso: 1 };
  }

  if (estado.fase === 'esperando_dedo') {
    if (!dedoDetectado) {
      return { estado, iniciarTest: false, segundosRestantes: null, progreso: 0 };
    }
    return {
      estado: {
        fase: 'cuenta_regresiva',
        countdownInicioMs: ahoraMs,
        ultimoDedoMs: ahoraMs,
        dedoPerdido: false,
      },
      iniciarTest: false,
      segundosRestantes: Math.max(1, Math.ceil(duracionMs / 1000)),
      progreso: 0,
    };
  }

  if (estado.fase === 'cuenta_regresiva') {
    const ultimoDedoMs = dedoDetectado ? ahoraMs : estado.ultimoDedoMs;

    if (!dedoDetectado && ultimoDedoMs != null && ahoraMs - ultimoDedoMs > graciaMs) {
      return {
        estado: {
          fase: 'esperando_dedo',
          countdownInicioMs: null,
          ultimoDedoMs: null,
          dedoPerdido: true,
        },
        iniciarTest: false,
        segundosRestantes: null,
        progreso: 0,
      };
    }

    const transcurrido = Math.max(0, ahoraMs - (estado.countdownInicioMs ?? ahoraMs));
    if (transcurrido >= duracionMs) {
      return {
        estado: {
          fase: 'listo',
          countdownInicioMs: estado.countdownInicioMs,
          ultimoDedoMs,
          dedoPerdido: false,
        },
        iniciarTest: true,
        segundosRestantes: 0,
        progreso: 1,
      };
    }

    const restanteMs = duracionMs - transcurrido;
    return {
      estado: {
        fase: 'cuenta_regresiva',
        countdownInicioMs: estado.countdownInicioMs,
        ultimoDedoMs,
        dedoPerdido: false,
      },
      iniciarTest: false,
      segundosRestantes: Math.max(1, Math.ceil(restanteMs / 1000)),
      progreso: Math.min(1, Math.max(0, transcurrido / duracionMs)),
    };
  }

  return { estado, iniciarTest: false, segundosRestantes: null, progreso: 0 };
}
