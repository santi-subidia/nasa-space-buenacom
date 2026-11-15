'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RUTAS, rutaActiva } from '@/lib/rutas';
import styles from './Sidebar.module.scss';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.lateral}>
      <Link href="/" className={styles.marca} aria-label="VYTA · Home">
        <img src="/figma/marca.svg" width="231" height="155" alt="VYTA · Health Monitoring Software" />
      </Link>
      <nav aria-label="Primary navigation">
        <ul className={styles.lista}>
          {RUTAS.map((ruta) => {
            const activa = rutaActiva(ruta, pathname);
            const abierto = activa && ruta.sub;
            return (
              <li key={ruta.href} className={abierto ? styles.grupoSalud : undefined}>
                <Link href={ruta.href} aria-current={activa && !ruta.sub ? 'page' : undefined} className={`${styles.enlace} ${activa ? styles.activo : ''}`}>
                  <img src={`/figma/nav-${ruta.icono}.svg`} width="24" height="24" alt="" />
                  {ruta.etiqueta}
                </Link>
                {abierto && (
                  <ul className={styles.submenu} aria-label={`${ruta.etiqueta} sections`}>
                    {ruta.sub.map((subruta) => (
                      <li key={subruta.href}>
                        <Link href={subruta.href} aria-current={rutaActiva(subruta, pathname) ? 'page' : undefined}>{subruta.nombre}</Link>
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
