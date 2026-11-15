'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useEstadoMision } from '@/lib/datos/demo';
import { alternarPanelNotificaciones, useNotificaciones } from '@/lib/datos/notificaciones';
import styles from '@/components/inicio/InicioPantalla.module.scss';

const ETIQUETA_ENTORNO = {
  mars_base: 'Base Marte',
  transit: 'Tránsito',
  mars_orbit: 'Órbita Marte',
};

export default function CabeceraMision({ nombre, titulo, sol, entorno }) {
  const { astronauta, mision, solActual } = useEstadoMision();
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

  const nombreMostrar = nombre || astronauta?.name || 'Cargando…';
  const tituloMostrar = titulo || astronauta?.titulo || 'Tripulante de misión';
  const solMostrar = sol ?? solActual ?? mision?.solActual ?? 42;
  const entornoRaw = entorno ?? mision?.entorno ?? 'mars_base';
  const entornoMostrar = ETIQUETA_ENTORNO[entornoRaw] ?? entornoRaw;

  return (
    <header className={styles.encabezado}>
      <div className={styles.perfil}>
        <Image src="/figma/tripulante.png" width={88} height={88} sizes="88px" alt="" className={styles.retrato} />
        <span><strong>{nombreMostrar}</strong><small>{tituloMostrar}</small></span>
      </div>
      <div className={styles.conexion}>
        <span>Conexión</span>
        <strong><i className={enLinea ? styles.enLinea : styles.sinConexion} aria-hidden="true" /> {enLinea ? 'En línea' : 'Sin conexión'}</strong>
        <small>{entornoMostrar} · Sol {solMostrar}</small>
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {notificaciones.length > 0 && <span className={styles.campanaCantidad}>{notificaciones.length}</span>}
      </button>
      <div className={styles.hora}>
        <span className={styles.iconoReloj} aria-hidden="true" />
        <strong>{ahora ? ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}</strong>
        <small>UTC {ahora ? ahora.toISOString().slice(11, 16) : '--:--'}</small>
      </div>
    </header>
  );
}
