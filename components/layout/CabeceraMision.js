'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useEstadoMision } from '@/lib/datos/demo';
import { alternarPanelNotificaciones, useNotificaciones } from '@/lib/datos/notificaciones';
import styles from '@/components/inicio/InicioPantalla.module.scss';

const ETIQUETA_ENTORNO = {
  mars_base: 'Mars Base',
  transit: 'Transit',
  mars_orbit: 'Mars Orbit',
};

export default function CabeceraMision({ nombre, titulo, sol, entorno, mostrarNotificaciones = true }) {
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

  const nombreMostrar = nombre || astronauta?.name || 'Loading…';
  const tituloMostrar = titulo || astronauta?.titulo || 'Mission crewmember';
  const solMostrar = sol ?? solActual ?? mision?.solActual ?? 42;
  const entornoRaw = entorno ?? mision?.entorno ?? 'mars_base';
  const entornoMostrar = ETIQUETA_ENTORNO[entornoRaw] ?? entornoRaw;

  return (
    <header className={styles.encabezado}>
      <div className={styles.perfil}>
        <span className={styles.retrato}>
          <Image src="/figma/tripulante.png" width={125} height={125} sizes="(max-width: 1200px) 80px, 125px" alt="" className={styles.fotoRetrato} />
        </span>
        <span><strong>{nombreMostrar}</strong><small>{tituloMostrar}</small></span>
      </div>
      <div className={styles.conexion}>
        <span>Connection</span>
        <strong><i className={enLinea ? styles.enLinea : styles.sinConexion} aria-hidden="true" /> {enLinea ? 'Online' : 'Offline'}</strong>
        <small>{entornoMostrar} · Sol {solMostrar}</small>
      </div>
      <div className={styles.tierra} aria-hidden="true" />
      {mostrarNotificaciones && <button
        type="button"
        className={`${styles.campana} ${hayCritica ? styles.campanaCritica : ''}`}
        onClick={alternarPanelNotificaciones}
        aria-controls="panel-notificaciones"
        aria-label={`Mission notifications (${notificaciones.length})`}
        title="Mission notifications"
      >
        <span aria-hidden="true">🔔</span>
        {notificaciones.length > 0 && (
          <span className={styles.campanaContador}>{notificaciones.length}</span>
        )}
      </button>}
      <div className={styles.fecha}>
        <span>{ahora ? ahora.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'}</span>
        <span>{ahora ? `${ahora.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })} UTC` : '—'}</span>
      </div>
      <img src="/figma/nasa.svg" width="66" height="66" alt="NASA" className={styles.insignia} />
    </header>
  );
}
