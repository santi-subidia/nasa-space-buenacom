// Menú de la barra lateral VYTA, en orden.
// `prefijos`: rutas que marcan la entrada como activa (además de la propia, si no es `/`).
// Para agregar una pantalla: sumar una entrada (o subentrada) acá y crear app/<ruta>/page.js.
export const RUTAS = [
  { href: '/', etiqueta: 'Vista General', icono: 'inicio', prefijos: [], descripcion: 'Estado general, alertas, chequeo del día y voz VYTA.' },
  {
    href: '/salud/fisica', etiqueta: 'Salud', icono: 'salud', prefijos: ['/salud', '/mapa'],
    descripcion: 'Mapa corporal con las 9 zonas repartidas en Física, Mental y Riesgos.',
    sub: [
      { href: '/salud/fisica', nombre: 'Física' },
      { href: '/salud/mental', nombre: 'Mental' },
      { href: '/salud/riesgos', nombre: 'Riesgos' },
    ],
  },
  {
    href: '/actividad', etiqueta: 'Actividad', icono: 'actividad', prefijos: ['/actividad', '/entrenador', '/jornada'],
    descripcion: 'Ejercicios físicos y cognitivos, y la jornada del sol.',
    sub: [
      { href: '/actividad', nombre: 'Ejercicios', prefijos: ['/actividad', '/entrenador'] },
      { href: '/jornada', nombre: 'Jornada' },
    ],
  },
  { href: '/registrar', etiqueta: 'Registrar', icono: 'registrar', prefijos: ['/registrar', '/cara'], descripcion: 'Chequeo diario, foto de piel, tests y chequeo facial.' },
  { href: '/tendencias', etiqueta: 'Analítica', icono: 'analitica', prefijos: ['/tendencias'], descripcion: 'Tendencias con bandas de referencia y línea base.' },
  { href: '/enlace', etiqueta: 'Informes', icono: 'informes', prefijos: ['/enlace'], descripcion: 'Enlace con Tierra con retraso de señal y respuestas del médico de vuelo.' },
];

/** ¿La ruta (o subruta) corresponde a la página actual? */
export function rutaActiva(ruta, pathname) {
  if (ruta.href === '/') return pathname === '/';
  return (ruta.prefijos ?? [ruta.href]).some((p) => pathname.startsWith(p));
}
