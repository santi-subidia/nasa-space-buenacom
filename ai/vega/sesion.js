// Sesión de Vega: une micrófono → /api/claude → lectura en voz alta, y guarda la conversación.
// No depende de React: expone un "store" (suscribir / obtener) para usarlo con useSyncExternalStore.
//
//   const vega = crearSesionVega({ voz: crearVoz({ alCambiar: ... }), alAvisarOficial: (aviso) => ... });
//   vega.suscribir(() => setEstado(vega.obtener()));
//   await vega.preguntarPorVoz();          // botón del micrófono
//   await vega.preguntar('¿Puedo hacer la EVA de mañana?');   // sugerencia rápida o texto escrito
import { detectarUrgencia } from './urgencia.js';
import { normalizar, textoParaVoz } from './texto.js';

export const SUGERENCIAS = ['¿Puedo hacer la EVA de mañana?', 'Explicame mi sueño', '¿Por qué me salió herpes?', '¿Cómo sé si estoy deshidratado?'];

export const MENSAJE_SIN_CONEXION =
  'No puedo consultar mis fuentes en este momento. Si es algo urgente, avisá al oficial médico.';

const TIEMPO_MAXIMO_MS = 40_000;

export function crearSesionVega({
  voz,
  alAvisarOficial = () => {},
  obtenerDatosDelDia = () => undefined,
  fetchFn = globalThis.fetch?.bind(globalThis),
  url = '/api/claude',
} = {}) {
  let estado = { fase: 'inactivo', mensajes: [], parcial: '', error: '', sugerirAviso: false };
  let numero = 0; // identifica la consulta vigente: las respuestas viejas se descartan
  let controlador = null;
  const oyentes = new Set();

  const emitir = (cambios) => {
    estado = { ...estado, ...cambios };
    for (const oyente of oyentes) oyente();
  };
  const agregar = (mensaje) => emitir({ mensajes: [...estado.mensajes, { id: `m${estado.mensajes.length + 1}`, citas: [], ...mensaje }] });

  async function leerEnVoz(texto, vigente) {
    if (!voz?.soportaSintesis || !texto) return;
    emitir({ fase: 'hablando' });
    await voz.hablar(texto);
    if (vigente()) emitir({ fase: 'inactivo' });
  }

  async function consultar(pregunta) {
    controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);
    try {
      const respuesta = await fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo: 'answer', pregunta, datosDelDia: obtenerDatosDelDia() }),
        signal: controlador.signal,
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok || !cuerpo.ok || !cuerpo.texto) return null;
      return cuerpo;
    } catch {
      return null;
    } finally {
      clearTimeout(temporizador);
    }
  }

  async function preguntar(texto, { hablar = true } = {}) {
    const pregunta = String(texto ?? '').trim();
    if (!pregunta) return;
    const mio = ++numero;
    const vigente = () => mio === numero;
    controlador?.abort();
    voz?.callar();

    emitir({ error: '', parcial: '', sugerirAviso: false });
    agregar({ rol: 'usuario', texto: pregunta });

    // Red de seguridad local: no depende de la IA ni de la red.
    const urgencia = detectarUrgencia(pregunta);
    if (urgencia) {
      alAvisarOficial({ nivel: urgencia.nivel, categoria: urgencia.categoria, motivo: pregunta, origen: 'vega', ts: new Date().toISOString() });
      agregar({ rol: 'vega', texto: urgencia.mensaje, origen: 'local', urgente: true });
      emitir({ sugerirAviso: false });
      if (urgencia.nivel === 'critica') {
        if (hablar) await leerEnVoz(urgencia.mensaje, vigente);
        emitir({ fase: 'inactivo' });
        return;
      }
      if (hablar) await leerEnVoz(urgencia.mensaje, vigente);
    }

    emitir({ fase: 'pensando' });
    const cuerpo = await consultar(pregunta);
    if (!vigente()) return; // llegó otra pregunta mientras tanto

    if (!cuerpo) {
      agregar({ rol: 'vega', texto: MENSAJE_SIN_CONEXION, origen: 'local' });
      emitir({ fase: 'inactivo', sugerirAviso: true });
      return;
    }

    const textoVoz = cuerpo.textoVoz ?? textoParaVoz(cuerpo.texto);
    agregar({ rol: 'vega', texto: textoVoz, citas: cuerpo.citasUsadas ?? [], origen: cuerpo.origen, motivo: cuerpo.motivo });
    emitir({ fase: 'inactivo', sugerirAviso: normalizar(textoVoz).includes('oficial medico') || Boolean(urgencia) });
    if (hablar) await leerEnVoz(textoVoz, vigente);
  }

  /** Botón del micrófono: escucha una frase y la pregunta. */
  async function preguntarPorVoz() {
    if (!voz?.soportaReconocimiento) {
      emitir({ error: 'Este navegador no reconoce voz. Usá Chrome o escribí la pregunta.' });
      return;
    }
    controlador?.abort();
    ++numero;
    emitir({ fase: 'escuchando', error: '', parcial: '' });
    try {
      const texto = await voz.escuchar();
      emitir({ parcial: '' });
      await preguntar(texto, { hablar: true });
    } catch (e) {
      if (e?.codigo === 'aborted') return;
      emitir({ fase: 'inactivo', parcial: '', error: e?.mensaje ?? 'No pude usar el micrófono.' });
    }
  }

  /** Acción "avisar al oficial médico" desde la conversación. */
  function avisarOficial(motivo = 'Pedido por el tripulante desde la conversación con Vega') {
    alAvisarOficial({ nivel: 'alta', categoria: 'manual', motivo, origen: 'vega', ts: new Date().toISOString() });
    agregar({ rol: 'vega', texto: 'Listo, avisé al oficial médico.', origen: 'local' });
    emitir({ sugerirAviso: false });
  }

  function cancelar() {
    ++numero;
    controlador?.abort();
    voz?.pararDeEscuchar();
    voz?.callar();
    emitir({ fase: 'inactivo', parcial: '' });
  }

  return {
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    obtener: () => estado,
    /** El micrófono informa texto parcial mientras se habla: pasarlo con `voz.alOirParcial`. */
    ponerParcial: (parcial) => emitir({ parcial }),
    preguntar,
    preguntarPorVoz,
    avisarOficial,
    cancelar,
  };
}
