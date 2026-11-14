'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/Card';
import TrafficLight from '@/components/TrafficLight';
import {
  adelantarMinutos,
  alternarAcelerado,
  alternarPausa,
  reiniciarReloj,
  useJornada,
} from '@/lib/datos/jornada';
import {
  DIAS_SEMANA,
  ETIQUETAS_DIA,
  estadoTareaRespectoAHora,
} from '@/lib/reloj/relojMision';
import styles from './JornadaPantalla.module.scss';

const FILTROS = [
  { id: 'all', etiqueta: 'Todas' },
  { id: 'daily', etiqueta: 'Diarias' },
  { id: 'weekly', etiqueta: 'Semanales' },
  { id: 'event', etiqueta: 'Por evento' },
];

const ETIQUETA_RECURRENCIA = {
  daily: 'Diaria',
  weekly: 'Semanal',
  event: 'Por evento',
};

const ETIQUETA_ESTADO = {
  hecha: 'Hecha',
  ahora: 'Ahora',
  pendiente: 'Pendiente',
  pasada: 'Pasada',
};

const ETIQUETA_RUTA = {
  '/': 'Inicio',
  '/registrar': 'Registrar',
  '/cara': '¿Cómo me ves?',
  '/entrenador': 'Entrenador',
  '/enlace': 'Enlace Tierra',
  '/vega': 'Vega',
  '/mapa?zona=eyes': 'Mapa (Ojos)',
};

function claseEstado(estado) {
  switch (estado) {
    case 'hecha':
      return styles.estadoHecha;
    case 'ahora':
      return styles.estadoAhora;
    case 'pasada':
      return styles.estadoPasada;
    default:
      return styles.estadoPendiente;
  }
}

export default function JornadaPantalla() {
  const [filtro, setFiltro] = useState('all');
  const {
    reloj,
    sol,
    diaSemana,
    astronauta,
    evaluacion,
    tareas,
    completadas,
    total,
    progresoPct,
    alternarTarea,
    cambiarDiaSemana,
  } = useJornada();

  const conteos = {
    all: tareas.length,
    daily: tareas.filter((t) => t.recurrence === 'daily').length,
    weekly: tareas.filter((t) => t.recurrence === 'weekly').length,
    event: tareas.filter((t) => t.recurrence === 'event').length,
  };

  const tareasFiltradas =
    filtro === 'all' ? tareas : tareas.filter((t) => t.recurrence === filtro);

  const indiceMarcador = tareasFiltradas.findIndex((t) => reloj.minutos < t.horaMin);
  const hayEventos = conteos.event > 0;
  const nivelGlobal = evaluacion?.globalLevel || 'green';

  return (
    <div className={styles.pantalla}>
      <header className={styles.encabezado}>
        <div>
          <h1>Jornada del astronauta</h1>
          <p className={styles.sub}>
            {astronauta?.name || 'Ana Ríos'} · Sol marciano de 24 h 37 min ·{' '}
            {ETIQUETAS_DIA[diaSemana] || 'Jueves'}
          </p>
        </div>

        <div className={styles.relojCaja}>
          <div className={styles.relojLectura} aria-label="Reloj de misión marciano">
            <span className={styles.relojSol}>Sol {sol} ·</span>
            <span className={styles.relojHora}>{reloj.horaFormateada}</span>
            <span className={styles.relojTotal}>/ 24:37</span>
          </div>

          <div className={styles.badgesReloj}>
            {reloj.suenoProtegido && (
              <span className={styles.badgeSueno} role="status">
                ☾ Sueño protegido (22:00–06:30)
              </span>
            )}
            <span className={styles.badgeActivo}>
              {reloj.pausado ? '⏸ En pausa' : reloj.acelerado ? '▶ Corriendo (1 min = 1 h)' : '▶ Tiempo real'}
            </span>
          </div>
        </div>
      </header>

      <Card titulo="Controles del reloj marciano">
        <div className={styles.controlesCard}>
          <div className={styles.botonesReloj}>
            <button
              type="button"
              onClick={() => alternarPausa()}
              className={`${styles.boton} ${styles.botonPrimario}`}
            >
              {reloj.pausado ? '▶ Iniciar' : '⏸ Pausar'}
            </button>

            <button
              type="button"
              onClick={() => alternarAcelerado()}
              className={`${styles.boton} ${reloj.acelerado ? styles.botonAceleradoActivo : ''}`}
              aria-pressed={reloj.acelerado}
            >
              {reloj.acelerado ? '⚡ Acelerado 1 min = 1 h' : '⏱ Tiempo real 1:1'}
            </button>

            <button type="button" onClick={() => adelantarMinutos(15)} className={styles.boton}>
              +15 min
            </button>
            <button type="button" onClick={() => adelantarMinutos(60)} className={styles.boton}>
              +1 h
            </button>
            <button type="button" onClick={() => adelantarMinutos(240)} className={styles.boton}>
              +4 h
            </button>
            <button type="button" onClick={() => reiniciarReloj()} className={styles.boton}>
              ↺ 06:30
            </button>
          </div>

          <label className={styles.selectorDia}>
            <span>Día semanal:</span>
            <select
              value={diaSemana}
              onChange={(e) => cambiarDiaSemana(e.target.value)}
              aria-label="Día semanal para probar tareas semanales"
            >
              {DIAS_SEMANA.map((d) => (
                <option key={d} value={d}>
                  {ETIQUETAS_DIA[d]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <div className={styles.filaResumen}>
        <Card titulo="Progreso del sol">
          <div className={styles.progresoHeader}>
            <strong>
              {completadas} de {total} tareas completadas
            </strong>
            <span>{progresoPct} %</span>
          </div>
          <div className={styles.barra} aria-hidden="true">
            <span style={{ width: `${progresoPct}%` }} />
          </div>
        </Card>

        <Card titulo="Contexto clínico" acento={nivelGlobal}>
          <div className={styles.estadoClinico}>
            <div className={styles.estadoFila}>
              <TrafficLight nivel={nivelGlobal} />
              <span>
                {evaluacion?.alerts?.[0]?.title || 'Sin alertas activas en este sol'}
              </span>
            </div>
            {hayEventos ? (
              <p className={styles.notaEvento}>
                Se sumaron tareas por evento ({conteos.event}) según tu evaluación actual.
              </p>
            ) : (
              <p className={styles.notaNormal}>
                Sincronizá el Watch o registrá mediciones para autocompletar tareas.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card titulo="Línea de tiempo del sol">
        <div className={styles.barraFiltros}>
          <div className={styles.filtros} role="tablist" aria-label="Filtrar tareas de la jornada">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={`${styles.filtro} ${filtro === f.id ? styles.filtroActivo : ''}`}
              >
                {f.etiqueta} ({conteos[f.id]})
              </button>
            ))}
          </div>
        </div>

        <ol className={styles.timeline} style={{ marginTop: 16 }}>
          {tareasFiltradas.length === 0 ? (
            <li className={styles.vacio}>No hay tareas en esta categoría para el día seleccionado.</li>
          ) : (
            <>
              {tareasFiltradas.map((tarea, idx) => {
                const estado = estadoTareaRespectoAHora(tarea, reloj.minutos);
                const mostrarMarcadorAntes = indiceMarcador === idx;
                const recClase =
                  tarea.recurrence === 'event'
                    ? styles.recurrenciaEvent
                    : tarea.recurrence === 'weekly'
                      ? styles.recurrenciaWeekly
                      : '';

                return (
                  <Fragment key={tarea.id}>
                    {mostrarMarcadorAntes && (
                      <li className={styles.marcadorAhora} aria-label="Hora actual de misión">
                        <span className={styles.puntoAhora} aria-hidden="true" />
                        <span>Ahora · Sol {sol} · {reloj.horaFormateada}</span>
                      </li>
                    )}
                    <li
                      className={`${styles.item} ${estado === 'ahora' ? styles.itemAhora : ''} ${tarea.done ? styles.itemHecha : ''}`}
                    >
                      <span className={styles.hora}>{tarea.missionTime}</span>

                      <input
                        type="checkbox"
                        className={styles.check}
                        checked={tarea.done}
                        onChange={() => alternarTarea(tarea)}
                        aria-label={`Marcar "${tarea.title}" como completada`}
                      />

                      <div className={styles.detalle}>
                        <div className={styles.tituloFila}>
                          <span
                            className={`${styles.tituloTarea} ${tarea.done ? styles.tituloTachado : ''}`}
                          >
                            {tarea.title}
                          </span>
                          <span className={`${styles.recurrencia} ${recClase}`}>
                            {ETIQUETA_RECURRENCIA[tarea.recurrence] || 'Tarea'}
                          </span>
                        </div>
                      </div>

                      <div className={styles.accionesItem}>
                        <span className={`${styles.estadoBadge} ${claseEstado(estado)}`}>
                          {ETIQUETA_ESTADO[estado]}
                        </span>
                        {tarea.ruta && (
                          <Link href={tarea.ruta} className={styles.enlaceRuta}>
                            {ETIQUETA_RUTA[tarea.ruta] || 'Abrir'} →
                          </Link>
                        )}
                      </div>
                    </li>
                  </Fragment>
                );
              })}

              {indiceMarcador === -1 && (
                <li className={styles.marcadorAhora} aria-label="Hora actual de misión">
                  <span className={styles.puntoAhora} aria-hidden="true" />
                  <span>Ahora · Sol {sol} · {reloj.horaFormateada}</span>
                </li>
              )}
            </>
          )}
        </ol>
      </Card>
    </div>
  );
}
