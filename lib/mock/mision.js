// DATOS DE MENTIRA (mock) hasta integrar #3 (motor de reglas) y #4 (datos de demo).
// La historia: "Día 42 en Marte" (ver doc/proyecto/plan/prototipo.md §5).

export const SOL_ACTUAL = 42;
export const SOLES_MISION = 60;

export const MISION = {
  astronauta: { id: 'ana', nombre: 'Nicolás', rol: 'crew' },
  entorno: 'Mars Base',
  retrasoMin: 14,
  proximoContacto: '16:00 mission time',
  rachaEjercicio: 12,
  tripulacion: { total: 5, conEjercicioHoy: 4 },
};

// Alerta activa que dispara la regla compuesta `viral_reactivation` (se reemplaza con #3).
export const ALERTA_ACTIVA = {
  id: 'viral_reactivation',
  nivel: 'orange',
  zona: 'immune',
  titulo: 'Possible viral reactivation',
  porQue:
    'You slept under 6 h for several nights, stress is high, and a lip lesion appeared with a 37.6 °C temperature. Together they can reactivate latent viruses.',
  acciones: [
    'Hand hygiene and avoid sharing utensils',
    'Prioritize 8 h of sleep tonight',
    'Notify the Crew Medical Officer',
  ],
  fuente: 'NASA HRP · Risk of Altered Immune System Responses',
};
