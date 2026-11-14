import { textoParaVoz } from '../vega/texto.js';

export const FORMATOS_GRABACION = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function elegirVozVyta(voces = []) {
  const espanol = voces.filter((v) => /^es(?:[-_]|$)/i.test(v.lang));
  return espanol.find((v) => /Elena/i.test(v.name) && /^es[-_]AR$/i.test(v.lang))
    || espanol.find((v) => /^es[-_]AR$/i.test(v.lang))
    || espanol.find((v) => /Google|Natural|Online/i.test(v.name))
    || espanol[0];
}

export function fragmentosParaVoz(texto) {
  let pendiente = textoParaVoz(String(texto).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));
  const partes = [];
  while (pendiente.length > 180) {
    const tramo = pendiente.slice(0, 181);
    const frase = Math.max(tramo.lastIndexOf('. '), tramo.lastIndexOf('? '), tramo.lastIndexOf('! '));
    const espacio = tramo.lastIndexOf(' ');
    const corte = frase > 40 ? frase + 1 : espacio > 0 ? espacio : 180;
    partes.push(pendiente.slice(0, corte).trim());
    pendiente = pendiente.slice(corte).trim();
  }
  if (pendiente) partes.push(pendiente);
  return partes;
}

/** Detecta el fin de frase localmente; el silencio no se manda a transcribir. */
export function crearDetectorFinDeFrase(inicio, { silencioMs = 1800, esperaMs = 15000, maximoMs = 60000, umbral = 0.015 } = {}) {
  let anterior = inicio;
  let vozConsecutiva = 0;
  let huboVoz = false;
  let ultimaVoz = inicio;
  return (rms, ahora) => {
    const paso = Math.min(100, Math.max(0, ahora - anterior));
    anterior = ahora;
    if (rms >= umbral) {
      vozConsecutiva += paso;
      ultimaVoz = ahora;
      if (vozConsecutiva >= 150) huboVoz = true;
    } else vozConsecutiva = 0;
    if (ahora - inicio >= maximoMs) return { terminar: true, enviar: huboVoz };
    if (huboVoz && ahora - ultimaVoz >= silencioMs) return { terminar: true, enviar: true };
    if (!huboVoz && ahora - inicio >= esperaMs) return { terminar: true, enviar: false };
    return { terminar: false, enviar: false };
  };
}
