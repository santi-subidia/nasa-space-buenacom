// Convierte la respuesta de POST /api/claude (tipo "board") en lo que necesita la pantalla Junta médica:
// 5 especialistas con su semáforo, desacuerdos resueltos, la síntesis y las pestañas "Para Ana" /
// "Para médicos de vuelo". Sin React: la pantalla (P1, prototipo "5") solo dibuja esto.

const NOMBRES = {
  cardiovascular: 'Cardiovascular',
  inmunidad: 'Inmunidad',
  'conducta-y-sueno': 'Conducta y sueño',
  'hueso-y-musculo': 'Hueso y músculo',
  ambiente: 'Ambiente',
};

const ACCIONES = {
  continuar: 'Seguir con la rutina',
  vigilar: 'Vigilar y volver a medir',
  avisar_oficial_medico: 'Avisar al oficial médico',
  contactar_medicos_de_vuelo: 'Contactar a los médicos de vuelo',
};

/** @returns {object|null} null si la junta no llegó (sin respuesta guardada y sin IA). */
export function armarVistaJunta(respuesta, nombreAstronauta = 'el tripulante') {
  if (!respuesta?.ok || !respuesta.junta) return null;
  const { junta } = respuesta;
  return {
    nivelFinal: respuesta.nivelFinal,
    nivelMotor: respuesta.nivelMotor,
    nivelJunta: respuesta.nivelJunta,
    // Para mostrar "el motor de reglas subió el nivel": la IA nunca lo baja.
    subioPorMotor: respuesta.subioPorMotor,
    accion: { id: respuesta.accionFinal, texto: ACCIONES[respuesta.accionFinal] ?? respuesta.accionFinal },
    // Si vino de lo guardado (sin red / IA apagada) la pantalla lo avisa.
    guardada: respuesta.origen === 'guardada',
    ts: respuesta.ts ?? null,
    especialistas: junta.especialistas.map((e) => ({ id: e.id, nombre: NOMBRES[e.id], nivel: e.nivel, opinion: e.opinion, citas: e.citas ?? [] })),
    desacuerdos: junta.desacuerdos.map((d) => ({
      tema: d.tema,
      posiciones: d.posiciones.map((p) => ({ especialista: NOMBRES[p.especialista] ?? p.especialista, postura: p.postura })),
      resolucion: d.resolucion,
    })),
    sintesis: { decision: junta.sintesis.decision, razones: junta.sintesis.razones },
    pestanas: [
      {
        id: 'astronauta',
        etiqueta: `Para ${nombreAstronauta}`,
        titulo: junta.informe_astronauta.titulo,
        resumen: junta.informe_astronauta.resumen,
        queHacer: junta.informe_astronauta.que_hacer,
      },
      {
        id: 'medicos',
        etiqueta: 'Para médicos de vuelo',
        resumen: junta.informe_tecnico.resumen_clinico,
        hallazgos: junta.informe_tecnico.hallazgos,
        plan: junta.informe_tecnico.plan,
        recordatorios: junta.informe_tecnico.recordatorios,
      },
    ],
  };
}
