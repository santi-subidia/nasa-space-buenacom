// Pantallas de la app, en el orden de la barra lateral.
// Para agregar una pantalla: sumar una entrada acá y crear app/<ruta>/page.js.
export const RUTAS = [
  { href: '/', etiqueta: 'Inicio', icono: '◉', descripcion: 'Semáforo general, alerta activa y chequeo del día.' },
  { href: '/mapa', etiqueta: 'Mapa corporal', icono: '☍', descripcion: '9 zonas clicables con función, riesgos, indicadores y fuente.' },
  { href: '/registrar', etiqueta: 'Registrar', icono: '✎', descripcion: 'Formulario del chequeo, ánimo y foto de piel.' },
  { href: '/tendencias', etiqueta: 'Tendencias', icono: '⌇', descripcion: 'Sueño, estrés, temperatura y ánimo con bandas y línea base.' },
  { href: '/entrenador', etiqueta: 'Entrenador', icono: '⚡', descripcion: 'Webcam con esqueleto, contador de repeticiones y correcciones.' },
  { href: '/junta', etiqueta: 'Junta médica', icono: '✚', descripcion: '5 especialistas, desacuerdos y los dos informes.' },
  { href: '/enlace', etiqueta: 'Enlace con Tierra', icono: '⇄', descripcion: 'Recorrido del informe con retraso y bandeja de respuestas.' },
  { href: '/vega', etiqueta: 'Hablar con Vega', icono: '✦', descripcion: 'Conversación por voz con citas.', ia: true },
];
