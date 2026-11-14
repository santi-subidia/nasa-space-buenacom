// Detección de urgencias en el navegador, SIN IA y sin red: si alguien nombra una señal roja, la app
// reacciona al instante (mensaje local + aviso al oficial médico) sin esperar a Claude ni depender de él.
// Es una red de seguridad conservadora: prefiere avisar de más.
import { normalizar } from './texto.js';

const PATRONES = [
  {
    nivel: 'critica',
    categoria: 'autolesion',
    patrones: [/hacerme dano/, /lastimarme/, /matarme/, /suicid/, /quitarme la vida/, /quiero morir/, /no quiero (seguir|vivir)/, /acabar con todo/],
    mensaje:
      'Te escucho, y me importa cómo estás. No estás solo: voy a avisar ahora al oficial médico. Si podés, quedate con alguien de la tripulación hasta que llegue.',
  },
  {
    nivel: 'alta',
    categoria: 'cardiorrespiratoria',
    patrones: [/dolor (de|en el) pecho/, /(no puedo|me cuesta) respirar/, /falta de aire/, /me desmay/, /perdi el conocimiento/, /presion en el pecho/],
    mensaje: 'Eso puede ser serio. Avisá ahora al oficial médico y quedate sentado y quieto. Voy a darle aviso yo también.',
  },
  {
    nivel: 'alta',
    categoria: 'trombosis',
    patrones: [/(cuello|brazo|pierna) (muy )?hinchad/, /hinchazon (en|del) (cuello|brazo|pierna)/],
    mensaje: 'Un cuello, brazo o pierna hinchados pueden indicar un coágulo. Avisá ahora al oficial médico; voy a darle aviso yo también.',
  },
  {
    nivel: 'alta',
    categoria: 'general',
    patrones: [/fiebre (muy )?alta/, /sangr(o|e|ado|ando)/, /vomit(o|ando) sangre/, /convuls/],
    mensaje: 'Esto necesita al oficial médico ahora. Voy a darle aviso.',
  },
];

/** @returns {{nivel:'critica'|'alta', categoria:string, mensaje:string}|null} */
export function detectarUrgencia(texto) {
  const t = normalizar(texto);
  for (const grupo of PATRONES) {
    if (grupo.patrones.some((p) => p.test(t))) return { nivel: grupo.nivel, categoria: grupo.categoria, mensaje: grupo.mensaje };
  }
  return null;
}
