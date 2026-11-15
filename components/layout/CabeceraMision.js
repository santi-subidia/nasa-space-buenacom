'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MISION, SOL_ACTUAL } from '@/lib/mock/mision';
import { alternarPanelNotificaciones, useNotificaciones } from '@/lib/datos/notificaciones';
import styles from '@/components/inicio/InicioPantalla.module.scss';

export default function CabeceraMision({ nombre, titulo }) {
  const [ahora, setAhora] = useState(null);
  const [enLinea, setEnLinea] = useState(true);
  const { items: notificaciones } = useNotificaciones();
  const hayCritica = notificaciones.some((n) => n.color === 'red');
  useEffect(() => {
    const actualizar = () => { setAhora(new Date()); setEnLinea(navigator.onLine); };
    actualizar();
    const intervalo = setInterval(actualizar, 60000);
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, []);

  return (
    <header className={styles.encabezado}>
      <Link href="/tripulacion" className={styles.perfil} aria-label={`Ver tripulación y privacidad de ${nombre}`}>
        <Image src="/figma/tripulante.png" width={88} height={88} sizes="88px" alt="" className={styles.retrato} />
        <span><strong>{nombre}</strong><small>{titulo}</small></span>
      </Link>
      <div className={styles.conexion}>
        <span>Conexión</span>
        <strong><i className={enLinea ? styles.enLinea : styles.sinConexion} aria-hidden="true" /> {enLinea ? 'En línea' : 'Sin conexión'}</strong>
        <small>{MISION.entorno} · Sol {SOL_ACTUAL}</small>
      </div>
      <div className={styles.tierra} aria-hidden="true" />
      <button
        type="button"
        className={`${styles.campana} ${hayCritica ? styles.campanaCritica : ''}`}
        onClick={alternarPanelNotificaciones}
        aria-controls="panel-notificaciones"
        aria-label={`Notificaciones de misión (${notificaciones.length})`}
        title="Notificaciones de misión"
      >
        <span aria-hidden="true">🔔</span>
        {notificaciones.length > 0 && (
          <span className={styles.campanaContador}>{notificaciones.length}</span>
        )}
      </button>
      <div className={styles.fecha}>
        <span>{ahora ? ahora.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }) : '—'}</span>
        <span>{ahora ? `${ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })} UTC` : '—'}</span>
      </div>
      <img src="/figma/nasa.svg" width="66" height="66" alt="NASA" className={styles.insignia} />
    </header>
  );
}
