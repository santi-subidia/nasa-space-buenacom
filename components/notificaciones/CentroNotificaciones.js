'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { EVENTO_ALTERNAR_PANEL, useMotorNotificaciones } from '@/lib/datos/notificaciones';
import styles from './CentroNotificaciones.module.scss';

const CLASE_COLOR = {
  blue: styles.colorBlue,
  orange: styles.colorOrange,
  red: styles.colorRed,
  violet: styles.colorViolet,
  green: styles.colorGreen,
};

const ETIQUETA_PERMISO = {
  granted: 'Navegador: activo',
  denied: 'Navegador: bloqueado',
  default: 'Activar avisos del navegador',
  unsupported: 'Navegador sin Notification API',
};

const BOTONES_PRUEBA = [
  { id: 'rutina', etiqueta: 'Rutina ●', color: 'blue' },
  { id: 'alerta', etiqueta: 'Alerta ◆', color: 'orange' },
  { id: 'alerta_roja_sueno', etiqueta: 'Alerta roja en sueño ■', color: 'red' },
  { id: 'tierra', etiqueta: 'Tierra ✦', color: 'violet' },
  { id: 'motivacion', etiqueta: 'Motivación ●', color: 'green' },
];

export default function CentroNotificaciones() {
  const {
    items,
    silenciadasSueno,
    sonidoActivo,
    permisoNavegador,
    dispararPruebaNotificacion,
    descartarNotificacion,
    limpiarNotificaciones,
    alternarSonidoNotificaciones,
    pedirPermisoNavegador,
    reloj,
  } = useMotorNotificaciones();

  const [abierto, setAbierto] = useState(false);
  const [toastIds, setToastIds] = useState([]);
  const conocidosRef = useRef(null);
  const montajeRef = useRef(0);
  const timersRef = useRef(new Map());

  // Muestra toasts solo para notificaciones nuevas emitidas durante la sesión actual.
  // El primer render hidrata con la bandeja vacía del servidor; por eso se filtra por `ts`
  // y las notificaciones guardadas de sesiones anteriores no reaparecen como toast al recargar.
  useEffect(() => {
    if (conocidosRef.current === null) {
      conocidosRef.current = new Set(items.map((it) => it.id));
      montajeRef.current = Date.now();
      return;
    }

    const nuevos = [];
    for (const item of items) {
      if (!conocidosRef.current.has(item.id)) {
        conocidosRef.current.add(item.id);
        const emitidaEn = Date.parse(item.ts);
        if (!Number.isFinite(emitidaEn) || emitidaEn >= montajeRef.current - 2000) {
          nuevos.push(item.id);
        }
      }
    }

    if (nuevos.length === 0) return;

    setToastIds((prev) => [...nuevos, ...prev].slice(0, 3));

    for (const id of nuevos) {
      const timer = window.setTimeout(() => {
        setToastIds((prev) => prev.filter((x) => x !== id));
        timersRef.current.delete(id);
      }, 8500);
      timersRef.current.set(id, timer);
    }
  }, [items]);

  useEffect(() => {
    const alternar = () => setAbierto((v) => !v);
    window.addEventListener(EVENTO_ALTERNAR_PANEL, alternar);
    return () => window.removeEventListener(EVENTO_ALTERNAR_PANEL, alternar);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  function manejarDescartar(id) {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToastIds((prev) => prev.filter((x) => x !== id));
    descartarNotificacion(id);
  }

  function manejarLimpiar() {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    setToastIds([]);
    limpiarNotificaciones();
  }

  const toastsVisibles = abierto
    ? []
    : toastIds.map((id) => items.find((it) => it.id === id)).filter(Boolean);

  return (
    <aside className={styles.contenedor} aria-label="Centro de notificaciones">
      {toastsVisibles.length > 0 && (
        <div className={styles.toasts} role="region" aria-label="Avisos recientes">
          {toastsVisibles.map((notif) => {
            const claseColor = CLASE_COLOR[notif.color] || styles.colorBlue;
            return (
              <div key={notif.id} className={`${styles.toast} ${claseColor}`} role="status">
                <div className={styles.toastCabecera}>
                  <span className={styles.tipoBadge}>
                    <span className={styles.simbolo} aria-hidden="true">
                      {notif.simbolo}
                    </span>
                    {notif.etiqueta}
                  </span>
                  <span className={styles.hora}>{notif.horaMision}</span>
                  <button
                    type="button"
                    className={styles.btnCerrar}
                    onClick={() => manejarDescartar(notif.id)}
                    aria-label={`Descartar ${notif.titulo}`}
                    title="Descartar"
                  >
                    ×
                  </button>
                </div>

                <p className={styles.toastTitulo}>{notif.titulo}</p>
                {notif.mensaje && <p className={styles.toastMensaje}>{notif.mensaje}</p>}

                {notif.ruta && (
                  <Link
                    href={notif.ruta}
                    className={styles.enlaceRuta}
                    onClick={() => setToastIds((prev) => prev.filter((x) => x !== notif.id))}
                  >
                    Abrir {notif.ruta === '/' ? 'Inicio' : notif.ruta} →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {abierto && (
        <section
          id="panel-notificaciones"
          className={styles.panel}
          aria-label="Panel de notificaciones"
        >
          <header className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitulo}>Notificaciones de misión</h2>
              <p className={styles.panelSub}>
                Sol {reloj.sol} · {reloj.horaFormateada}
                {reloj.suenoProtegido ? ' · ☾ Sueño protegido (22:00–06:30)' : ''}
              </p>
            </div>
            <button
              type="button"
              className={styles.btnCerrar}
              onClick={() => setAbierto(false)}
              aria-label="Cerrar panel de notificaciones"
            >
              ×
            </button>
          </header>

          <div className={styles.controles}>
            <button
              type="button"
              className={`${styles.btnControl} ${sonidoActivo ? styles.controlActivo : ''}`}
              onClick={alternarSonidoNotificaciones}
              aria-pressed={sonidoActivo}
            >
              {sonidoActivo ? '🔊 Sonido activo' : '🔇 Sonido silenciado'}
            </button>

            <button
              type="button"
              className={`${styles.btnControl} ${permisoNavegador === 'granted' ? styles.controlActivo : ''}`}
              onClick={pedirPermisoNavegador}
              disabled={permisoNavegador === 'granted' || permisoNavegador === 'unsupported'}
            >
              {ETIQUETA_PERMISO[permisoNavegador] || ETIQUETA_PERMISO.default}
            </button>

            {items.length > 0 && (
              <button type="button" className={styles.btnLimpiar} onClick={manejarLimpiar}>
                Limpiar
              </button>
            )}
          </div>

          <div className={styles.estadoSueno} role="status">
            <span>Silenciadas en sueño protegido:</span>
            <strong className={styles.silenciadasValor}>{silenciadasSueno}</strong>
          </div>

          <div className={styles.pruebasBloque}>
            <span className={styles.pruebasTitulo}>Pruebas rápidas</span>
            <div className={styles.pruebasGrid}>
              {BOTONES_PRUEBA.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  className={`${styles.btnPrueba} ${CLASE_COLOR[btn.color] || styles.colorBlue}`}
                  onClick={() => dispararPruebaNotificacion(btn.id, reloj)}
                >
                  {btn.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.lista}>
            {items.length === 0 ? (
              <p className={styles.vacio}>
                Todavía no hay notificaciones visibles. Avanzá el reloj de la jornada o usá los
                botones de prueba rápida.
              </p>
            ) : (
              items.map((notif) => {
                const claseColor = CLASE_COLOR[notif.color] || styles.colorBlue;
                return (
                  <article key={notif.id} className={`${styles.item} ${claseColor}`}>
                    <div className={styles.itemCabecera}>
                      <span className={styles.tipoBadge}>
                        <span className={styles.simbolo} aria-hidden="true">
                          {notif.simbolo}
                        </span>
                        {notif.etiqueta}
                      </span>
                      <span className={styles.hora}>
                        Sol {notif.sol} · {notif.horaMision}
                      </span>
                      <button
                        type="button"
                        className={styles.btnCerrar}
                        onClick={() => manejarDescartar(notif.id)}
                        aria-label={`Descartar ${notif.titulo}`}
                      >
                        ×
                      </button>
                    </div>

                    <h3 className={styles.itemTitulo}>{notif.titulo}</h3>
                    {notif.mensaje && <p className={styles.itemMensaje}>{notif.mensaje}</p>}

                    {notif.ruta && (
                      <Link
                        href={notif.ruta}
                        className={styles.enlaceRuta}
                        onClick={() => setAbierto(false)}
                      >
                        Ir a {notif.ruta === '/' ? 'Inicio' : notif.ruta} →
                      </Link>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}
    </aside>
  );
}
