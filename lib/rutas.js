// Pantallas de la app, en el orden de la barra lateral.
// Para agregar una pantalla: sumar una entrada acá y crear app/<ruta>/page.js.
export const RUTAS = [
  { href: '/', etiqueta: 'Inicio', icono: '◉', descripcion: 'Semáforo general, alerta activa y chequeo del día.' },
  { href: '/jornada', etiqueta: 'Jornada', icono: '◔', descripcion: 'Reloj marciano de 24 h 37 min y tareas del sol.' },
  { href: '/mapa', etiqueta: 'Mapa corporal', icono: '☍', descripcion: '9 zonas clicables con función, riesgos, indicadores y fuente.' },
  { href: '/registrar', etiqueta: 'Registrar', icono: '✎', descripcion: 'Formulario del chequeo, ánimo y foto de piel.' },
  { href: '/tendencias', etiqueta: 'Tendencias', icono: '⌇', descripcion: 'Sueño, estrés, temperatura y ánimo con bandas y línea base.' },
  { href: '/cabina', etiqueta: 'Cabina y radiación', icono: '☢', descripcion: 'Dosímetro personal, tormenta solar, CO₂, O₂ y ruido del hábitat.' },
  { href: '/entrenador', etiqueta: 'Entrenador', icono: '⚡', descripcion: 'Webcam con esqueleto, contador de repeticiones y correcciones.' },
  { href: '/cara', etiqueta: '¿Cómo me ves hoy?', icono: '◐', descripcion: 'Comparación facial y parpadeo con la foto base.', ia: true },
  { href: '/junta', etiqueta: 'Junta médica', icono: '✚', descripcion: '5 especialistas, desacuerdos y los dos informes.' },
  { href: '/enlace', etiqueta: 'Enlace con Tierra', icono: '⇄', descripcion: 'Recorrido del informe con retraso y bandeja de respuestas.' },
  { href: '/houston', etiqueta: 'Consola Houston', icono: '🛰', descripcion: 'Bandeja de la médica de vuelo en Tierra, RAG clínico y dictamen hacia Marte.' },
  { href: '/vega', etiqueta: 'Hablar con Vega', icono: '✦', descripcion: 'Conversación por voz con citas.', ia: true },
  { href: '/tripulacion', etiqueta: 'Tripulación', icono: '👥', descripcion: 'Selector de tripulante, privacidad y vista del oficial médico.' },
];
