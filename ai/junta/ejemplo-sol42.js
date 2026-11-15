// Entrada de ejemplo de la junta para la historia "Día 42 en Marte" (doc/proyecto/plan/prototipo.md §5):
// sueño ~5,5 h, estrés alto, herpes labial el sol 41 y temperatura de 37,6 °C → regla viral_reactivation 🟠.
// Es de mentira y con la forma de los tipos de #2; se reemplaza por los datos de #4 cuando existan.
// Sirve para `npm run probar:junta`, para las pruebas y para la demo con IA apagada.

const SOLES = [36, 37, 38, 39, 40, 41, 42];
const serie = (indicador, unidad, valores) =>
  SOLES.map((sol, i) => ({ id: `${indicador}-${sol}`, astronautId: 'ana', indicator: indicador, value: valores[i], unit: unidad, ts: `S${sol} 06:45`, source: 'manual' }));

export const ENTRADA_SOL42 = {
  astronauta: { id: 'ana', nombre: 'Nicolás' },
  sol: 42,
  entorno: 'mars_base',
  nivelMotor: 'orange',
  alertas: [
    {
      id: 'a1',
      level: 'orange',
      zone: 'immune',
      ruleId: 'viral_reactivation',
      title: 'Possible viral reactivation',
      why: 'Average sleep 5.3 h and stress 8/10 over the last 3 days, with a cold sore and 37.6 °C.',
      actions: ['Hygiene & avoid sharing utensils', 'Prioritize 8 h of sleep', 'Notify the medical officer'],
      escalate: 'cmo',
    },
  ],
  sintomas: [{ id: 's1', astronautId: 'ana', bodyZone: 'immune', code: 'cold_sore', severity: 2, ts: 'S41 07:10' }],
  lecturas: [
    ...serie('sleep_h', 'h', [6.0, 5.5, 5.4, 5.6, 5.2, 5.0, 5.3]),
    ...serie('stress', 'pts', [7, 7, 8, 7, 8, 8, 8]),
    ...serie('mood', 'pts', [3, 3, 2, 3, 2, 2, 2]),
    ...serie('temp', '°C', [36.8, 36.9, 36.8, 37.0, 37.1, 37.4, 37.6]),
    ...serie('hr_rest', 'bpm', [62, 63, 64, 65, 66, 68, 70]),
    ...serie('bp_sys', 'mmHg', [118, 119, 118, 121, 120, 122, 121]),
    ...serie('bp_dia', 'mmHg', [76, 77, 76, 78, 78, 79, 78]),
    ...serie('exercise_min', 'min', [90, 90, 80, 60, 60, 45, 40]),
    ...serie('water_ml', 'ml', [2400, 2300, 2200, 2100, 2100, 2000, 1900]),
  ],
};
