// DATOS DE MENTIRA (mock) hasta integrar #3 (motor de reglas) y #4 (datos de demo).
// La historia: "Día 42 en Marte" (ver doc/proyecto/plan/prototipo.md §5).

export const SOL_ACTUAL = 42;
export const SOLES_MISION = 60;

export const MISION = {
  astronauta: { id: 'ana', nombre: 'Ana', rol: 'crew' },
  entorno: 'Base Marte',
  retrasoMin: 14,
  proximoContacto: '16:00 hora de misión',
  rachaEjercicio: 12,
  tripulacion: { total: 5, conEjercicioHoy: 4 },
};

// Alerta activa que dispara la regla compuesta `viral_reactivation` (se reemplaza con #3).
export const ALERTA_ACTIVA = {
  id: 'viral_reactivation',
  nivel: 'orange',
  zona: 'immune',
  titulo: 'Posible reactivación viral',
  porQue:
    'Dormiste menos de 6 h durante varias noches, el estrés está alto y apareció una lesión en el labio con 37,6 °C de temperatura. Juntos pueden reactivar virus latentes.',
  acciones: [
    'Higiene de manos y no compartir utensilios',
    'Priorizar 8 h de sueño esta noche',
    'Avisar al oficial médico de la tripulación',
  ],
  fuente: 'NASA HRP · Risk of Altered Immune System Responses',
};
