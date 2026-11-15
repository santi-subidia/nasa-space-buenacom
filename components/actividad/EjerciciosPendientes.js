import Link from 'next/link';
import { ETIQUETAS_DIA } from '@/lib/reloj/relojMision';
import styles from './Actividad.module.scss';

function etiquetaObjetivo(item) {
  if (!item) return '';
  if (item.unidad === 'segundos') return `${item.meta} s · ~${item.minutosSugeridos} min`;
  return `${item.meta} repeticiones · ~${item.minutosSugeridos} min`;
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
  const resumenPlan = planEjercicios
    ? planEjercicios.reposo
      ? `${diaEtiqueta ? `${diaEtiqueta} · ` : ''}Reposo físico indicado`
      : `${diaEtiqueta ? `${diaEtiqueta} · ` : ''}Intensidad ${planEjercicios.intensidad} · ${planEjercicios.minutosObjetivo} min${planEjercicios.limitadoPorSalud ? ' · adaptado a tu salud' : ''}`
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
    <section className={styles.pendientes} aria-label="Ejercicios pendientes">
      {!entrenamiento && (
        <h2 className={styles.tituloPendientes}>
          <span className={styles.iconoObjetivo}>
            <img src="/figma/salud/target.svg" width="23" height="23" alt="" />
          </span>
          Ejercicios pendientes
        </h2>
      )}
      {resumenPlan && <p className={styles.subtituloPlan}>{resumenPlan}</p>}

      {cargando ? (
        <p className={styles.sinPendientes} role="status">Cargando ejercicios…</p>
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
                    <small>Control cognitivo sugerido para hoy</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.sinPendientes}>Sin ejercicios pendientes para este sol.</p>
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
        <p className={styles.sinPendientes}>Sin ejercicios pendientes para este sol.</p>
      )}
      {children}
    </section>
  );
}
