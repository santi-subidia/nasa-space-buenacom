'use client';

import Image from 'next/image';
import { useVega } from '@/components/vega/useVega';
import styles from './InicioPantalla.module.scss';

const ETIQUETAS = {
  inactivo: 'Hablar con VYTA. Tocá para empezar a escuchar.',
  solicitando: 'Abriendo el micrófono. Tocá para cancelar.',
  escuchando: 'VYTA está escuchando. Al terminar de hablar enviará tu pregunta. Tocá para enviarla ahora.',
  transcribiendo: 'Procesando tu voz. Tocá para cancelar.',
  pensando: 'VYTA está preparando la respuesta. Tocá para cancelar.',
  hablando: 'VYTA está hablando. Tocá para interrumpir y hablar de nuevo.',
};

export default function VytaVoz({ resumen, seccion, className = '' }) {
  const { fase, error, listo, tocar } = useVega({ seccion, resumen });
  return (
    <button type="button" className={`${styles.vega} ${resumen ? styles.compacta : ''} ${className}`} onClick={tocar} disabled={!listo}
      data-fase={fase} aria-label={ETIQUETAS[fase]} aria-pressed={fase !== 'inactivo'} title={error || ETIQUETAS[fase]}>
      <span className={styles.vegaEncabezado}><span aria-hidden="true">✦</span> VYTA AI</span>
      <span className={resumen ? styles.cuerpoVoz : undefined}>
        <Image src="/figma/esfera-vyta.png" width={213} height={213} sizes={resumen ? '106px' : '213px'} alt="" className={styles.esfera} />
        {resumen && <span className={styles.resumenVoz}>{resumen}</span>}
      </span>
      <span className={styles.oculto} role="status">{ETIQUETAS[fase]}</span>
      {error && <span className={styles.errorVoz} role="alert">{error}</span>}
    </button>
  );
}
