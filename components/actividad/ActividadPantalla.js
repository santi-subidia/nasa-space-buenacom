'use client';

import Link from 'next/link';
import CabeceraMision from '@/components/layout/CabeceraMision';
import { useJornada } from '@/lib/datos/jornada';
import EjerciciosPendientes from './EjerciciosPendientes';
import styles from './Actividad.module.scss';

export default function ActividadPantalla() {
  const { astronauta, sol, tareas, cargando } = useJornada();
  return <div className={styles.pantalla} data-dashboard>
    <CabeceraMision nombre={astronauta?.name} titulo={astronauta?.titulo} sol={sol} />
    <h1 className={styles.oculto}>Actividad</h1>
    <div className={styles.seleccion}>
      <Link href="/actividad/fisicos" className={styles.opcion}>
        <h2>Ejercicios físicos</h2>
        <span className={styles.iconoOpcion}><img src="/figma/salud/dumbbell.svg" width="64" height="64" alt="" /></span>
        <p>Rutinas para fortalecer los músculos y mantener la movilidad.</p>
      </Link>
      <Link href="/actividad/cognitivos" className={styles.opcion}>
        <h2>Ejercicios cognitivos</h2>
        <span className={styles.iconoOpcion}><img src="/figma/salud/brain.svg" width="64" height="64" alt="" /></span>
        <p>Tests de atención, equilibrio y visión para seguir tu rendimiento en la misión.</p>
      </Link>
      <EjerciciosPendientes tareas={tareas} cargando={cargando} />
    </div>
  </div>;
}
