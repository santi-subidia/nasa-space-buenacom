import Link from 'next/link';
import styles from './Actividad.module.scss';

export default function EjerciciosPendientes({ tareas = [], cargando = false, children, entrenamiento = false }) {
  const pendientes = tareas.filter((tarea) => tarea.kind === 'exercise' && !tarea.done);
  return <section className={styles.pendientes} aria-label="Ejercicios pendientes">
    {!entrenamiento && <h2 className={styles.tituloPendientes}><span className={styles.iconoObjetivo}><img src="/figma/salud/target.svg" width="23" height="23" alt="" /></span>Ejercicios pendientes</h2>}
    {cargando ? <p className={styles.sinPendientes} role="status">Cargando ejercicios…</p> : pendientes.length ? <ul className={styles.listaPendientes}>
      {pendientes.map((tarea) => <li key={tarea.id}>
        <Link href="/actividad/fisicos" className={styles.tarea}>
          <span className={styles.iconoTarea}><img src="/figma/salud/dumbbell.svg" width="28" height="28" alt="" /></span>
          <span><strong>Ejercicio de resistencia</strong><small>{tarea.title}{tarea.missionTime ? ` · ${tarea.missionTime}` : ''}</small></span>
        </Link>
      </li>)}
    </ul> : <p className={styles.sinPendientes}>Sin ejercicios pendientes para este sol.</p>}
    {children}
  </section>;
}
