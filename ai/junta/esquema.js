// Esquema JSON de la junta médica (output_config.format). Cumple las reglas de salida estructurada:
// todo `required`, `additionalProperties: false`, sin rangos numéricos ni largos mínimos.
import { NIVELES } from './niveles.js';

export const ESPECIALISTAS_JUNTA = ['cardiovascular', 'inmunidad', 'conducta-y-sueno', 'hueso-y-musculo', 'ambiente'];

export const ACCIONES = ['continuar', 'vigilar', 'avisar_oficial_medico', 'contactar_medicos_de_vuelo'];

const texto = { type: 'string' };
const lista = (items) => ({ type: 'array', items });
const objeto = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export const ESQUEMA_JUNTA = objeto({
  especialistas: lista(
    objeto({
      id: { type: 'string', enum: ESPECIALISTAS_JUNTA },
      nivel: { type: 'string', enum: NIVELES },
      opinion: texto,
      fuentes: lista(texto), // ids de las fuentes citadas, p. ej. "F1"
    }),
  ),
  desacuerdos: lista(
    objeto({
      tema: texto,
      posiciones: lista(objeto({ especialista: { type: 'string', enum: ESPECIALISTAS_JUNTA }, postura: texto })),
      resolucion: texto,
    }),
  ),
  sintesis: objeto({
    nivel: { type: 'string', enum: NIVELES },
    accion: { type: 'string', enum: ACCIONES },
    decision: texto,
    razones: lista(texto),
  }),
  informe_astronauta: objeto({ titulo: texto, resumen: texto, que_hacer: lista(texto) }),
  informe_tecnico: objeto({
    resumen_clinico: texto,
    hallazgos: lista(texto),
    plan: lista(texto),
    recordatorios: lista(objeto({ titulo: texto, sol: { type: 'integer' }, detalle: texto })),
  }),
});

/** Revisión final por si la salida no respeta lo que el esquema promete (devuelve un texto de error o null). */
export function revisarSalida(json) {
  if (!json || typeof json !== 'object') return 'La salida no es un objeto';
  const ids = (json.especialistas ?? []).map((e) => e.id);
  const faltan = ESPECIALISTAS_JUNTA.filter((id) => !ids.includes(id));
  if (faltan.length) return `Faltan especialistas: ${faltan.join(', ')}`;
  if (new Set(ids).size !== ids.length) return 'Hay especialistas repetidos';
  if (!NIVELES.includes(json.sintesis?.nivel)) return 'Synthesis does not have a valid level';
  if (!json.informe_astronauta?.resumen || !json.informe_tecnico?.resumen_clinico) return 'Falta alguno de los dos informes';
  return null;
}
