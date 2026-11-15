import Link from 'next/link';
import { ETIQUETAS_DIA } from '@/lib/reloj/relojMision';
import styles from './Actividad.module.scss';

const ETIQUETA_INTENSIDAD = {
  normal: 'normal',
  moderada: 'moderate',
  liviana: 'light',
  reposo: 'rest',
};

function etiquetaObjetivo(item) {
  if (!item) return '';
  if (item.unidad === 'seconds' || item.unidad === 'segundos') return `${item.meta} s · ~${item.minutosSugeridos} min`;
  return `${item.meta} reps · ~${item.minutosSugeridos} min`;
}

export default function EjerciciosPendientes({
  tareas = [],
  planEjercicios = null,
  diaSemana = null,
  cargando = false,
  children,
  entrenamiento = false,
  onSeleccionarEjercicio = null,
  ejercicioActivo = null,
}) {
  const pendientesPlan = planEjercicios ? (planEjercicios.pendientes || []) : null;
  const cognitivos = !entrenamiento && planEjercicios ? (planEjercicios.cognitivosPendientes || []) : [];
  const pendientesTareas = tareas.filter((tarea) => tarea.kind === 'exercise' && !tarea.done);

  const diaEtiqueta = ETIQUETAS_DIA[planEjercicios?.diaSemana || diaSemana] || null;
  const intensidadLabel = ETIQUETA_INTENSIDAD[planEjercicios?.intensidad] || planEjercicios?.intensidad;
  const resumenPlan = planEjercicios
    ? planEjercicios.reposo
      ? `${diaEtiqueta ? `${diaEtiqueta} · ` : ''}Physical rest advised`
      : `${diaEtiqueta ? `${diaEtiqueta} · ` : ''}${intensidadLabel} intensity · ${planEjercicios.minutosObjetivo} min${planEjercicios.limitadoPorSalud ? ' · adapted to your health' : ''}`
    : null;

  const renderItem = (item) => {
    const activo = ejercicioActivo === item.id;
    const contenido = (
      <>
        <span className={styles.iconoTarea}>
          <img src="/figma/salud/dumbbell.svg" width="28" height="28" alt="" />
        </span>
        <span>
          <strong>{item.nombre}</strong>
          <small>
            {etiquetaObjetivo(item)}
            {item.enfoque || item.motivo ? ` · ${item.motivo}` : ''}
          </small>
        </span>
      </>
    );

    if (typeof onSeleccionarEjercicio === 'function') {
      return (
        <li key={item.id}>
          <button
            type="button"
            className={`${styles.tarea} ${styles.tareaBoton} ${activo ? styles.tareaActiva : ''}`}
            onClick={() => onSeleccionarEjercicio(item.id)}
            aria-pressed={activo}
          >
            {contenido}
          </button>
        </li>
      );
    }

    return (
      <li key={item.id}>
        <Link href={`/actividad/fisicos?ejercicio=${item.id}`} className={styles.tarea}>
          {contenido}
        </Link>
      </li>
    );
  };

  return (
    <section className={styles.pendientes} aria-label="Pending exercises">
      {!entrenamiento && (
        <h2 className={styles.tituloPendientes}>
          <span className={styles.iconoObjetivo}>
            <img src="/figma/salud/target.svg" width="23" height="23" alt="" />
          </span>
          Pending exercises
        </h2>
      )}
      {resumenPlan && <p className={styles.subtituloPlan}>{resumenPlan}</p>}

      {cargando ? (
        <p className={styles.sinPendientes} role="status">Loading exercises…</p>
      ) : pendientesPlan ? (
        planEjercicios.reposo ? (
          <p className={styles.sinPendientes}>{planEjercicios.motivo}</p>
        ) : pendientesPlan.length > 0 || cognitivos.length > 0 ? (
          <ul className={styles.listaPendientes}>
            {pendientesPlan.map(renderItem)}
            {cognitivos.map((cog) => (
              <li key={cog.id}>
                <Link href={cog.ruta} className={styles.tarea}>
                  <span className={styles.iconoTarea}>
                    <img src="/figma/salud/brain.svg" width="24" height="24" alt="" />
                  </span>
                  <span>
                    <strong>{cog.nombre}</strong>
                    <small>Suggested cognitive check for today</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.sinPendientes}>No pending exercises for this sol.</p>
        )
      ) : pendientesTareas.length ? (
        <ul className={styles.listaPendientes}>
          {pendientesTareas.map((tarea) => (
            <li key={tarea.id}>
              <Link href={tarea.ejerciciosSugeridos?.[0]?.id ? `/actividad/fisicos?ejercicio=${tarea.ejerciciosSugeridos[0].id}` : '/actividad/fisicos'} className={styles.tarea}>
                <span className={styles.iconoTarea}>
                  <img src="/figma/salud/dumbbell.svg" width="28" height="28" alt="" />
                </span>
                <span>
                  <strong>
                    {tarea.ejerciciosSugeridos?.length
                      ? tarea.ejerciciosSugeridos.map((e) => e.nombre).join(' · ')
                      : tarea.title}
                  </strong>
                  <small>
                    {tarea.title}
                    {tarea.missionTime ? ` · ${tarea.missionTime}` : ''}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.sinPendientes}>No pending exercises for this sol.</p>
      )}
      {children}
    </section>
  );
}
