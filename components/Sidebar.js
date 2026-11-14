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
  const esInicio = pathname === '/';
  const esSalud = pathname.startsWith('/salud');
  const esActividad = pathname.startsWith('/actividad') || pathname === '/entrenador';

  if (esInicio || esSalud || esActividad) {
    const menu = [
      { href: '/', etiqueta: 'Vista General', icono: 'inicio' },
      { href: '/salud/fisica', etiqueta: 'Salud', icono: 'salud' },
      { href: '/actividad', etiqueta: 'Actividad', icono: 'actividad' },
      { href: '/tendencias', etiqueta: 'Analítica', icono: 'analitica' },
      { href: '/enlace', etiqueta: 'Informes', icono: 'informes' },
    ];
    return (
      <aside className={`${styles.lateral} ${styles.prototipo}`}>
        <Link href="/" className={styles.marca} aria-label="VYTA · Inicio">
          <img src="/figma/marca.svg" width="231" height="155" alt="VYTA · Health Monitoring Software" />
        </Link>
        <nav aria-label="Pantallas principales">
          <ul className={styles.lista}>
            {menu.map((ruta) => {
              const activa = (ruta.icono === 'inicio' && esInicio) || (ruta.icono === 'salud' && esSalud) || (ruta.icono === 'actividad' && esActividad);
              return (
              <li key={ruta.href} className={esSalud && ruta.icono === 'salud' ? styles.grupoSalud : undefined}>
                <Link href={ruta.href} aria-current={activa ? 'page' : undefined} className={`${styles.enlace} ${activa ? styles.activo : ''}`}>
                  <img src={`/figma/nav-${ruta.icono}.svg`} width="24" height="24" alt="" />
                  {ruta.etiqueta}
                </Link>
                {esSalud && ruta.icono === 'salud' && (
                  <ul className={styles.submenu} aria-label="Secciones de salud">
                    {[
                      { href: '/salud/fisica', nombre: 'Física' },
                      { href: '/salud/mental', nombre: 'Mental' },
                      { href: '/salud/riesgos', nombre: 'Riesgos' },
                    ].map((subruta) => (
                      <li key={subruta.href}>
                        <Link href={subruta.href} aria-current={pathname === subruta.href ? 'page' : undefined}>{subruta.nombre}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    );
  }

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
