// Menú de la barra lateral VYTA, en orden.
// `prefijos`: rutas que marcan la entrada como activa (además de la propia, si no es `/`).
// Para agregar una pantalla: sumar una entrada (o subentrada) acá y crear app/<ruta>/page.js.
export const RUTAS = [
  { href: '/', etiqueta: 'Overview', icono: 'inicio', prefijos: [], descripcion: 'Overall status, alerts, sol check-in, and VYTA voice.' },
  {
    href: '/salud/fisica', etiqueta: 'Health', icono: 'salud', prefijos: ['/salud', '/mapa'],
    descripcion: 'Body map with the 9 zones organized into Physical, Mental, and Risks.',
    sub: [
      { href: '/salud/fisica', nombre: 'Physical' },
      { href: '/salud/mental', nombre: 'Mental' },
      { href: '/salud/riesgos', nombre: 'Risks' },
    ],
  },
  {
    href: '/actividad', etiqueta: 'Activity', icono: 'actividad', prefijos: ['/actividad', '/entrenador', '/jornada'],
    descripcion: 'Physical and cognitive exercises, and your sol schedule.',
    sub: [
      { href: '/actividad', nombre: 'Exercises', prefijos: ['/actividad', '/entrenador'] },
      { href: '/jornada', nombre: 'Schedule' },
    ],
  },
  { href: '/registrar', etiqueta: 'Log', icono: 'registrar', prefijos: ['/registrar', '/cara'], descripcion: 'Sol check-in, skin photo, tests, and facial check.' },
  { href: '/tendencias', etiqueta: 'Analytics', icono: 'analitica', prefijos: ['/tendencias'], descripcion: 'Trends with reference bands and personal baseline.' },
  { href: '/enlace', etiqueta: 'Reports', icono: 'informes', prefijos: ['/enlace'], descripcion: 'Earth link with signal delay and flight surgeon responses.' },
];

/** ¿La ruta (o subruta) corresponde a la página actual? */
export function rutaActiva(ruta, pathname) {
  if (ruta.href === '/') return pathname === '/';
  return (ruta.prefijos ?? [ruta.href]).some((p) => pathname.startsWith(p));
}
