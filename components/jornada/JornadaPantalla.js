'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/Card';
import PantallaVyta from '@/components/layout/PantallaVyta';
import TrafficLight from '@/components/TrafficLight';
import {
  adelantarMinutos,
  alternarAcelerado,
  alternarPausa,
  reiniciarReloj,
  useJornada,
} from '@/lib/datos/jornada';
import { HITOS_NOTIFICACION_SOL } from '@/lib/notificaciones/logicaNotificaciones';
import {
  DIAS_SEMANA,
  DURACION_SOL_MIN,
  ETIQUETAS_DIA,
  estadoTareaRespectoAHora,
} from '@/lib/reloj/relojMision';
import {
  ARTEFACTOS_NASA,
  PERFILES_SIMULACION,
  avanzarYSimularSoles,
  inyectarArtefactoEnSol,
} from '@/lib/simulador/artefactos';
import styles from './JornadaPantalla.module.scss';

const FILTROS = [
  { id: 'all', etiqueta: 'Todas' },
  { id: 'daily', etiqueta: 'Diarias' },
  { id: 'weekly', etiqueta: 'Semanales' },
  { id: 'event', etiqueta: 'Por evento' },
];

const ETIQUETA_RECURRENCIA = { weekly: 'Semanal', event: 'Por evento' };

const ETIQUETA_RUTA = {
  '/': 'Inicio',
  '/registrar': 'Registrar',
  '/cara': 'Abrir cámara',
  '/entrenador': 'Entrenador',
  '/enlace': 'Enlace Tierra',
  '/actividad/cognitivos': 'Tests',
  '/actividad/cognitivos#vision': 'Test visual',
  '/registrar#vision': 'Test visual',
};

const BLOQUES = [
  { id: 'despertar', nombre: 'Despertar', rango: '06:30 – 08:00', desde: 0, hasta: 480 },
  { id: 'manana', nombre: 'Mañana', rango: '08:00 – 12:30', desde: 480, hasta: 750 },
  { id: 'tarde', nombre: 'Tarde', rango: '12:30 – 18:00', desde: 750, hasta: 1080 },
  { id: 'noche', nombre: 'Noche', rango: '18:00 – 24:37', desde: 1080, hasta: DURACION_SOL_MIN },
];

// Horas con aviso programado por el motor de notificaciones (campana en la fila).
const HORAS_CON_AVISO = new Set(HITOS_NOTIFICACION_SOL.map((h) => h.hora));

function duracion(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function IconoCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconoCampana() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export default function JornadaPantalla() {
  const [filtro, setFiltro] = useState('all');
  const [simuladorAbierto, setSimuladorAbierto] = useState(false);
  const [perfilSim, setPerfilSim] = useState('nominal');
  const [simulando, setSimulando] = useState(false);
  const [ultimoResumenSim, setUltimoResumenSim] = useState(null);
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

  async function ejecutarSimulacion(cantidad) {
    if (simulando) return;
    setSimulando(true);
    try {
      const res = await avanzarYSimularSoles({ cantidad, perfil: perfilSim });
      const astroId = astronauta?.id ?? 'ana';
      const ev = res.evaluacionesPorTripulante[astroId];
      setUltimoResumenSim(
        `Avanzó de Sol ${res.solAnterior} a Sol ${res.solNuevo} (${res.lecturasGeneradas} lecturas NASA guardadas en BD). Nivel actual: ${ev?.globalLevel ?? 'green'}${ev?.alerts?.[0] ? ` · Alerta: ${ev.alerts[0].title}` : ' · Sin alertas'}.`,
      );
    } catch (e) {
      setUltimoResumenSim(`Error al simular: ${e?.message ?? 'desconocido'}`);
    } finally {
      setSimulando(false);
    }
  }

  async function simularArtefacto(artefactoId) {
    if (simulando) return;
    setSimulando(true);
    try {
      const res = await inyectarArtefactoEnSol({
        astronautId: astronauta?.id ?? 'ana',
        sol,
        artefactoId,
        perfil: perfilSim,
      });
      setUltimoResumenSim(
        `Artefacto "${ARTEFACTOS_NASA[artefactoId]?.nombre}" cargado en Sol ${res.sol} (${res.lecturas.length} lecturas). Evaluación: ${res.evaluacion.globalLevel}${res.evaluacion.alerts[0] ? ` · ${res.evaluacion.alerts[0].title}` : ''}.`,
      );
    } catch (e) {
      setUltimoResumenSim(`Error al inyectar artefacto: ${e?.message ?? 'desconocido'}`);
    } finally {
      setSimulando(false);
    }
  }


  const estados = useMemo(() => {
    const mapa = {};
    for (const t of tareas) mapa[t.id] = estadoTareaRespectoAHora(t, reloj.minutos);
    return mapa;
  }, [tareas, reloj.minutos]);

  const conteos = {
    all: tareas.length,
    daily: tareas.filter((t) => t.recurrence === 'daily').length,
    weekly: tareas.filter((t) => t.recurrence === 'weekly').length,
    event: tareas.filter((t) => t.recurrence === 'event').length,
  };

  const tareasFiltradas = filtro === 'all' ? tareas : tareas.filter((t) => t.recurrence === filtro);

  const grupos = BLOQUES.map((b) => {
    const lista = tareasFiltradas.filter((t) => t.horaMin >= b.desde && t.horaMin < b.hasta);
    const contieneAhora = reloj.minutos >= b.desde && reloj.minutos < b.hasta;
    return {
      ...b,
      lista,
      hechas: lista.filter((t) => t.done).length,
      contieneAhora,
      indiceAhora: contieneAhora ? lista.findIndex((t) => t.horaMin > reloj.minutos) : -2,
    };
  }).filter((g) => g.lista.length > 0);

  // Lo que toca: la tarea en ventana "ahora" o, si no hay, la atrasada más reciente.
  const enVentana = tareas.find((t) => estados[t.id] === 'ahora');
  const atrasadas = tareas.filter((t) => estados[t.id] === 'pasada');
  const actual = enVentana || atrasadas[atrasadas.length - 1] || null;
  const actualAtrasada = actual && estados[actual.id] === 'pasada';
  const siguiente = tareas.find((t) => estados[t.id] === 'pendiente');
  const otrasAtrasadas = atrasadas.filter((t) => t.id !== actual?.id);

  const hayEventos = conteos.event > 0;
  const nivelGlobal = evaluacion?.globalLevel || 'green';
  const horasEvento = tareas.filter((t) => t.recurrence === 'event').map((t) => t.missionTime);

  const estadoReloj = reloj.suenoProtegido
    ? { clase: styles.chipSueno, texto: 'Sueño protegido · solo alertas rojas' }
    : reloj.pausado
      ? { clase: styles.chipPausa, texto: 'Reloj en pausa' }
      : { clase: styles.chipCorriendo, texto: reloj.acelerado ? 'Reloj corriendo · 1 min = 1 h' : 'Reloj en tiempo real' };

  return (
    <PantallaVyta
      titulo="Jornada del sol"
      icono="/figma/salud/target.svg"
      subtitulo={`${astronauta?.name || 'Ana Ríos'} · Sol marciano de 24 h 37 min · ${ETIQUETAS_DIA[diaSemana] || 'Jueves'}`}
      acciones={
        <>
          <span className={`${styles.chipEstado} ${estadoReloj.clase}`} role="status">
            <span className={styles.chipPunto} aria-hidden="true" />
            {estadoReloj.texto}
          </span>
          <button
            type="button"
            className={`${styles.boton} ${simuladorAbierto ? styles.botonActivo : ''}`}
            onClick={() => setSimuladorAbierto((v) => !v)}
            aria-expanded={simuladorAbierto}
            aria-controls="simulador-reloj"
          >
            Simulador de reloj
          </button>
        </>
      }
    >
      {simuladorAbierto && (
        <Card titulo="Simulador del reloj marciano" id="simulador-reloj">
          <div className={styles.controlesCard}>
            <div className={styles.botonesReloj}>
              <button type="button" onClick={() => alternarPausa()} className={`${styles.boton} ${styles.botonPrimario}`}>
                {reloj.pausado ? '▶ Iniciar' : '⏸ Pausar'}
              </button>
              <button
                type="button"
                onClick={() => alternarAcelerado()}
                className={`${styles.boton} ${reloj.acelerado ? styles.botonAceleradoActivo : ''}`}
                aria-pressed={reloj.acelerado}
              >
                {reloj.acelerado ? 'Acelerado 1 min = 1 h' : 'Tiempo real 1:1'}
              </button>
              <button type="button" onClick={() => adelantarMinutos(15)} className={styles.boton}>+15 min</button>
              <button type="button" onClick={() => adelantarMinutos(60)} className={styles.boton}>+1 h</button>
              <button type="button" onClick={() => adelantarMinutos(240)} className={styles.boton}>+4 h</button>
              <button type="button" onClick={() => reiniciarReloj()} className={styles.boton}>↺ 06:30</button>
            </div>
            <label className={styles.selectorDia}>
              <span>Día semanal:</span>
              <select
                value={diaSemana}
                onChange={(e) => cambiarDiaSemana(e.target.value)}
                aria-label="Día semanal para probar tareas semanales"
              >
                {DIAS_SEMANA.map((d) => (
                  <option key={d} value={d}>{ETIQUETAS_DIA[d]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.controlesCard} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(130, 175, 220, 0.2)' }}>
            <label className={styles.selectorDia}>
              <span>Simular futuro (NASA):</span>
              <select
                value={perfilSim}
                onChange={(e) => setPerfilSim(e.target.value)}
                aria-label="Perfil de simulación por artefactos NASA"
              >
                {Object.values(PERFILES_SIMULACION).map((p) => (
                  <option key={p.id} value={p.id}>{p.etiqueta}</option>
                ))}
              </select>
            </label>
            <div className={styles.botonesReloj}>
              <button type="button" disabled={simulando} onClick={() => ejecutarSimulacion(1)} className={`${styles.boton} ${styles.botonPrimario}`}>
                {simulando ? 'Simulando…' : 'Simular +1 Sol'}
              </button>
              <button type="button" disabled={simulando} onClick={() => ejecutarSimulacion(3)} className={styles.boton}>+3 Soles</button>
              <button type="button" disabled={simulando} onClick={() => ejecutarSimulacion(7)} className={styles.boton}>+7 Soles</button>
              <button type="button" disabled={simulando} onClick={() => simularArtefacto('watch')} className={styles.boton}>⌚ Watch ahora</button>
              <button type="button" disabled={simulando} onClick={() => simularArtefacto('cabina_eclss')} className={styles.boton}>🛰️ Cabina ECLSS</button>
              <button type="button" disabled={simulando} onClick={() => simularArtefacto('cognitivo_camara')} className={styles.boton}>🧠 PVT + SANS</button>
            </div>
          </div>
          <p className={styles.notaNormal} style={{ marginTop: 8 }}>
            {ultimoResumenSim || PERFILES_SIMULACION[perfilSim]?.descripcion}
          </p>
        </Card>
      )}

      <div className={styles.columna}>
        <div className={styles.filaFoco}>
          <section
            className={`${styles.ahora} ${actualAtrasada ? styles.ahoraAtrasada : ''}`}
            aria-label="Lo que toca ahora"
          >
            {actual ? (
              <>
                <div className={styles.ahoraTexto}>
                  <p className={styles.ahoraEyebrow}>
                    {actualAtrasada ? `Atrasada · era a las ${actual.missionTime}` : `Ahora · ${actual.missionTime}`}
                  </p>
                  <h2>{actual.title}</h2>
                </div>
                <div className={styles.ahoraAcciones}>
                  {actual.ruta && (
                    <Link href={actual.ruta} className={styles.botonCta}>
                      {ETIQUETA_RUTA[actual.ruta] || 'Abrir'} →
                    </Link>
                  )}
                  <button type="button" className={styles.boton} onClick={() => alternarTarea(actual)}>
                    Marcar hecha
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.ahoraTexto}>
                <p className={styles.ahoraEyebrow}>{reloj.suenoProtegido ? 'Sueño protegido' : 'Al día'}</p>
                <h2>{reloj.suenoProtegido ? 'Descansá' : 'Nada pendiente por ahora'}</h2>
              </div>
            )}
            <div className={styles.ahoraPie}>
              {siguiente ? (
                <span>
                  Siguiente: <strong>{siguiente.title} · {siguiente.missionTime}</strong> (en{' '}
                  {duracion(siguiente.horaMin - reloj.minutos)})
                </span>
              ) : (
                <span>No quedan tareas por delante en este sol.</span>
              )}
              {otrasAtrasadas.length > 0 && (
                <span className={styles.textoAtrasada}>
                  {otrasAtrasadas.length === 1
                    ? `1 atrasada más: ${otrasAtrasadas[0].title} (${otrasAtrasadas[0].missionTime})`
                    : `${otrasAtrasadas.length} atrasadas más`}
                </span>
              )}
            </div>
          </section>

          <Card titulo="Contexto clínico" acento={nivelGlobal}>
            <div className={styles.estadoFila}>
              <TrafficLight nivel={nivelGlobal} />
              <span>{evaluacion?.alerts?.[0]?.title || 'Sin alertas activas en este sol'}</span>
            </div>
            <p className={hayEventos ? styles.notaEvento : styles.notaNormal}>
              {hayEventos
                ? `Se sumaron ${conteos.event} tareas por evento (${horasEvento.join(' y ')}) según tu evaluación actual.`
                : 'Sincronizá el Watch o registrá mediciones para autocompletar tareas.'}
            </p>
          </Card>
        </div>

          <Card titulo="Plan del sol">
            <div className={styles.cabeceraPlan}>
              <span className={styles.progresoTexto}>
                {completadas} de {total} hechas · {progresoPct} %
              </span>
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

            {grupos.length === 0 && (
              <p className={styles.vacio}>No hay tareas en esta categoría para el día seleccionado.</p>
            )}

            {grupos.map((g) => (
              <div key={g.id} className={styles.grupo}>
                <div className={styles.grupoCabecera}>
                  <h3>{g.nombre}</h3>
                  <span className={styles.grupoRango}>{g.rango}</span>
                  <span className={styles.grupoResumen}>{g.hechas} / {g.lista.length}</span>
                </div>
                <ol className={styles.lista}>
                  {g.lista.map((tarea, idx) => {
                    const estado = estados[tarea.id];
                    const accionVisible =
                      tarea.ruta && !tarea.done && (estado === 'ahora' || estado === 'pasada' || tarea.recurrence === 'event');
                    return (
                      <Fragment key={tarea.id}>
                        {g.indiceAhora === idx && <MarcadorAhora sol={sol} hora={reloj.horaFormateada} />}
                        <li
                          id={`tarea-${tarea.id}`}
                          className={`${styles.fila} ${estado === 'ahora' ? styles.filaAhora : ''}`}
                        >
                          <span className={styles.hora}>{tarea.missionTime}</span>
                          <span className={styles.checkCaja}>
                            <input
                              type="checkbox"
                              className={`${styles.check} ${styles[`check_${estado}`] || ''}`}
                              checked={tarea.done}
                              onChange={() => alternarTarea(tarea)}
                              aria-label={`Marcar "${tarea.title}" como completada`}
                            />
                            <IconoCheck />
                          </span>
                          <span className={styles.detalle}>
                            <span className={`${styles.titulo} ${tarea.done ? styles.tituloHecha : ''}`}>{tarea.title}</span>
                            {ETIQUETA_RECURRENCIA[tarea.recurrence] && (
                              <span className={`${styles.chip} ${tarea.recurrence === 'event' ? styles.chipEvento : styles.chipSemanal}`}>
                                {ETIQUETA_RECURRENCIA[tarea.recurrence]}
                              </span>
                            )}
                            {HORAS_CON_AVISO.has(tarea.missionTime) && (
                              <span className={styles.aviso} title="Tiene aviso programado">
                                <IconoCampana />
                                <span className={styles.oculto}>Con aviso</span>
                              </span>
                            )}
                          </span>
                          <span className={styles.accionesFila}>
                            {estado === 'pasada' && <span className={styles.textoAtrasada}>Atrasada</span>}
                            {estado === 'ahora' && !tarea.done && <span className={styles.textoAhora}>Ahora</span>}
                            {accionVisible && (
                              <Link href={tarea.ruta} className={styles.enlaceRuta}>
                                {ETIQUETA_RUTA[tarea.ruta] || 'Abrir'} →
                              </Link>
                            )}
                            {tarea.done && <span className={styles.textoHecha}>Hecha</span>}
                          </span>
                        </li>
                      </Fragment>
                    );
                  })}
                  {g.indiceAhora === -1 && <MarcadorAhora sol={sol} hora={reloj.horaFormateada} />}
                </ol>
              </div>
            ))}
        </Card>
      </div>
    </PantallaVyta>
  );
}

function MarcadorAhora({ sol, hora }) {
  return (
    <li className={styles.marcadorAhora} aria-label="Hora actual de misión">
      <span>Ahora · Sol {sol} · {hora}</span>
    </li>
  );
}
