'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { liveQuery } from 'dexie';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import { getReadings, getSymptoms, listAstronauts } from '@/lib/db';
import { SOL_ACTUAL, asegurarDemo, useEstadoMision } from '@/lib/datos/demo';
import {
  cambiarPermisoCompartir,
  cambiarTripulanteActivo,
  usePermisosCompartir,
  useTripulanteActivo,
} from '@/lib/datos/tripulante';
import { MISION_BASE, TRIPULANTES } from '@/lib/demo/generador';
import { DEMO_DATA } from '@/lib/demo/sembrar';
import { evaluate } from '@/lib/motor/evaluar';
import {
  armarVistaOficialMedico,
  etiquetaEscalamiento,
} from '@/lib/tripulacion/logicaTripulante';
import styles from './TripulacionPantalla.module.scss';

function evaluarDesdeDemo() {
  const evaluacionesPorId = {};
  for (const t of DEMO_DATA.astronauts) {
    const r = DEMO_DATA.readings.filter((item) => item.astronautId === t.id);
    const s = DEMO_DATA.symptoms.filter((item) => item.astronautId === t.id);
    evaluacionesPorId[t.id] = evaluate(r, t.baseline || {}, MISION_BASE.entorno, {
      symptoms: s,
      sol: SOL_ACTUAL,
    });
  }
  return {
    tripulacion: DEMO_DATA.astronauts,
    evaluacionesPorId,
  };
}

function formatearNumero(valor) {
  if (typeof valor !== 'number' || Number.isNaN(valor)) return '—';
  return Number.isInteger(valor) ? String(valor) : String(Number(valor.toFixed(1))).replace('.', ',');
}

export default function TripulacionPantalla() {
  const activoId = useTripulanteActivo();
  const permisos = usePermisosCompartir();
  // Mantiene viva la siembra inicial y el estado del tripulante activo.
  const { astronauta } = useEstadoMision(activoId, SOL_ACTUAL);

  const [estadoCmo, setEstadoCmo] = useState(evaluarDesdeDemo);

  useEffect(() => {
    asegurarDemo().catch((e) => console.error('No se pudo sembrar la demo', e));

    const sub = liveQuery(async () => {
      const lista = await listAstronauts();
      const tripulacion = lista.length > 0 ? lista : TRIPULANTES;
      const evaluacionesPorId = {};

      await Promise.all(
        tripulacion.map(async (t) => {
          const [lecturas, sintomas] = await Promise.all([
            getReadings(t.id),
            getSymptoms(t.id),
          ]);
          const rEfectivas =
            lecturas.length > 0
              ? lecturas
              : DEMO_DATA.readings.filter((item) => item.astronautId === t.id);
          const sEfectivos =
            lecturas.length > 0
              ? sintomas
              : DEMO_DATA.symptoms.filter((item) => item.astronautId === t.id);

          evaluacionesPorId[t.id] = evaluate(
            rEfectivas,
            t.baseline || {},
            MISION_BASE.entorno,
            { symptoms: sEfectivos, sol: SOL_ACTUAL },
          );
        }),
      );

      return { tripulacion, evaluacionesPorId };
    }).subscribe({
      next: setEstadoCmo,
      error: (e) => console.error('Error al evaluar tripulación', e),
    });

    return () => sub.unsubscribe();
  }, []);

  const tripulacion = estadoCmo.tripulacion;
  const activo =
    astronauta ||
    tripulacion.find((t) => t.id === activoId) ||
    TRIPULANTES.find((t) => t.id === activoId) ||
    TRIPULANTES[0];

  const tarjetasCmo = useMemo(
    () =>
      armarVistaOficialMedico({
        tripulacion,
        evaluacionesPorId: estadoCmo.evaluacionesPorId,
        permisosPorId: permisos,
      }),
    [tripulacion, estadoCmo.evaluacionesPorId, permisos],
  );

  const comparteActivo = Boolean(permisos[activo.id]);

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>Tripulación y oficial médico</h1>
          <p className={styles.sub}>
            Sol {SOL_ACTUAL} de {MISION_BASE.totalSoles} · {MISION_BASE.nombre} · Privacidad clínica entre pares
          </p>
        </div>
        <div className={styles.chips}>
          <span className={styles.chip}>
            Perfil activo: <strong>{activo.name}</strong>
          </span>
          <span className={styles.chip}>
            Rol: <strong>{activo.role === 'cmo' ? 'Oficial médico (CMO)' : 'Comandante'}</strong>
          </span>
        </div>
      </header>

      <div className={styles.filaSuperior}>
        <Card titulo="Selector de tripulante activo">
          <p className={styles.privacidadDesc}>
            Elegí desde qué integrante de la tripulación estás usando AstroVitals. El cambio se guarda en este dispositivo.
          </p>
          <div className={styles.selectorGrid} role="group" aria-label="Tripulante activo">
            {TRIPULANTES.map((t) => {
              const seleccionado = t.id === activo.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={seleccionado}
                  onClick={() => cambiarTripulanteActivo(t.id)}
                  className={[styles.opcionTripulante, seleccionado && styles.opcionActiva]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className={styles.opcionTop}>
                    <span className={styles.opcionNombre}>{t.name}</span>
                    {seleccionado && <span className={styles.insigniaActiva}>Activo</span>}
                  </div>
                  <span className={styles.opcionRol}>{t.titulo}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card titulo={`Privacidad de ${activo.name}`}>
          <p className={styles.privacidadDesc}>
            Por defecto, el oficial médico solo ve el semáforo y la alerta activa. Podés autorizar el detalle numérico cuando necesites seguimiento clínico.
          </p>
          <label className={styles.interruptor}>
            <input
              type="checkbox"
              checked={comparteActivo}
              onChange={(e) => cambiarPermisoCompartir(activo.id, e.target.checked)}
            />
            <span className={styles.interruptorTexto}>
              <strong>Compartir mis mediciones detalladas con el oficial médico</strong>
              <span>
                {comparteActivo
                  ? 'Activo: el CMO puede ver tus indicadores numéricos del día.'
                  : 'Oculto: el CMO solo ve tu semáforo y la alerta activa.'}
              </span>
            </span>
          </label>
        </Card>
      </div>

      <section aria-label="Vista del oficial médico (CMO)" className={styles.cmoSeccion}>
        <div className={styles.cmoEncabezado}>
          <h2>Vista del oficial médico (CMO)</h2>
          <span className={styles.cmoNotaRol}>
            {activo.role === 'cmo'
              ? 'Sesión activa de Marcos Silva (CMO)'
              : 'Vista previa del panel de Marcos Silva · Cambiá a Marcos Silva para operar como CMO'}
          </span>
        </div>

        <div className={styles.cmoGrid}>
          {tarjetasCmo.map((tarjeta) => (
            <TarjetaCmo key={tarjeta.id} tarjeta={tarjeta} esCmoActivo={activo.role === 'cmo'} />
          ))}
        </div>
      </section>
    </div>
  );
}

function TarjetaCmo({ tarjeta, esCmoActivo }) {
  const { name, titulo, level, alertaActiva, compartioDetalles, indicadoresVisibles, notaPrivacidad } =
    tarjeta;

  return (
    <Card acento={level}>
      <div className={styles.tarjetaHeader}>
        <div>
          <h3>{name}</h3>
          <p className={styles.tarjetaRol}>{titulo}</p>
        </div>
        <TrafficLight nivel={level} />
      </div>

      {alertaActiva ? (
        <div className={styles.alerta}>
          <h4>
            <TrafficLight nivel={alertaActiva.level} conTexto={false} /> {alertaActiva.title}
          </h4>
          <p>{alertaActiva.why}</p>
          {Array.isArray(alertaActiva.actions) && alertaActiva.actions.length > 0 && (
            <ul>
              {alertaActiva.actions.map((accion) => (
                <li key={accion}>{accion}</li>
              ))}
            </ul>
          )}
          <p className={styles.escalamiento}>
            Escalamiento: <strong>{etiquetaEscalamiento(alertaActiva.escalate)}</strong> (
            {alertaActiva.escalate})
          </p>
        </div>
      ) : (
        <div className={styles.alerta}>
          <h4>
            <TrafficLight nivel="green" conTexto={false} /> Sin alertas activas
          </h4>
          <p>Parámetros dentro de rango nominal para el sol {SOL_ACTUAL}.</p>
        </div>
      )}

      {compartioDetalles && indicadoresVisibles.length > 0 ? (
        <div>
          <p className={styles.detallesTitulo}>Mediciones detalladas compartidas</p>
          <div className={styles.indicadoresGrid}>
            {indicadoresVisibles.map((ind) => (
              <div key={ind.id} className={styles.indicadorItem}>
                <div className={styles.indicadorMeta}>
                  <span className={styles.indicadorNombre}>{ind.label}</span>
                  <span className={styles.indicadorValor}>
                    {formatearNumero(ind.value)} <small>{ind.unit}</small>
                  </span>
                </div>
                <TrafficLight nivel={ind.level} conTexto={false} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.privacidadCaja} role="note">
          {notaPrivacidad}
        </div>
      )}

      {esCmoActivo && alertaActiva && (
        <div className={styles.accionesCmo}>
          <Link className={`${styles.boton} ${styles.botonIa}`} href="/junta">
            Evaluar en Junta médica
          </Link>
          <Link className={styles.boton} href="/enlace">
            Enviar informe a Tierra
          </Link>
        </div>
      )}
    </Card>
  );
}

/** Selector compacto para incrustar en el Sidebar. */
export function SelectorTripulanteBarra() {
  const activoId = useTripulanteActivo();

  return (
    <div className={styles.barraSidebar} aria-label="Cambiar tripulante activo">
      <div className={styles.barraEncabezado}>
        <span>Tripulante</span>
        <Link className={styles.barraEnlace} href="/tripulacion">
          Privacidad
        </Link>
      </div>
      <div className={styles.barraBotones}>
        {TRIPULANTES.map((t) => {
          const activo = t.id === activoId;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={activo}
              title={`${t.name} · ${t.titulo}`}
              onClick={() => cambiarTripulanteActivo(t.id)}
              className={[styles.barraBoton, activo && styles.barraBotonActivo]
                .filter(Boolean)
                .join(' ')}
            >
              {t.id === 'ana' ? 'Ana' : 'Marcos'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
