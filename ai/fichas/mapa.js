// Relaciones escritas a mano entre zonas del cuerpo, especialistas de la junta y riesgos.
// Los ids de riesgo son los nombres de archivo de doc/nasa/riesgos/** (ver indice.generado.json).
// Fuente de las zonas: doc/proyecto/sintesis/matriz-peligro-riesgo-indicador.md

/** Zona del mapa corporal -> riesgos que la tocan. */
export const ZONAS = {
  cerebro: ['conducta-psiquiatria', 'sueno-horarios', 'hipoxia', 'cancer-por-radiacion'],
  ojos: ['sans-ojos', 'cancer-por-radiacion'],
  oido: ['sensoriomotor-vestibular'],
  corazon: ['cardiovascular'],
  pulmones: ['hipoxia', 'capacidad-fisica'],
  inmune: ['inmunidad', 'microorganismos'],
  huesos: ['hueso'],
  musculos: ['capacidad-fisica'],
  rinones: ['hueso', 'nutricion'],
  digestivo: ['nutricion', 'microorganismos'],
  adn: ['cancer-por-radiacion'],
  cuerpo: ['cargas-dinamicas', 'eva', 'descompresion'],
};

/** Los 5 especialistas de la junta médica (#16) -> riesgos que revisa cada uno. */
export const ESPECIALISTAS = {
  cardiovascular: ['cardiovascular', 'hipoxia', 'descompresion'],
  inmunidad: ['inmunidad', 'microorganismos', 'cancer-por-radiacion'],
  'conducta-y-sueno': ['conducta-psiquiatria', 'sueno-horarios', 'trabajo-en-equipo'],
  'hueso-y-musculo': ['hueso', 'capacidad-fisica', 'nutricion'],
  ambiente: ['soporte-sistemas', 'eva', 'cargas-dinamicas', 'sans-ojos', 'sensoriomotor-vestibular'],
};
