'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { crearSesionVoz } from '@/ai/voz/sesion';
import styles from './InicioPantalla.module.scss';

const INICIAL = { fase: 'inactivo', error: '' };
const sinSuscripcion = () => () => {};
const inicial = () => INICIAL;
const ETIQUETAS = {
  inactivo: 'Hablar con VYTA. Tocá para empezar a escuchar.',
  solicitando: 'Abriendo el micrófono. Tocá para cancelar.',
  escuchando: 'VYTA está escuchando. Al terminar de hablar enviará tu pregunta. Tocá para enviarla ahora.',
  transcribiendo: 'Procesando tu voz. Tocá para cancelar.',
  pensando: 'VYTA está preparando la respuesta. Tocá para cancelar.',
  hablando: 'VYTA está hablando. Tocá para interrumpir y hablar de nuevo.',
};

export default function VytaVoz() {
  const [sesion, setSesion] = useState(null);
  useEffect(() => {
    const motor = crearSesionVoz({ entorno: window });
    setSesion(motor);
    const alOcultar = () => { if (document.hidden) motor.cancelar(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => { document.removeEventListener('visibilitychange', alOcultar); motor.cancelar(); };
  }, []);
  const { fase, error } = useSyncExternalStore(sesion?.suscribir || sinSuscripcion, sesion?.obtener || inicial, inicial);
  return (
    <button type="button" className={styles.vega} onClick={() => sesion?.tocar()} disabled={!sesion}
      data-fase={fase} aria-label={ETIQUETAS[fase]} aria-pressed={fase !== 'inactivo'} title={error || ETIQUETAS[fase]}>
      <span className={styles.vegaEncabezado}><span aria-hidden="true">✦</span> VYTA AI</span>
      <Image src="/figma/esfera-vyta.png" width={213} height={213} sizes="213px" alt="" className={styles.esfera} />
      <span className={styles.oculto} role="status">{ETIQUETAS[fase]}</span>
      {error && <span className={styles.errorVoz} role="alert">{error}</span>}
    </button>
  );
}
