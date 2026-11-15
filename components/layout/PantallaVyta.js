'use client';

import Image from 'next/image';
import CabeceraMision from './CabeceraMision';
import { useEstadoMision } from '@/lib/datos/demo';
import styles from './PantallaVyta.module.scss';

// Marco común del tema VYTA: fondo del planeta, cabecera de misión y título de la pantalla.
export default function PantallaVyta({ titulo, subtitulo, icono, acciones, children, className = '', ...props }) {
  const { astronauta, solActual, mision } = useEstadoMision();
  return (
    <div className={`${styles.pantalla} ${className}`} data-dashboard {...props}>
      <CabeceraMision
        nombre={astronauta?.name || 'Loading…'}
        titulo={astronauta?.titulo || 'Mission crewmember'}
        sol={solActual}
        entorno={mision?.entorno}
      />
      <div className={styles.cabecera}>
        <div className={styles.titulo}>
          {icono && <span className={styles.icono} aria-hidden="true"><Image src={icono} width={22} height={22} alt="" /></span>}
          <div>
            <h1>{titulo}</h1>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
        </div>
        {acciones && <div className={styles.acciones}>{acciones}</div>}
      </div>
      {children}
    </div>
  );
}
