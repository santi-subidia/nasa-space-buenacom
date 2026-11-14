'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SelectorTripulanteBarra } from '@/components/tripulacion/TripulacionPantalla';
import { RUTAS } from '@/lib/rutas';
import styles from './Sidebar.module.scss';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.lateral}>
      <div className={styles.marca}>
        <span className={styles.logo} aria-hidden="true">✦</span>
        <span className={styles.nombre}>AstroVitals</span>
      </div>

      <nav aria-label="Pantallas principales">
        <ul className={styles.lista}>
          {RUTAS.map((r) => {
            const activa = r.href === '/' ? pathname === '/' : pathname.startsWith(r.href);
            return (
              <li key={r.href}>
                <Link
                  href={r.href}
                  aria-current={activa ? 'page' : undefined}
                  className={[styles.enlace, activa && styles.activo, r.ia && styles.ia]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className={styles.icono} aria-hidden="true">{r.icono}</span>
                  {r.etiqueta}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <SelectorTripulanteBarra />

      <p className={styles.aviso}>Prototipo educativo. No es un dispositivo médico.</p>
    </aside>
  );
}
