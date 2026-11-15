'use client';

import EsferaViscosa from './EsferaViscosa';
import { useVega } from './useVega';
import styles from './InicioPantalla.module.scss';

const ETIQUETAS = {
  inactivo: 'Talk with VYTA. Tap once for continuous chat.',
  solicitando: 'Opening microphone. Tap to pause.',
  escuchando: 'VYTA is listening in continuous mode. Tap to pause.',
  transcribiendo: 'Processing your voice. Tap to pause.',
  pensando: 'VYTA is thinking. Tap to pause.',
  hablando: 'VYTA is speaking. You can interrupt by speaking or tap to pause.',
};

const ESTADO_VIVO = {
  solicitando: 'Opening microphone…',
  escuchando: 'Listening · Go ahead',
  transcribiendo: 'Processing voice…',
  pensando: 'Checking protocol…',
  hablando: 'Speaking · Interrupt anytime',
};

export default function VytaVoz({ resumen, seccion, className = '' }) {
  const { fase, error, continuo, listo, nivelRef, tocarContinuo } = useVega({ seccion, resumen });
  return (
    <button type="button" className={`${styles.vega} ${resumen ? styles.compacta : ''} ${className}`} onClick={tocarContinuo} disabled={!listo}
      data-fase={fase} data-continuo={continuo} aria-label={ETIQUETAS[fase]} aria-pressed={continuo || fase !== 'inactivo'} title={error || ETIQUETAS[fase]}>
      <span className={styles.vegaEncabezado}><span aria-hidden="true">✦</span> VYTA AI</span>
      <span className={resumen ? styles.cuerpoVoz : styles.centroVoz}>
        <EsferaViscosa fase={fase} nivelRef={nivelRef} compacta={Boolean(resumen)} />
        {resumen && <span className={styles.resumenVoz}>{resumen}</span>}
      </span>
      {continuo && (
        <span className={styles.estadoContinuo}>
          {ESTADO_VIVO[fase] ?? 'Live'} · Tap to pause
        </span>
      )}
      <span className={styles.oculto} role="status">{ETIQUETAS[fase]}</span>
      {error && <span className={styles.errorVoz} role="alert">{error}</span>}
    </button>
  );
}
