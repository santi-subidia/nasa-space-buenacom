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
    titulo: 'Self-harm risk',
    patrones: [/hurt myself/, /harm myself/, /kill myself/, /suicid/, /end my life/, /want to die/, /don'?t want to (live|go on|keep going)/, /do not want to (live|go on|keep going)/, /hacerme dano/, /lastimarme/, /matarme/, /quitarme la vida/, /quiero morir/, /no quiero (seguir|vivir)/, /acabar con todo/],
    pasos: [
      "I hear you, and I care how you're doing. You're not alone: I'm notifying the medical officer right now.",
      'If you can, stay with a crewmate until they arrive.',
    ],
    sinCierre: true,
    fuentes: [tb033],
  },
  {
    id: 'paro',
    nivel: 'emergencia',
    categoria: 'cardiorrespiratoria',
    titulo: 'Unresponsive or not breathing',
    // "The system isn't responding" doesn't refer to a person: ignore.
    excluir: [/\b(system|screen|app|application|computer|tablet|radio|link|mic|microphone|button|program|device|sensor|command|sistema|pantalla|aplicacion|computadora|compu|enlace|microfono|boton|programa|equipo)\b/],
    patrones: [/not (responding|reacting|waking up)/, /unresponsive/, /(is|fell|became) unconscious/, /lost consciousness/, /not breathing/, /stopped breathing/, /cardiac arrest/, /(no|without) pulse/, /no (responde|reacciona|despierta)/, /(esta|quedo|se quedo) inconsciente/, /perdio el conocimiento/, /no respira/, /paro (cardiaco|cardiorrespiratorio)/, /(sin|no tiene) pulso/, /dejo de respirar/],
    pasos: [
      'Emergency. If unresponsive and not breathing normally, start CPR immediately: thirty firm compressions in the center of the chest and two rescue breaths.',
      'Have someone else bring the defibrillator, place the pads on the chest, turn it on, and follow its voice prompts.',
      'As soon as possible, strap them into the crew medical restraint system so you can compress without floating.',
      'If breathing but unresponsive, restrain them and give oxygen from the respiratory pack.',
    ],
    fuentes: [iss('1.102', 'AED Assisted CPR'), iss('1.103', 'ALS Algorithm')],
  },
  {
    id: 'atragantamiento',
    nivel: 'emergencia',
    categoria: 'via-aerea',
    titulo: 'Choking',
    patrones: [/chok(e|ing)/, /(something|food) stuck in (my |his |her |their |the )?throat/, /atragant/, /(algo|comida) (trabad[oa]|atascad[oa]) en la garganta/, /se (le )?(trabo|atasco) (algo|la comida)/],
    pasos: [
      'Airway emergency. If awake, stand behind them, place a fist above the navel, and pull sharply inward and upward repeatedly until clear.',
      'If they lose consciousness, open the airway, remove the object only if visible, attempt rescue breaths, and start CPR with the defibrillator.',
      'Once cleared, check pulse, respirations, and blood pressure for the flight surgeon.',
    ],
    fuentes: [iss('1.105', 'Choking')],
  },
  {
    id: 'anafilaxia',
    nivel: 'emergencia',
    categoria: 'alergia-grave',
    titulo: 'Severe allergic reaction',
    patrones: [/anaphylax/, /anafilax/, /(severe|bad|strong) allergic reaction/, /alergi\w* (grave|fuerte|severa|muy fuerte)/, /throat (is )?(closing|swelling)/, /swollen (throat|tongue|lips)/, /se me (esta )?(cierra|cerrando|hincha|hinchando) la garganta/, /(garganta|lengua|labios) (muy )?hinchad/, /se le (cierra|hincha) la garganta/],
    pasos: [
      'Emergency: this may be a severe allergic reaction. Open the red pack and use the epinephrine auto-injector.',
      'Remove the safety cap and press firmly into the outer thigh through bare skin or light fabric, holding for ten seconds.',
      'If symptoms return or worsen, the checklist allows repeating after twenty minutes.',
    ],
    fuentes: [iss('1.101', 'Severe Allergic Reaction')],
  },
  {
    id: 'convulsion',
    nivel: 'emergencia',
    categoria: 'neurologica',
    titulo: 'Seizure',
    patrones: [/seizur/, /convuls/, /epilep/, /(shaking|convulsing) and (not responding|unresponsive)/, /ataque (de )?epilep/, /esta (temblando|sacudiendose) y no responde/],
    pasos: [
      'Emergency. Protect them from impact: move them to the center of the module, away from hardware.',
      'Do not force their mouth open or put anything inside. Seizures usually last under a minute: note the time.',
      'If it lasts over five minutes or repeats, the medical officer administers medication from the brown pack per the checklist.',
      'Afterward give oxygen, attach the pulse oximeter, and check for bumps, tongue, or tooth injury. They will be confused for a few minutes.',
    ],
    fuentes: [iss('1.107', 'Seizure')],
  },
  {
    id: 'acv',
    nivel: 'emergencia',
    categoria: 'neurologica',
    titulo: 'Possible stroke',
    patrones: [/(face|mouth) (droop|twisted)/, /can'?t move (my|his|her|one|half) (arm|leg|side|body)/, /cannot move (my|his|her|one|half) (arm|leg|side|body)/, /slurred speech/, /words won'?t come out/, /(half|one side of) (my )?body (went|feels) numb/, /worst headache/, /(cara|boca) (torcida|caida)/, /no (puedo|puede) mover (el|la|un|medio) (brazo|pierna|lado|cuerpo)/, /no me salen las palabras/, /(hablo|habla) (raro|trabado)/, /se me (durmio|duerme) (medio cuerpo|un lado|la mitad)/, /peor dolor de cabeza/],
    pasos: [
      'This could be a serious neurological event. Write down the exact time it started: that is the most critical piece of data for the flight surgeon.',
      'Nothing by mouth. Put on the pulse oximeter and blood pressure cuff from the blue pack and give oxygen if saturation drops.',
      'Do not leave them alone.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'dificultad-respiratoria',
    nivel: 'emergencia',
    categoria: 'cardiorrespiratoria',
    titulo: 'Difficulty breathing',
    patrones: [/(can'?t|cannot|hard to|trouble|difficulty) breath(e|ing)/, /shortness of breath/, /short of breath/, /out of breath/, /can'?t catch my breath/, /(blue|purple|gray|grey) lips/, /suffocat/, /(no puedo|no puede|me cuesta|le cuesta|no logro) respirar/, /falta de aire/, /me falta (el )?aire/, /le falta (el )?aire/, /me ahogo/, /se (esta )?ahogando/, /asfixi/, /labios (azules|morados|grises)/],
    pasos: [
      'Stop everything and avoid any exertion. Open the respiratory pack and give oxygen by mask.',
      'Put on the pulse oximeter from the blue pack and count breaths for fifteen seconds times four.',
      'If lips look bluish, or breathing rate is below twelve or above thirty per minute, assist ventilation with the AMBU bag.',
      'If others are also short of breath, it may be the atmosphere: put masks on and check cabin alarms.',
    ],
    fuentes: [iss('1.108', 'Difficulty Breathing'), iss('1.103', 'ALS Algorithm')],
  },
  {
    id: 'toxico',
    nivel: 'emergencia',
    categoria: 'toxico',
    titulo: 'Toxic exposure or smoke',
    patrones: [/\bsmoke\b/, /smells? like (smoke|burning|ammonia|chemical|gas)/, /ammonia/, /hydrazine/, /toxic (gas|vapor|fume|liquid|chemical)/, /poison/, /\bfire\b/, /chemical in (my |the )?eyes?/, /splashed (chemical|liquid)/, /\bhumo\b/, /olor a (quemado|amoniaco|quimico|gas)/, /amoniaco/, /hidrazina/, /(gas|vapor|liquido|producto) toxic/, /intoxic/, /\b(fuego|incendio)\b/, /(me|le) (salpico|cayo) (un )?(quimico|producto|liquido)/, /quimico en (el|los) ojos?/],
    pasos: [
      'Emergency. Protect yourself first: mask, goggles, and gloves before approaching so no one else is exposed.',
      'Move them out of the area, remove contaminated clothing, and flush skin with water.',
      'If it reached the eyes, remove contact lenses and flush continuously with water until pain subsides.',
      'If there is smoke, fire, or ammonia in the air, it is a spacecraft emergency: follow the station emergency procedure.',
    ],
    fuentes: [iss('1.106', 'Toxic Exposure')],
  },
  {
    id: 'hemorragia',
    nivel: 'emergencia',
    categoria: 'hemorragia',
    titulo: 'Severe bleeding',
    patrones: [/hemorrhag/, /heavy bleeding/, /won'?t stop bleeding/, /bleeding (heavily|a lot|nonstop|badly)/, /lots? of blood/, /hemorragia/, /no (me |le )?para de sangrar/, /sangr\w* (mucho|muchisimo|abundante|sin parar|a chorros)/, /(mucha|un monton de) sangre/],
    pasos: [
      'Emergency. Press hard and directly over the wound with gauze from the medical kit and do not release.',
      'If blood soaks through, add more gauze on top without removing the first layers.',
      'Monitor pulse and blood pressure: if they become pale, cold, or confused, they may be entering shock.',
    ],
    fuentes: [tb033],
  },

  // ---------------- URGENTE ----------------
  {
    id: 'dolor-pecho',
    nivel: 'urgente',
    categoria: 'cardiorrespiratoria',
    titulo: 'Chest pain',
    patrones: [/chest pain/, /pain in (my |the )?chest/, /(pressure|tightness|stabbing) in (my |the )?chest/, /chest hurts/, /pain .*left arm/, /(strong |heavy )?palpitations/, /heart (is )?(racing|pounding|beating fast)/, /dolor (de|en el) pecho/, /(presion|opresion|puntada) en el pecho/, /me duele el pecho/, /dolor .*brazo izquierdo/, /palpitaciones (muy )?fuertes/, /el corazon (me )?(late|va) (muy )?(rapido|fuerte|raro)/],
    pasos: [
      'Chest pain always gets checked. Stop what you are doing and stay still without exertion.',
      'Have the medical officer check blood pressure, pulse, and saturation from the blue pack, plus an ECG.',
      'Keep the defibrillator nearby: if you become unresponsive, start resuscitation.',
    ],
    fuentes: [iss('1.103', 'ALS Algorithm'), tb033],
  },
  {
    id: 'desmayo',
    nivel: 'urgente',
    categoria: 'cardiorrespiratoria',
    titulo: 'Fainting',
    patrones: [/faint(ed|ing)?/, /passed out/, /nearly (fainted|passed out)/, /about to (faint|pass out)/, /syncope/, /me desmay/, /se desmay/, /perdi el conocimiento/, /casi me desmayo/, /me (voy a|estoy por) desmayar/, /me (desvaneci|sincope)/],
    pasos: [
      'Do not move or exert yourself until examined.',
      'Have the medical officer take blood pressure, pulse, and saturation, and record what you were doing and how long it lasted.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'trombosis',
    nivel: 'urgente',
    categoria: 'trombosis',
    titulo: 'Possible blood clot',
    patrones: [/swollen (neck|arm|leg)/, /swelling in (the |my )?(neck|arm|leg)/, /(neck|arm|leg) is swollen/, /(cuello|brazo|pierna) (muy )?(hinchad|inflamad)/, /hinchazon (en|del|de la) (cuello|brazo|pierna)/, /se me hincho (el|la) (cuello|brazo|pierna)/],
    pasos: [
      'A swollen neck, arm, or leg can be a blood clot, similar to the jugular thrombus NASA detected on station.',
      'Do not massage the area. The medical officer can perform an ultrasound guided from Earth.',
    ],
    fuentes: [tb033, { id: 'HSRB', titulo: 'NASA · Human System Risk Board: Concern of Venous Thromboembolism', url: URL_VTE }],
  },
  {
    id: 'dolor-abdominal',
    nivel: 'urgente',
    categoria: 'abdominal',
    titulo: 'Severe abdominal pain',
    patrones: [/(severe|intense|terrible|unbearable) (stomach|belly|abdominal) pain/, /(stomach|abdomen|belly) hurts (a lot|badly|terribly)/, /pain .*(lower right|right side of the (stomach|abdomen|belly))/, /(hard|rigid) abdomen/, /dolor (de panza|de barriga|abdominal|de estomago|en la panza)( muy)? (fuerte|intenso|insoportable|terrible)/, /me duele (mucho|muchisimo) (la panza|el abdomen|la barriga|el estomago)/, /dolor .*(abajo a la derecha|lado derecho de la panza)/, /abdomen (duro|rigido)/],
    pasos: [
      'Severe abdominal pain needs immediate review: it is one of the scenarios NASA prepares for on Mars.',
      'Do not eat or self-medicate. Have the medical officer take temperature and pulse and pinpoint where it hurts.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'sangrado',
    nivel: 'urgente',
    categoria: 'general',
    titulo: 'Bleeding',
    patrones: [/vomit(ing)? blood/, /blood in (the )?(urine|pee|stool|poop)/, /cough(ing)? (up )?blood/, /bleed(ing)?/, /vomit\w* sangre/, /sangre en (la orina|el pis|la caca|las heces)/, /tos\w* (con )?sangre/, /sangr(o|e|ado|ando)/],
    pasos: [
      'If it is a wound, hold steady pressure with gauze from the medical kit.',
      'If vomiting or urinating blood, save a sample or take a photo for the flight surgeon.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'fiebre-alta',
    nivel: 'urgente',
    categoria: 'general',
    titulo: 'High fever',
    patrones: [/(very )?high fever/, /(39|40|41)(\.\d+| point \w+)? (degrees|c|fever)/, /(fever|temperature) of (39|40|41)/, /(severe|bad|heavy) chills/, /fiebre (muy )?alta/, /(39|40|41)( con \w+)? (grados|de fiebre)/, /(fiebre|temperatura) de (39|40|41)/, /escalofrios (muy )?fuertes/],
    pasos: [
      'High fever during spaceflight requires immediate evaluation: immune function shifts in space.',
      'Drink water, re-check your temperature, and have the medical officer run the consult exam.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'golpe-cabeza',
    nivel: 'urgente',
    categoria: 'trauma',
    titulo: 'Head impact',
    patrones: [/hit (my|his|her) head/, /head (injury|trauma|blow)/, /banged (my|his|her) head/, /golpe (fuerte )?en la cabeza/, /me (pegue|golpee) (fuerte )?(en )?la cabeza/, /se (pego|golpeo) (fuerte )?(en )?la cabeza/, /traumatismo/],
    pasos: [
      'After a head impact, do not stay alone for the next several hours.',
      'Have the medical officer check pupils, memory, and strength. Vomiting, extreme drowsiness, or double vision makes it more urgent.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'ojo',
    nivel: 'urgente',
    categoria: 'ocular',
    titulo: 'Eye issue',
    patrones: [/something in (my|his|her) eye/, /foreign (body|object) in (the )?eye/, /can'?t see/, /lost (my )?vision/, /sudden (double|blurry) vision/, /(se me metio|tengo|se le metio) algo en el ojo/, /cuerpo extrano en el ojo/, /no veo (nada|de un ojo)/, /perdi (la )?vision/, /vision (doble|borrosa) de (golpe|repente)/, /(cortina|sombra) en el ojo/],
    pasos: [
      'Do not rub your eye. If something got in, rinse with clean water.',
      'Sudden vision loss is checked right away: the medical officer has the eye kit.',
    ],
    fuentes: [iss('1.106', 'Toxic Exposure'), tb033],
  },
  {
    id: 'descompresion',
    nivel: 'urgente',
    categoria: 'descompresion',
    titulo: 'Post-EVA symptoms',
    patrones: [/(pain|tingling|itching|discomfort)\w* .*after (the |an )?(eva|spacewalk)/, /after (the |an )?(eva|spacewalk) .*(pain|hurts|tingling|itching)/, /decompression sickness/, /\bbends\b/, /(dolor|hormigueo|picazon|molestia)\w* .*(despues|tras|luego) de (la )?(eva|caminata|salida)/, /(despues|tras|luego) de (la )?(eva|caminata|salida) .*(dolor|duele|hormigueo|picazon|molest)/, /enfermedad (por|de) descompresion/],
    pasos: [
      'Joint pain, tingling, or itching after an EVA can be decompression sickness.',
      'Have the medical officer follow the EVA decompression procedure and give you oxygen.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'retencion-urinaria',
    nivel: 'urgente',
    categoria: 'genitourinaria',
    titulo: 'Unable to urinate',
    patrones: [/can'?t (urinate|pee)/, /cannot (urinate|pee)/, /urinary retention/, /no (puedo|logro) (orinar|hacer pis)/, /retencion (de orina|urinaria)/],
    pasos: [
      'This happens to some crewmembers while adapting to weightlessness.',
      'If hours pass without urinating, the medical officer can place a catheter from the medical kit.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'colico-renal',
    nivel: 'urgente',
    categoria: 'renal',
    titulo: 'Possible kidney stone',
    patrones: [/kidney stone/, /renal colic/, /(severe |bad )?(flank|side|kidney) pain/, /calculo (renal|en el rinon)/, /colico (renal|nefritico)/, /dolor (fuerte )?(en el|del) (costado|rinon)/],
    pasos: [
      'It could be a kidney stone, which is more common in flight due to bone calcium loss.',
      'Drink water and have the medical officer examine you.',
    ],
    fuentes: [tb033],
  },

  // ---------------- AVISO ----------------
  {
    id: 'adaptacion',
    nivel: 'aviso',
    categoria: 'adaptacion',
    titulo: 'Nausea or adaptation dizziness',
    patrones: [/nause/, /dizz(y|iness)/, /feel like vomiting/, /vomit(ed|ing)?/, /throw(ing)? up/, /mareo/, /mareado/, /ganas de vomitar/, /vomit(e|o|ando)/],
    pasos: [
      'Nausea and adaptation dizziness affect over half of crewmembers.',
      'Move your head slowly, stay still with a visual up/down reference, and hydrate.',
      'If several crewmembers have it at once, check cabin carbon dioxide.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'dolor-cabeza',
    nivel: 'aviso',
    categoria: 'adaptacion',
    titulo: 'Headache',
    patrones: [/headache/, /head hurts/, /migraine/, /dolor de cabeza/, /me duele la cabeza/, /jaqueca/, /migrana/, /cefalea/],
    pasos: [
      'Headaches are more common in flight due to carbon dioxide and cephalad fluid shift.',
      'Check cabin carbon dioxide, drink water, and rest. If it is the worst headache of your life or vision changes, notify immediately.',
    ],
    fuentes: [tb033],
  },
  {
    id: 'congestion',
    nivel: 'aviso',
    categoria: 'adaptacion',
    titulo: 'Congestion',
    patrones: [/congest(ed|ion)/, /stuffy nose/, /puffy face/, /nariz tapada/, /cara hinchada/, /tapado de la nariz/],
    pasos: ['Congestion affects over half of crewmembers due to fluid shift or carbon dioxide.'],
    fuentes: [tb033],
  },
  {
    id: 'espalda',
    nivel: 'aviso',
    categoria: 'adaptacion',
    titulo: 'Back pain',
    patrones: [/back pain/, /back hurts/, /lower back/, /dolor de espalda/, /me duele (la espalda|la cintura)/, /lumbar/],
    pasos: ['Adaptation back pain affects half of crewmembers. Fetal position, gentle stretching, and exercise relieve most cases.'],
    fuentes: [tb033],
  },
  {
    id: 'fiebre',
    nivel: 'aviso',
    categoria: 'general',
    titulo: 'Fever',
    patrones: [/\bfever\b/, /febrile/, /38(\.\d+| point \w+)? degrees/, /fiebre/, /febril/, /(38)( con \w+)? grados/],
    pasos: ['Re-check your temperature soon and drink water. If it exceeds thirty-nine degrees or new symptoms appear, notify immediately.'],
    fuentes: [tb033],
  },
];

// Vague complaints: unclear what is happening, so red flags must be ruled out first.
const MALESTAR_VAGO = [/feel (really |very )?(bad|weird|awful|terrible|sick|unwell)/, /don'?t feel (well|good)/, /something is wrong/, /not feeling well/, /me siento (muy )?(mal|raro|rara|fatal|horrible|pesimo)/, /no me siento (nada )?bien/, /algo (me )?anda mal/, /estoy (muy )?mal/, /me siento enferm/, /me siento descompuest/, /estoy descompuest/];

export const PREGUNTA_TRIAJE =
  "I'm listening. To check if this is urgent, tell me: are you having trouble breathing, chest pain, fainting, or bleeding? If not, tell me what you feel and since when.";

const PEDIDO_DE_AVISO = [/notify (the )?(medical officer|cmo|doctor|flight surgeon)/, /tell (the )?(medical officer|cmo|doctor|flight surgeon|houston|earth)/, /call (the )?(medical officer|cmo|doctor|flight surgeon|houston)/, /request (a )?private medical conference/, /report (this )?to (the )?(medical officer|cmo|doctor)/, /^(yes,? )?(notify|tell) (him|her|them|the cmo|the medical officer)\b/, /avisa(le)? (al|a la) (oficial|medic|cirujan)/, /avisa(le)? a (houston|tierra)/, /llama(le)? (al|a la) (medic|cirujan|oficial)/, /(pedi|pedime|solicita) (una )?conferencia medica/, /reporta(lo)? (al|a la) (oficial|medic|cirujan)/, /^(avisale|avisa|si,? avisa|dale,? avisa)\b/];

// Explicit negation right before a symptom suppresses the match.
const NEGACION_PREVIA =
  /(?:(?:^|\s)(?:don'?t|do not|didn'?t|not|without|never|neither|nor|no tengo|no siento|no hay|no tuve|no noto|sin|ni|nunca)\s+(?:(?!but\b|though\b|and\b|pero\b|aunque\b|y\b|e\b)\S+\s+){0,2}|(?:^|\s)no\s+)$/;

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
  return /^(yes|yeah|yep|sure|a bit|a little|kind of|somewhat|some of that|si|sip|claro|un poco|bastante|algo de eso)\b/.test(normalizar(texto).replace(/[¿?¡!.,;:]+/g, ' ').trim());
}

/** Frase sobre la demora con Tierra, según el nivel. Con demora 0 (estación en órbita baja) se pide la PMC. */
export function cierreSegunEnlace(nivel, retrasoMin = RETRASO_TIERRA_POR_DEFECTO_MIN) {
  const idaYVuelta = Math.round(retrasoMin * 2 + EVALUACION_MIN);
  const hayDemora = Number.isFinite(retrasoMin) && retrasoMin >= 1;
  if (nivel === 'emergencia') {
    return hayDemora
      ? `I have already notified the medical officer and sent the alert to Houston, but the reply takes about ${idaYVuelta} minutes: do not wait for it, follow the medical checklist.`
      : 'I have already notified the medical officer. Call Houston and request a private medical conference.';
  }
  if (nivel === 'urgente') {
    return hayDemora
      ? `I notified the medical officer and the alert is on its way to Houston; the reply takes about ${idaYVuelta} minutes, so the medical officer is checking you now.`
      : 'I notified the medical officer: ask Houston for a private medical conference.';
  }
  return 'If you want me to report this, say "notify the medical officer" and I will log it for your next private medical conference.';
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
    ? `Done, I notified the medical officer and the report is heading to Houston for your private medical conference; the reply takes about ${idaYVuelta} minutes. If anything gets worse, tell me and I will mark it urgent.`
    : 'Done, I notified the medical officer and requested a private medical conference with the flight surgeon.';
}
