'use client';

import Link from 'next/link';
import CabeceraMision from '@/components/layout/CabeceraMision';
import { useJornada } from '@/lib/datos/jornada';
import EjerciciosPendientes from './EjerciciosPendientes';
import styles from './Actividad.module.scss';

export default function ActividadPantalla() {
  const { astronauta, sol, diaSemana, planEjercicios, tareas, cargando } = useJornada();
  return <div className={styles.pantalla} data-dashboard>
    <CabeceraMision nombre={astronauta?.name} titulo={astronauta?.titulo} sol={sol} />
    <h1 className={styles.oculto}>Activity</h1>
    <div className={styles.seleccion}>
      <Link href="/actividad/fisicos" className={styles.opcion}>
        <h2>Physical exercises</h2>
        <span className={styles.iconoOpcion}><img src="/figma/salud/dumbbell.svg" width="64" height="64" alt="" /></span>
        <p>Routines to build muscle strength and maintain mobility.</p>
      </Link>
      <Link href="/actividad/cognitivos" className={styles.opcion}>
        <h2>Cognitive exercises</h2>
        <span className={styles.iconoOpcion}><img src="/figma/salud/brain.svg" width="64" height="64" alt="" /></span>
        <p>Attention, balance, and vision tests to track your mission performance.</p>
      </Link>
      <EjerciciosPendientes tareas={tareas} planEjercicios={planEjercicios} diaSemana={diaSemana} cargando={cargando} />
    </div>
  </div>;
}
