// Protocolos médicos de a bordo de VYTA: el conocimiento de "qué hacer ya" vive en el navegador,
// sin IA y sin red, porque en una emergencia es la fuente más rápida que hay. Hacia Marte, Houston
// tarda decenas de minutos en contestar (NASA EIMO ConOps, 2024).
//
// Basado en la NASA:
//   - ISS Medical Checklist, procedimientos de emergencia 1.101 a 1.108 (JSC, 2015; liberado por FOIA en 2016).
//   - NASA-STD-3001, ficha técnica OCHMO-TB-033 "Spaceflight Experience and Medical Care" (rev. C, 2023).
//   - Earth-Independent Medical Operations (EIMO) ConOps, NASA HRP ExMC (2024).
// Resumen en español: doc/nasa/riesgos/operaciones/emergencias-medicas.md
//
// Tres niveles de triaje:
//   emergencia → riesgo para la vida y se actúa en segundos. Aviso crítico al oficial médico, pasos locales y NO se espera a la IA.
//   urgente    → puede agravarse en minutos u horas. Aviso alto, primeros pasos locales y además responde la IA.
//   aviso      → molestia esperable en vuelo. No se avisa solo: responde la IA y la persona decide si lo reporta.
//
// VYTA no receta ni dosifica: las dosis las fijan la checklist y el cirujano de vuelo.
import { normalizar } from './texto.js';

/** Demora de un solo tramo Marte → Tierra que se usa si nadie la indica (igual que lib/enlace/logicaEnlace.js). */
export const RETRASO_TIERRA_POR_DEFECTO_MIN = 14;
/** Minutos que la checklist le da al cirujano para responder en la simulación del enlace. */
const EVALUACION_MIN = 2;

export const NIVELES_TRIAJE = {
  emergencia: { orden: 3, nivelAviso: 'critica', etiqueta: 'Emergencia' },
  urgente: { orden: 2, nivelAviso: 'alta', etiqueta: 'Urgente' },
  aviso: { orden: 1, nivelAviso: null, etiqueta: 'Aviso' },
};

const URL_MANUAL_ISS = 'https://www.governmentattic.org/19docs/NASA-ISSmedicalEmergManual_2016.pdf';
const URL_TB033 = 'https://www.nasa.gov/wp-content/uploads/2023/07/ochmo-tb-033-spaceflight-experience-medical-care-rev-c.pdf';
const URL_VTE = 'https://www.nasa.gov/directorates/esdmd/hhp/human-system-risk-board/';

const iss = (codigo, titulo) => ({ id: `ISS ${codigo}`, titulo: `NASA · ISS Medical Checklist ${codigo} ${titulo}`, url: URL_MANUAL_ISS });
const tb033 = { id: 'STD-3001', titulo: 'NASA · OCHMO-TB-033 Spaceflight Experience and Medical Care', url: URL_TB033 };

/**
 * Orden = prioridad: gana el primero que coincide, así que lo más grave va antes.
 * `pasos` está escrito para leerse en voz alta (oraciones cortas, sin números con símbolos).
 */
export const PROTOCOLOS = [
  // ---------------- EMERGENCIA ----------------
  {
    id: 'autolesion',
    nivel: 'emergencia',
    categoria: 'autolesion',
    titulo: 'Riesgo de autolesión',
    patrones: [/hacerme dano/, /lastimarme/, /matarme/, /suicid/, /quitarme la vida/, /quiero morir/, /no quiero (seguir|vivir)/, /acabar con todo/],
    pasos: [
      'Te escucho, y me importa cómo estás. No estás solo: voy a avisar ahora al oficial médico.',
      'Si podés, quedate con alguien de la tripulación hasta que llegue.',
    ],
    sinCierre: true,
    fuentes: [tb033],
  },
  {
    id: 'paro',
    nivel: 'emergencia',
    categoria: 'cardiorrespiratoria',
    titulo: 'No responde o no respira',
    // "El sistema no responde" no habla de una persona: se descarta.
    excluir: [/\b(sistema|pantalla|app|aplicacion|computadora|compu|tablet|radio|enlace|microfono|boton|programa|equipo|sensor|comando)\b/],
    patrones: [/no (responde|reacciona|despierta)/, /(esta|quedo|se quedo) inconsciente/, /perdio el conocimiento/, /no respira/, /paro (cardiaco|cardiorrespiratorio)/, /(sin|no tiene) pulso/, /dejo de respirar/],
    pasos: [
      'Emergencia. Si no responde y no respira normal, empezá ya la reanimación: treinta compresiones fuertes en el centro del pecho y dos respiraciones.',
      'Que otra persona traiga el desfibrilador, pegue los parches en el pecho, lo prenda y siga sus instrucciones de voz.',
      'Apenas puedas, sujetalo en el sistema de sujeción médica para comprimir sin flotar.',
      'Si respira pero no responde, sujetalo y dale oxígeno del paquete respiratorio.',
    ],
    fuentes: [iss('1.102', 'AED Assisted CPR'), iss('1.103', 'ALS Algorithm')],
  },
  {
    id: 'atragantamiento',
    nivel: 'emergencia',
    categoria: 'via-aerea',
    titulo: 'Atragantamiento',
    patrones: [/atragant/, /(algo|comida) (trabad[oa]|atascad[oa]) en la garganta/, /se (le )?(trabo|atasco) (algo|la comida)/],
    pasos: [
      'Emergencia de vía aérea. Si está despierto, ponete detrás, el puño arriba del ombligo, y tirá fuerte hacia adentro y hacia arriba, una y otra vez, hasta que salga.',
      'Si pierde el conocimiento, abrí la vía aérea, sacá el objeto solo si lo ves, intentá dar respiraciones y empezá la reanimación con el desfibrilador.',
      'Cuando salga, tomale pulso, respiraciones y presión para el cirujano.',
    ],
    fuentes: [iss('1.105', 'Choking')],
  },
  {
    id: 'anafilaxia',
    nivel: 'emergencia',
    categoria: 'alergia-grave',
    titulo: 'Reacción alérgica grave',
    patrones: [/anafilax/, /alergi\w* (grave|fuerte|severa|muy fuerte)/, /se me (esta )?(cierra|cerrando|hincha|hinchando) la garganta/, /(garganta|lengua|labios) (muy )?hinchad/, /se le (cierra|hincha) la garganta/],
    pasos: [
      'Emergencia: puede ser una reacción alérgica grave. Abrí el paquete rojo y usá la epinefrina autoinyectable.',
      'Sacá la tapa de seguridad y clavala firme en la cara externa del muslo, sin ropa en el medio, y sostenela diez segundos.',
      'Si los síntomas vuelven o empeoran, la checklist permite repetirla a los veinte minutos.',
    ],
    fuentes: [iss('1.101', 'Severe Allergic Reaction')],
  },
  {
    id: 'convulsion',
    nivel: 'emergencia',
    categoria: 'neurologica',
    titulo: 'Convulsión',
    patrones: [/convuls/, /ataque (de )?epilep/, /esta (temblando|sacudiendose) y no responde/],
    pasos: [
      'Emergencia. Protegelo de los golpes: llevalo al centro del módulo, lejos de las estructuras.',
      'No le abras la boca ni le pongas nada adentro. Suelen durar menos de un minuto: mirá la hora.',
      'Si dura más de cinco minutos o se repite, el oficial médico aplica la medicación del paquete marrón según la checklist.',
      'Después dale oxígeno, poné el oxímetro y revisá golpes, lengua y dientes. Va a estar confundido unos minutos.',
    ],
    fuentes: [iss('1.107', 'Seizure')],
  },
  {
    id: 'acv',
    nivel: 'emergencia',
    categoria: 'neurologica',
    titulo: 'Posible ACV',
    patrones: [/(cara|boca) (torcida|caida)/, /no (puedo|puede) mover (el|la|un|medio) (brazo|pierna|lado|cuerpo)/, /no me salen las palabras/, /(hablo|habla) (raro|trabado)/, /se me (durmio|duerme) (medio cuerpo|un lado|la mitad)/, /peor dolor de cabeza/],
    pasos: [
      'Esto puede ser un problema neurológico grave. Anotá la hora exacta en que empezó: es el dato más importante para el cirujano.',
      'Que no coma ni tome nada. Poné el oxímetro y el tensiómetro del paquete azul y dale oxígeno si la saturación baja.',
      'No lo dejes solo.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'dificultad-respiratoria',
    nivel: 'emergencia',
    categoria: 'cardiorrespiratoria',
    titulo: 'Dificultad para respirar',
    patrones: [/(no puedo|no puede|me cuesta|le cuesta|no logro) respirar/, /falta de aire/, /me falta (el )?aire/, /le falta (el )?aire/, /me ahogo/, /se (esta )?ahogando/, /asfixi/, /labios (azules|morados|grises)/],
    pasos: [
      'Que deje todo y no haga ningún esfuerzo. Abrí el paquete respiratorio y dale oxígeno con la mascarilla.',
      'Poné el oxímetro del paquete azul y contá las respiraciones quince segundos, por cuatro.',
      'Si tiene los labios azulados, o respira menos de doce o más de treinta veces por minuto, asistí la respiración con la bolsa AMBU.',
      'Si a otros también les falta el aire, puede ser la atmósfera: máscaras puestas y revisen las alarmas de cabina.',
    ],
    fuentes: [iss('1.108', 'Difficulty Breathing'), iss('1.103', 'ALS Algorithm')],
  },
  {
    id: 'toxico',
    nivel: 'emergencia',
    categoria: 'toxico',
    titulo: 'Exposición tóxica o humo',
    patrones: [/\bhumo\b/, /olor a (quemado|amoniaco|quimico|gas)/, /amoniaco/, /hidrazina/, /(gas|vapor|liquido|producto) toxic/, /intoxic/, /\b(fuego|incendio)\b/, /(me|le) (salpico|cayo) (un )?(quimico|producto|liquido)/, /quimico en (el|los) ojos?/],
    pasos: [
      'Emergencia. Primero protegete vos: máscara, antiparras y guantes antes de acercarte, así no hay más expuestos.',
      'Sacalo del lugar, quitale la ropa manchada y lavá la piel con agua.',
      'Si fue en los ojos, quitá los lentes de contacto y enjuagá ya con agua, sin parar hasta que ceda el dolor.',
      'Si hay humo, fuego o amoníaco en el aire, es una emergencia de la nave: sigan el procedimiento de emergencia de la estación.',
    ],
    fuentes: [iss('1.106', 'Toxic Exposure')],
  },
  {
    id: 'hemorragia',
    nivel: 'emergencia',
    categoria: 'hemorragia',
    titulo: 'Sangrado abundante',
    patrones: [/hemorragia/, /no (me |le )?para de sangrar/, /sangr\w* (mucho|muchisimo|abundante|sin parar|a chorros)/, /(mucha|un monton de) sangre/],
    pasos: [
      'Emergencia. Apretá fuerte y directo sobre la herida con gasas del botiquín y no sueltes.',
      'Si se empapa, poné más gasas encima sin sacar las primeras.',
      'Controlá pulso y presión: si se pone pálido, frío o confundido, puede estar entrando en shock.',
    ],
    fuentes: [tb033],
  },

  // ---------------- URGENTE ----------------
  {
    id: 'dolor-pecho',
    nivel: 'urgente',
    categoria: 'cardiorrespiratoria',
    titulo: 'Dolor de pecho',
    patrones: [/dolor (de|en el) pecho/, /(presion|opresion|puntada) en el pecho/, /me duele el pecho/, /dolor .*brazo izquierdo/, /palpitaciones (muy )?fuertes/, /el corazon (me )?(late|va) (muy )?(rapido|fuerte|raro)/],
    pasos: [
      'El dolor de pecho siempre se revisa. Dejá lo que estás haciendo y quedate quieto, sin esfuerzo.',
      'Que el oficial médico te tome presión, pulso y saturación con el paquete azul, y un electrocardiograma.',
      'Tengan cerca el desfibrilador: si dejás de responder, empiezan la reanimación.',
    ],
    fuentes: [iss('1.103', 'ALS Algorithm'), tb033],
  },
  {
    id: 'desmayo',
    nivel: 'urgente',
    categoria: 'cardiorrespiratoria',
    titulo: 'Desmayo',
    patrones: [/me desmay/, /se desmay/, /perdi el conocimiento/, /casi me desmayo/, /me (voy a|estoy por) desmayar/, /me (desvaneci|sincope)/],
    pasos: [
      'No te muevas ni hagas esfuerzo hasta que te revisen.',
      'Que el oficial médico te tome presión, pulso y saturación, y anote qué estabas haciendo y cuánto duró.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'trombosis',
    nivel: 'urgente',
    categoria: 'trombosis',
    titulo: 'Posible coágulo',
    patrones: [/(cuello|brazo|pierna) (muy )?(hinchad|inflamad)/, /hinchazon (en|del|de la) (cuello|brazo|pierna)/, /se me hincho (el|la) (cuello|brazo|pierna)/],
    pasos: [
      'Un cuello, brazo o pierna hinchados pueden ser un coágulo, como el trombo en la yugular que la NASA detectó en la estación.',
      'No masajees la zona. El oficial médico puede hacer una ecografía guiada desde Tierra.',
    ],
    fuentes: [tb033, { id: 'HSRB', titulo: 'NASA · Human System Risk Board: Concern of Venous Thromboembolism', url: URL_VTE }],
  },
  {
    id: 'dolor-abdominal',
    nivel: 'urgente',
    categoria: 'abdominal',
    titulo: 'Dolor abdominal fuerte',
    patrones: [/dolor (de panza|de barriga|abdominal|de estomago|en la panza)( muy)? (fuerte|intenso|insoportable|terrible)/, /me duele (mucho|muchisimo) (la panza|el abdomen|la barriga|el estomago)/, /dolor .*(abajo a la derecha|lado derecho de la panza)/, /abdomen (duro|rigido)/],
    pasos: [
      'Un dolor de barriga fuerte se revisa ya: es uno de los escenarios que la NASA prepara para Marte.',
      'No comas ni tomes medicación por tu cuenta. Que el oficial médico te tome temperatura y pulso y vea exactamente dónde duele.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'sangrado',
    nivel: 'urgente',
    categoria: 'general',
    titulo: 'Sangrado',
    patrones: [/vomit\w* sangre/, /sangre en (la orina|el pis|la caca|las heces)/, /tos\w* (con )?sangre/, /sangr(o|e|ado|ando)/],
    pasos: [
      'Si es una herida, apretá con gasas del botiquín sin soltar.',
      'Si vomitás o orinás sangre, guardá una muestra o sacale una foto para el cirujano.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'fiebre-alta',
    nivel: 'urgente',
    categoria: 'general',
    titulo: 'Fiebre alta',
    patrones: [/fiebre (muy )?alta/, /(39|40|41)( con \w+)? (grados|de fiebre)/, /(fiebre|temperatura) de (39|40|41)/, /escalofrios (muy )?fuertes/],
    pasos: [
      'La fiebre alta en vuelo se revisa ya: el sistema inmune cambia en el espacio.',
      'Tomá agua, medí la temperatura otra vez y que el oficial médico te haga el examen de consulta.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'golpe-cabeza',
    nivel: 'urgente',
    categoria: 'trauma',
    titulo: 'Golpe en la cabeza',
    patrones: [/golpe (fuerte )?en la cabeza/, /me (pegue|golpee) (fuerte )?(en )?la cabeza/, /se (pego|golpeo) (fuerte )?(en )?la cabeza/, /traumatismo/],
    pasos: [
      'Después de un golpe en la cabeza no te quedes solo las próximas horas.',
      'Que el oficial médico revise pupilas, memoria y fuerza. Si vomitás, te da mucho sueño o ves doble, es más urgente.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'ojo',
    nivel: 'urgente',
    categoria: 'ocular',
    titulo: 'Problema en el ojo',
    patrones: [/(se me metio|tengo|se le metio) algo en el ojo/, /cuerpo extrano en el ojo/, /no veo (nada|de un ojo)/, /perdi (la )?vision/, /vision (doble|borrosa) de (golpe|repente)/, /(cortina|sombra) en el ojo/],
    pasos: [
      'No te frotes el ojo. Si entró algo, enjuagá con agua limpia.',
      'Una pérdida brusca de visión se revisa ya: el oficial médico tiene el equipo de ojos del botiquín.',
    ],
    fuentes: [iss('1.106', 'Toxic Exposure'), tb033],
  },
  {
    id: 'descompresion',
    nivel: 'urgente',
    categoria: 'descompresion',
    titulo: 'Síntomas después de una EVA',
    patrones: [/(dolor|hormigueo|picazon|molestia)\w* .*(despues|tras|luego) de (la )?(eva|caminata|salida)/, /(despues|tras|luego) de (la )?(eva|caminata|salida) .*(dolor|duele|hormigueo|picazon|molest)/, /enfermedad (por|de) descompresion/, /bends/],
    pasos: [
      'Dolor en las articulaciones, hormigueo o picazón después de una EVA pueden ser enfermedad por descompresión.',
      'Que el oficial médico siga el procedimiento de descompresión de la EVA y te dé oxígeno.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'retencion-urinaria',
    nivel: 'urgente',
    categoria: 'genitourinaria',
    titulo: 'No puede orinar',
    patrones: [/no (puedo|logro) (orinar|hacer pis)/, /retencion (de orina|urinaria)/],
    pasos: [
      'Le pasa a una parte de la tripulación al adaptarse a la ingravidez.',
      'Si pasan horas sin orinar, el oficial médico puede colocar una sonda del botiquín.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'colico-renal',
    nivel: 'urgente',
    categoria: 'renal',
    titulo: 'Posible cálculo renal',
    patrones: [/calculo (renal|en el rinon)/, /colico (renal|nefritico)/, /dolor (fuerte )?(en el|del) (costado|rinon)/],
    pasos: [
      'Puede ser un cálculo renal, más frecuente en vuelo por el calcio que pierde el hueso.',
      'Tomá agua y que el oficial médico te revise.',
    ],
    fuentes: [tb033],
  },

  // ---------------- AVISO ----------------
  {
    id: 'adaptacion',
    nivel: 'aviso',
    categoria: 'adaptacion',
    titulo: 'Náuseas o mareo de adaptación',
    patrones: [/nause/, /mareo/, /mareado/, /ganas de vomitar/, /vomit(e|o|ando)/],
    pasos: [
      'Las náuseas y el mareo de adaptación le pasan a más de la mitad de la tripulación.',
      'Mové la cabeza despacio, quedate quieto con una referencia visual de arriba y abajo, e hidratate.',
      'Si a varios les pasa a la vez, revisen el dióxido de carbono de la cabina.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'dolor-cabeza',
    nivel: 'aviso',
    categoria: 'adaptacion',
    titulo: 'Dolor de cabeza',
    patrones: [/dolor de cabeza/, /me duele la cabeza/, /jaqueca/, /migrana/, /cefalea/],
    pasos: [
      'El dolor de cabeza es más común en vuelo, por el dióxido de carbono y el cambio de líquidos hacia la cabeza.',
      'Revisá el dióxido de carbono de la cabina, tomá agua y descansá. Si es el peor dolor de tu vida o ves raro, avisá ya.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'congestion',
    nivel: 'aviso',
    categoria: 'adaptacion',
    titulo: 'Congestión',
    patrones: [/congestion/, /nariz tapada/, /cara hinchada/, /tapado de la nariz/],
    pasos: ['La congestión le pasa a más de la mitad de la tripulación, por el cambio de líquidos o el dióxido de carbono.'],
    fuentes: [tb033],
  },
  {
    id: 'espalda',
    nivel: 'aviso',
    categoria: 'adaptacion',
    titulo: 'Dolor de espalda',
    patrones: [/dolor de espalda/, /me duele (la espalda|la cintura)/, /lumbar/],
    pasos: ['El dolor de espalda de adaptación le pasa a la mitad de la tripulación. Posición fetal, estiramientos suaves y ejercicio alivian a la mayoría.'],
    fuentes: [tb033],
  },
  {
    id: 'fiebre',
    nivel: 'aviso',
    categoria: 'general',
    titulo: 'Fiebre',
    patrones: [/fiebre/, /febril/, /(38)( con \w+)? grados/],
    pasos: ['Medí la temperatura de nuevo en un rato y tomá agua. Si pasa de treinta y nueve grados o aparecen otros síntomas, avisá ya.'],
    fuentes: [tb033],
  },
];

// Frases vagas: no dicen qué pasa, así que primero se descartan las señales rojas.
const MALESTAR_VAGO = [/me siento (muy )?(mal|raro|rara|fatal|horrible|pesimo)/, /no me siento (nada )?bien/, /algo (me )?anda mal/, /estoy (muy )?mal/, /me siento enferm/, /me siento descompuest/, /estoy descompuest/];

export const PREGUNTA_TRIAJE =
  'Te escucho. Para saber si es urgente, decime: ¿te cuesta respirar, te duele el pecho, te desmayaste o estás sangrando? Si no, contame qué sentís y desde cuándo.';

const PEDIDO_DE_AVISO = [/avisa(le)? (al|a la) (oficial|medic|cirujan)/, /avisa(le)? a (houston|tierra)/, /llama(le)? (al|a la) (medic|cirujan|oficial)/, /(pedi|pedime|solicita) (una )?conferencia medica/, /reporta(lo)? (al|a la) (oficial|medic|cirujan)/, /^(avisale|avisa|si,? avisa|dale,? avisa)\b/];

// Una negación justo antes ("no tengo dolor de pecho", "sin fiebre", "ni sangrado") apaga la coincidencia.
// Solo negaciones explícitas de síntoma: "no sé, me duele el pecho" o "no tengo fiebre pero me duele el pecho" siguen contando.
const NEGACION_PREVIA = /(?:^|\s)(?:no tengo|no siento|no hay|no tuve|no noto|sin|ni|nunca)\s+(?:(?!pero\b|aunque\b|y\b|e\b)\S+\s+){0,2}$/;

function coincide(patron, texto) {
  const r = new RegExp(patron.source, patron.flags.replace('g', '') + 'g');
  for (const m of texto.matchAll(r)) {
    const antes = texto.slice(Math.max(0, m.index - 30), m.index);
    if (!NEGACION_PREVIA.test(antes)) return true;
  }
  return false;
}

/**
 * Clasifica una frase del tripulante.
 * @returns {{nivel:'emergencia'|'urgente'|'aviso', protocolo:object}|null}
 */
export function triar(texto) {
  const t = normalizar(texto).replace(/[¿?¡!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  for (const protocolo of PROTOCOLOS) {
    if (protocolo.excluir?.some((p) => p.test(t))) continue;
    if (protocolo.patrones.some((p) => coincide(p, t))) return { nivel: protocolo.nivel, protocolo };
  }
  return null;
}

/** "Me siento mal" sin decir qué: hay que preguntar por las señales rojas antes de aconsejar. */
export function esMalestarVago(texto) {
  const t = normalizar(texto);
  return MALESTAR_VAGO.some((p) => p.test(t)) && !triar(texto);
}

/** El tripulante pide, con palabras, que se avise al oficial médico o a Tierra. */
export function pideAviso(texto) {
  const t = normalizar(texto).replace(/[¿?¡!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  return PEDIDO_DE_AVISO.some((p) => p.test(t));
}

/** Respuesta afirmativa corta a la pregunta de triaje ("sí", "sí, un poco"). */
export function esAfirmacion(texto) {
  return /^(si|sip|claro|un poco|bastante|algo de eso)\b/.test(normalizar(texto).replace(/[¿?¡!.,;:]+/g, ' ').trim());
}

/** Frase sobre la demora con Tierra, según el nivel. Con demora 0 (estación en órbita baja) se pide la PMC. */
export function cierreSegunEnlace(nivel, retrasoMin = RETRASO_TIERRA_POR_DEFECTO_MIN) {
  const idaYVuelta = Math.round(retrasoMin * 2 + EVALUACION_MIN);
  const hayDemora = Number.isFinite(retrasoMin) && retrasoMin >= 1;
  if (nivel === 'emergencia') {
    return hayDemora
      ? `Ya avisé al oficial médico y mandé el aviso a Houston, pero la respuesta tarda unos ${idaYVuelta} minutos: no la esperes, sigan la checklist médica.`
      : 'Ya avisé al oficial médico. Llamen a Houston y pidan una conferencia médica privada.';
  }
  if (nivel === 'urgente') {
    return hayDemora
      ? `Avisé al oficial médico y el aviso ya va a Houston; la respuesta tarda unos ${idaYVuelta} minutos, así que el oficial médico te revisa ahora.`
      : 'Avisé al oficial médico: pidan a Houston una conferencia médica privada.';
  }
  return 'Si querés que lo reporte, decime "avisá al oficial médico" y lo dejo para tu próxima conferencia médica privada.';
}

/** Texto completo que VYTA dice y muestra para un protocolo. */
export function mensajeDeProtocolo(protocolo, { retrasoMin = RETRASO_TIERRA_POR_DEFECTO_MIN } = {}) {
  const partes = [...protocolo.pasos];
  if (!protocolo.sinCierre) partes.push(cierreSegunEnlace(protocolo.nivel, retrasoMin));
  return partes.join(' ');
}

/** Mensaje para cuando el tripulante pide el aviso. */
export function mensajeAvisoEnviado(retrasoMin = RETRASO_TIERRA_POR_DEFECTO_MIN) {
  const idaYVuelta = Math.round(retrasoMin * 2 + EVALUACION_MIN);
  return retrasoMin >= 1
    ? `Listo, avisé al oficial médico y el reporte va a Houston para tu conferencia médica privada; la respuesta tarda unos ${idaYVuelta} minutos. Si empeorás, decímelo y lo marco como urgente.`
    : 'Listo, avisé al oficial médico y pedí una conferencia médica privada con el cirujano de vuelo.';
}
