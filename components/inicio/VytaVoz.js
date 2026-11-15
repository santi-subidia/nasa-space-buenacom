'use client';

import EsferaViscosa from './EsferaViscosa';
import { useVega } from '@/components/vega/useVega';
import styles from './InicioPantalla.module.scss';

const ETIQUETAS = {
  inactivo: 'Hablar con VYTA. Tocá una vez para charla continua.',
  solicitando: 'Abriendo el micrófono. Tocá para pausar.',
  escuchando: 'VYTA está escuchando en modo continuo. Tocá para pausar.',
  transcribiendo: 'Procesando tu voz. Tocá para pausar.',
  pensando: 'VYTA está pensando. Tocá para pausar.',
  hablando: 'VYTA está hablando. Podés interrumpirla hablando o tocar para pausar.',
};

const ESTADO_VIVO = {
  solicitando: 'Abriendo micrófono…',
  escuchando: 'Escuchando · Podés hablar',
  transcribiendo: 'Procesando voz…',
  pensando: 'Consultando protocolo…',
  hablando: 'Hablando · Interrumpime cuando quieras',
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
          {ESTADO_VIVO[fase] ?? 'En vivo'} · Tocá para pausar
        </span>
      )}
      <span className={styles.oculto} role="status">{ETIQUETAS[fase]}</span>
      {error && <span className={styles.errorVoz} role="alert">{error}</span>}
    </button>
  );
}
