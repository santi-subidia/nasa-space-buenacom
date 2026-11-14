'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SelectorTripulanteBarra } from '@/components/tripulacion/TripulacionPantalla';
import { useSesion } from '@/lib/auth/sesion';
import { estaSupabaseConfigurado } from '@/lib/supabase/cliente';
import { RUTAS } from '@/lib/rutas';
import styles from './Sidebar.module.scss';

export default function Sidebar() {
  const pathname = usePathname();
  const sesion = useSesion();
  const supabaseOk = estaSupabaseConfigurado();

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

      <Link
        href="/login"
        className={`${styles.cuentaCard} ${pathname.startsWith('/login') ? styles.cuentaActiva : ''}`}
      >
        <div className={styles.cuentaTop}>
          <span className={styles.cuentaNombre}>{sesion.nombre}</span>
          <span className={`${styles.nubeDot} ${supabaseOk ? styles.nubeOk : ''}`} title={supabaseOk ? 'Supabase PostgreSQL conectado' : 'Modo local'}>●</span>
        </div>
        <span className={styles.cuentaMeta}>{sesion.entorno} · Cambiar rol</span>
      </Link>

      <p className={styles.aviso}>Prototipo educativo. No es un dispositivo médico.</p>
    </aside>
  );
}
