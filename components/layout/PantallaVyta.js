'use client';

import CabeceraMision from '@/components/layout/CabeceraMision';
import { TRIPULANTES } from '@/lib/demo/generador';
import { useTripulanteActivo } from '@/lib/datos/tripulante';
import { MISION } from '@/lib/mock/mision';
import styles from './PantallaVyta.module.scss';

/**
 * Contenedor común de las pantallas con el diseño del home (VYTA):
 * cabecera de misión, título con la tipografía del Figma y acciones a la derecha.
 * `data-dashboard` activa el layout ancho y el escalado de app/layout.module.scss.
 */
export default function PantallaVyta({ titulo, subtitulo, icono, acciones, children, className = '', ...props }) {
  const activo = useTripulanteActivo();
  const tripulante = TRIPULANTES.find((t) => t.id === activo);
  return (
    <div className={`${styles.pantalla} ${className}`} data-dashboard {...props}>
      <CabeceraMision nombre={tripulante?.name || MISION.astronauta.nombre} titulo={tripulante?.titulo || 'Tripulante de misión'} />
      <header className={styles.titulo}>
        {icono && <span className={styles.icono} aria-hidden="true"><img src={icono} width="26" height="26" alt="" /></span>}
        <div>
          <h1>{titulo}</h1>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
        {acciones && <div className={styles.acciones}>{acciones}</div>}
      </header>
      {children}
    </div>
  );
}
