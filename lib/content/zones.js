// Contenido educativo del mapa corporal. Sale de doc/proyecto/sintesis/matriz-peligro-riesgo-indicador.md
// y de las fichas de doc/nasa/riesgos/**. Las 9 zonas se evalúan 100 % contra registros reales de la BD.

export const PELIGROS = {
  R: 'Radiación',
  I: 'Aislamiento',
  D: 'Distancia de la Tierra',
  G: 'Gravedad',
  E: 'Entorno hostil y cerrado',
};

const DOC = 'https://github.com/santi-subidia/nasa-space-buenacom/blob/main/doc/nasa/riesgos/';

// `indicadores`:
//   - `{ clave }` toma la lectura persistida en BD para esa clave (`evaluate` + `baseline`).
//   - `{ cabina }` toma la telemetría ambiental de cabina persistida en BD para el `sol` activo.
//   - `{ sintoma, nombre, textoSin }` consulta síntomas reportados en BD.
//   - `{ derivado, nombre }` se calcula dinámicamente en `evaluarZonas` desde el historial de la BD.
export const ZONAS = [
  {
    id: 'brain',
    nombre: 'Cerebro y mente',
    funcion: 'Cognición, ánimo, sueño y orientación. El aislamiento, el mal sueño y la radiación lo afectan.',
    riesgos: ['Conducta y trastornos psiquiátricos', 'Sueño y horarios irregulares', 'Efectos de la radiación en el sistema nervioso central', 'Hipoxia'],
    peligros: ['I', 'R', 'E'],
    indicadores: [{ clave: 'sleep_h' }, { clave: 'mood' }, { clave: 'stress' }],
    queHacer: ['Mantener horarios fijos de sueño y luz', 'Contar cómo te sentís: Vega y el oficial médico escuchan', 'Hacer el test de reacción de 30 s'],
    fuente: { titulo: 'NASA HRP · Sueño y horarios irregulares', url: `${DOC}conducta/sueno-horarios.md` },
  },
  {
    id: 'eyes',
    nombre: 'Ojos',
    funcion: 'Visión. En microgravedad los fluidos se desplazan hacia la cabeza y pueden cambiar la forma del ojo (síndrome SANS).',
    riesgos: ['SANS (síndrome neuro-ocular asociado al vuelo espacial)', 'Cataratas por radiación'],
    peligros: ['G', 'R'],
    indicadores: [
      { clave: 'visual_acuity' },
      { sintoma: 'blurred_vision', nombre: 'Visión borrosa', textoSin: 'No reportada' },
    ],
    queHacer: ['Repetir el minitest de agudeza visual cada semana', 'Avisar si la visión borrosa dura más de un día'],
    enlace: { href: '/registrar#vision', etiqueta: 'Hacer test visual' },
    fuente: { titulo: 'NASA HRP · SANS', url: `${DOC}fisiologia/sans-ojos.md` },
  },
  {
    id: 'inner_ear',
    nombre: 'Oído interno',
    funcion: 'Equilibrio y orientación. Al cambiar de gravedad el cerebro tiene que reaprender qué es arriba y abajo.',
    riesgos: ['Función sensoriomotora y vestibular alterada', 'Pérdida auditiva por ruido'],
    peligros: ['G', 'E'],
    indicadores: [
      { sintoma: 'dizzy_standing', nombre: 'Mareo al moverse', textoSin: 'Sin mareo' },
      { cabina: 'ruido', nombre: 'Ruido de cabina' },
    ],
    queHacer: ['Moverse despacio tras cambios de gravedad', 'Usar protección auditiva en zonas ruidosas'],
    fuente: { titulo: 'NASA HRP · Sensoriomotor y vestibular', url: `${DOC}fisiologia/sensoriomotor-vestibular.md` },
  },
  {
    id: 'heart',
    nombre: 'Corazón y vasos',
    funcion: 'Bombear sangre. En microgravedad el corazón se vuelve más esférico y al volver a una gravedad mayor puede costar mantener la presión.',
    riesgos: ['Adaptaciones cardiovasculares (mareo al pararse, arritmias)', 'Trombo venoso (cuello y brazos)'],
    peligros: ['G', 'R'],
    indicadores: [{ clave: 'bp_sys' }, { clave: 'bp_dia' }, { clave: 'hr_rest' }],
    queHacer: ['Beber líquidos según el protocolo', 'Pararse despacio', 'Avisar de inmediato si se hincha un lado del cuello o un brazo'],
    fuente: { titulo: 'NASA HRP · Cardiovascular', url: `${DOC}fisiologia/cardiovascular.md` },
  },
  {
    id: 'lungs',
    nombre: 'Pulmones',
    funcion: 'Llevar oxígeno a la sangre. La calidad del aire de la cabina (O₂, CO₂, polvo) importa más que en la Tierra.',
    riesgos: ['Hipoxia', 'CO₂ elevado', 'Polvo planetario', 'Capacidad aeróbica'],
    peligros: ['E', 'G'],
    indicadores: [{ clave: 'spo2' }, { cabina: 'co2', nombre: 'CO₂ de cabina' }],
    queHacer: ['Revisar el ambiente si hay dolor de cabeza y SpO₂ baja', 'Descansar y reportar si SpO₂ < 94 %'],
    fuente: { titulo: 'NASA HRP · Hipoxia', url: `${DOC}fisiologia/hipoxia.md` },
  },
  {
    id: 'immune',
    nombre: 'Sistema inmune',
    funcion: 'Defensa del cuerpo (sangre y piel). El estrés y la falta de sueño pueden reactivar virus latentes como el herpes.',
    riesgos: ['Respuestas inmunes alteradas', 'Interacción con microorganismos de la nave'],
    peligros: ['E', 'R', 'I'],
    indicadores: [
      { clave: 'temp' },
      { clave: 'stress' },
      { sintoma: 'cold_sore', nombre: 'Erupción (foto)', textoSin: 'Sin lesiones reportadas' },
    ],
    queHacer: ['Higiene de manos y no compartir utensilios', 'Priorizar 8 h de sueño', 'Avisar al oficial médico de la tripulación'],
    fuente: { titulo: 'NASA HRP · Sistema inmune alterado', url: `${DOC}fisiologia/inmunidad.md` },
  },
  {
    id: 'kidneys',
    nombre: 'Riñones',
    funcion: 'Filtrar la sangre. En microgravedad el calcio de los huesos sube en la orina y puede formar cálculos.',
    riesgos: ['Cálculos renales', 'Retención urinaria'],
    peligros: ['G'],
    indicadores: [
      { derivado: 'agua_ayer', nombre: 'Agua reciente' },
      { sintoma: 'flank_pain', nombre: 'Dolor en el flanco', textoSin: 'No' },
    ],
    queHacer: ['Tomar al menos 2 L de agua por día', 'Avisar ante dolor fuerte en un costado'],
    fuente: { titulo: 'NASA HRP · Hueso (incluye cálculos renales)', url: `${DOC}fisiologia/hueso.md` },
  },
  {
    id: 'muscles',
    nombre: 'Músculos',
    funcion: 'Fuerza y movimiento. Sin carga de gravedad se pierde entre 10 y 12 % de la masa muscular.',
    riesgos: ['Capacidad física y musculoesquelética reducida'],
    peligros: ['G'],
    indicadores: [
      { derivado: 'ejercicio_hoy', nombre: 'Ejercicio del sol' },
      { derivado: 'racha_ejercicio', nombre: 'Racha' },
    ],
    queHacer: ['Completar la rutina: la meta es 1,5 h por día', 'Usar el Entrenador para contar y corregir la postura'],
    fuente: { titulo: 'NASA HRP · Capacidad física', url: `${DOC}fisiologia/capacidad-fisica.md` },
  },
  {
    id: 'bones',
    nombre: 'Huesos',
    funcion: 'Soporte del cuerpo. Sin carga de gravedad se pierde entre 1 y 1,5 % de hueso por mes.',
    riesgos: ['Pérdida ósea', 'Riesgo de fractura'],
    peligros: ['G'],
    indicadores: [
      { derivado: 'soles_mision', nombre: 'Soles en gravedad reducida' },
      { derivado: 'ejercicio_carga_semanal', nombre: 'Promedio semanal de carga' },
    ],
    queHacer: ['Ejercicio de resistencia todos los días', 'Cuidar el calcio y la vitamina D según el protocolo'],
    fuente: { titulo: 'NASA HRP · Hueso', url: `${DOC}fisiologia/hueso.md` },
  },
];
