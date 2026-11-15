import { INDICADORES } from '../tipos.js';
import { lecturasParaInicio } from '../../components/inicio/metricas.js';
import { armarInformeParaTierra } from './logicaEnlace.js';

const textos = (valor) => Array.isArray(valor) ? valor.filter((item) => typeof item === 'string' && item.trim()) : [];
const numero = (valor) => valor.toLocaleString('en-US', { maximumFractionDigits: 1 });

export function juntaDelTripulante(input, astronautId, sol) {
  if (Number.isInteger(input?.sol) && input.sol > sol) return false;
  const identidad = input?.astronautId ?? input?.astronauta?.id ?? input?.astronauta ?? 'ana';
  return identidad === astronautId;
}

/** Usa la Junta guardada del tripulante o presenta los registros ya evaluados por el motor. */
export function informeDesdeRegistros({ astronauta, lecturas = [], evaluacion = {}, sol, junta }) {
  const nombre = astronauta?.name || 'Crewmember';
  const resultado = junta?.output?.json ?? junta?.output?.junta ?? junta?.output;
  const tecnico = resultado?.informe_tecnico;
  if (astronauta && tecnico?.resumen_clinico) {
    const informe = armarInformeParaTierra(junta);
    return { ...informe, astronauta: nombre, hallazgos: textos(tecnico.hallazgos), plan: textos(tecnico.plan) };
  }

  const disponibles = lecturasParaInicio(lecturas, sol).filter((l) => INDICADORES[l.indicator]);
  const ultimas = new Map(disponibles.map((l) => [l.indicator, l]));
  const mediciones = [...ultimas.values()].map((l) => `${INDICADORES[l.indicator].etiqueta} ${numero(l.value)} ${l.unit || INDICADORES[l.indicator].unidad}`);
  const alertas = evaluacion.alerts || [];
  let resumen = 'No measurements saved for this crewmember yet.';
  if (mediciones.length) resumen = `Crewmember ${nombre}, Sol ${sol}. ${mediciones.join('. ')}.`;
  else if (alertas.length) resumen = `Crewmember ${nombre}, Sol ${sol}. ${alertas.map((a) => a.why).join(' ')}`;
  return {
    origen: 'registros',
    sol,
    nivel: evaluacion.globalLevel || 'green',
    astronauta: nombre,
    titulo: `Flight Surgeon Report · Sol ${sol}`,
    resumen,
    hallazgos: alertas.length ? textos(alertas.map((a) => a.why)) : mediciones,
    plan: [...new Set(alertas.flatMap((a) => textos(a.actions)))],
    ts: disponibles.at(-1)?.ts || null,
    disponible: Boolean(astronauta) && (disponibles.length > 0 || alertas.length > 0),
  };
}

export function crearTransmisionCanal({ texto, informe, astronauta, sol, ts = new Date().toISOString(), id = crypto.randomUUID() }) {
  const esInforme = Boolean(informe);
  const contenido = esInforme ? informe.resumen : String(texto || '').trim();
  if (!contenido) throw new Error('Write a message for Ground Control.');
  return {
    id: `${esInforme ? 'informe' : 'mensaje'}-${id}`,
    astronaut_id: astronauta.id,
    astronaut_name: astronauta.name,
    sol,
    nivel: informe?.nivel || 'green',
    estado: 'en_cola',
    titulo: esInforme ? informe.titulo : 'Message to Ground Control',
    resumen_tecnico: contenido,
    hallazgos: esInforme ? textos(informe.hallazgos) : [],
    plan_sugerido: esInforme ? textos(informe.plan) : [],
    enviado_en: ts,
    actualizado_en: ts,
    sincronizacion: 'pendiente',
  };
}

/** Reconstruye las dos direcciones del canal a partir de envíos y dictámenes almacenados. */
export function mensajesDeTransmisiones(transmisiones, astronautId) {
  const mensajes = [];
  for (const envio of transmisiones) {
    if (envio.astronaut_id !== astronautId) continue;
    const esTexto = envio.id.startsWith('mensaje-');
    const enviado = envio.sincronizacion !== 'pendiente' && Boolean(envio.enviado_en);
    const recibidoEnTierra = enviado && ['en_houston', 'viajando_vuelta', 'recibido'].includes(envio.estado);
    mensajes.push({
      id: `${envio.id}-salida`, direccion: 'salida', remitente: envio.astronaut_name,
      texto: esTexto ? envio.resumen_tecnico : `Report transmission for Sol ${envio.sol}.`,
      ts: envio.enviado_en, sol: envio.sol,
      entrega: envio.sincronizacion || 'enviado',
      enviado,
      recibidoEnDestino: recibidoEnTierra,
    });
    const respuesta = envio.respuesta_medica;
    if (envio.estado === 'recibido' && respuesta?.resumenTecnico) {
      mensajes.push({
        id: `${envio.id}-entrada`, direccion: 'entrada', remitente: respuesta.remitente || 'Ground Control Base',
        texto: respuesta.resumenTecnico, indicaciones: textos(respuesta.indicaciones),
        ts: envio.actualizado_en, sol: respuesta.sol ?? envio.sol, entrega: 'recibido',
        enviado: true, recibidoEnDestino: true,
      });
    }
  }
  return mensajes.sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')) || a.id.localeCompare(b.id));
}

export function agruparMensajesPorDia(mensajes) {
  const dias = new Map();
  for (const mensaje of mensajes) {
    const fecha = Date.parse(mensaje.ts);
    const clave = Number.isFinite(fecha) ? new Date(fecha).toISOString().slice(0, 10) : `sol-${mensaje.sol}`;
    if (!dias.has(clave)) dias.set(clave, { clave, ts: Number.isFinite(fecha) ? mensaje.ts : null, sol: mensaje.sol, mensajes: [], entrada: [], salida: [] });
    dias.get(clave).mensajes.push(mensaje);
    dias.get(clave)[mensaje.direccion].push(mensaje);
  }
  return [...dias.values()];
}
