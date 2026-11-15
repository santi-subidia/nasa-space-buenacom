// Sesión de Vega: une micrófono → /api/claude → lectura en voz alta, y guarda la conversación.
// No depende de React: expone un "store" (suscribir / obtener) para usarlo con useSyncExternalStore.
//
//   const vega = crearSesionVega({ voz: crearVoz({ alCambiar: ... }), alAvisarOficial: (aviso) => ... });
//   vega.suscribir(() => setEstado(vega.obtener()));
//   await vega.preguntarPorVoz();          // botón del micrófono
//   await vega.preguntar('¿Puedo hacer la EVA de mañana?');   // sugerencia rápida o texto escrito
import { detectarUrgencia } from './urgencia.js';
import {
  cierreSegunEnlace,
  esAfirmacion,
  esMalestarVago,
  mensajeAvisoEnviado,
  mensajeDeProtocolo,
  pideAviso,
  PREGUNTA_TRIAJE,
  RETRASO_TIERRA_POR_DEFECTO_MIN,
  triar,
} from './protocolos.js';
import { normalizar, textoParaVoz } from './texto.js';

export const SUGERENCIAS = ['¿Puedo hacer la EVA de mañana?', 'Explicame mi sueño', '¿Por qué me salió herpes?', '¿Cómo sé si estoy deshidratado?'];

export const MENSAJE_SIN_CONEXION =
  'No puedo consultar mis fuentes en este momento. Si es algo urgente, avisá al oficial médico.';

const TIEMPO_MAXIMO_MS = 40_000;

function esFraseDeCierre(texto) {
  const limpio = normalizar(texto).replace(/[¿?¡!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpio) return false;
  return /^(chau|adios|hasta luego|pausa|silencio|detener|apagate|terminar|cortar|listo)(\s+(vyta|vega))?$/.test(limpio)
    || /\b(chau vyta|hasta luego|apagate|terminar charla|cortar charla)\b/.test(limpio);
}

export function crearSesionVega({
  voz,
  alAvisarOficial = () => {},
  obtenerDatosDelDia = () => undefined,
  obtenerContextoPantalla = () => undefined,
  /** Demora de un tramo con Tierra (min). Hacia Marte no se puede esperar a Houston en una emergencia. */
  obtenerRetrasoTierraMin = () => RETRASO_TIERRA_POR_DEFECTO_MIN,
  fetchFn = globalThis.fetch?.bind(globalThis),
  url = '/api/claude',
} = {}) {
  let estado = { fase: 'inactivo', mensajes: [], parcial: '', error: '', sugerirAviso: false, continuo: false };
  let numero = 0; // identifica la consulta vigente: las respuestas viejas se descartan
  let controlador = null;
  let consultando = false;
  let escuchandoVoz = false;
  let modoContinuo = false;
  let cancelarMonitor = null;
  let historial = [];
  let triajePendiente = false; // VYTA preguntó por señales rojas y espera la respuesta
  const oyentes = new Set();

  const emitir = (cambios) => {
    estado = { ...estado, ...cambios };
    for (const oyente of oyentes) oyente();
  };
  const agregar = (mensaje) => emitir({ mensajes: [...estado.mensajes, { id: `m${estado.mensajes.length + 1}`, citas: [], ...mensaje }] });
  const detenerMonitor = () => {
    cancelarMonitor?.();
    cancelarMonitor = null;
  };

  async function leerEnVoz(texto, vigente, alInterrumpir) {
    if (!voz?.soportaSintesis || !texto) return false;
    let interrumpido = false;
    emitir({ fase: 'hablando' });
    detenerMonitor();
    if (modoContinuo && typeof voz?.vigilarInterrupcion === 'function') {
      cancelarMonitor = voz.vigilarInterrupcion(() => {
        if (!modoContinuo || !vigente()) return;
        interrumpido = true;
        detenerMonitor();
        controlador?.abort();
        voz.callar();
        alInterrumpir?.();
      });
    }
    try {
      await voz.hablar(texto);
    } finally {
      detenerMonitor();
    }
    // Si mientras hablaba se está consultando a la IA, sigue "pensando" en vez de quedar inactiva.
    if (vigente() && !interrumpido) emitir({ fase: consultando ? 'pensando' : 'inactivo' });
    return interrumpido;
  }

  async function consultar(pregunta, historialPrevio) {
    controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);
    try {
      const payload = { tipo: 'answer', pregunta, datosDelDia: obtenerDatosDelDia() };
      if (historialPrevio.length) payload.historial = historialPrevio;
      const contextoPantalla = obtenerContextoPantalla();
      if (contextoPantalla) payload.contextoPantalla = contextoPantalla;
      const respuesta = await fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
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
    const pregunta = String(texto ?? '').trim().slice(0, 500);
    if (!pregunta) return;
    const mio = ++numero;
    const vigente = () => mio === numero;
    escuchandoVoz = false;
    controlador?.abort();
    voz?.callar();

    const historialPrevio = historial.slice(-20);
    emitir({ error: '', parcial: '', sugerirAviso: false });
    agregar({ rol: 'usuario', texto: pregunta });

    let lectura = Promise.resolve(false); // la lectura del aviso local, si la hay, para no pisarla con la respuesta
    let interrumpidoPorUsuario = false;
    const marcarInterrumpido = () => { interrumpidoPorUsuario = true; };
    const recordar = (texto) => {
      historial = [...historialPrevio, { role: 'user', text: pregunta }, { role: 'assistant', text: texto }].slice(-20);
    };
    /** Respuesta 100 % local (sin IA): se muestra, se recuerda y se lee. */
    async function responderLocal(texto, extra = {}) {
      recordar(texto);
      agregar({ rol: 'vega', texto, origen: 'local', ...extra });
      if (hablar) await leerEnVoz(texto, vigente, marcarInterrumpido);
      if (vigente() && !interrumpidoPorUsuario) emitir({ fase: 'inactivo' });
    }

    const retrasoMin = obtenerRetrasoTierraMin();
    const esperabaTriaje = triajePendiente;
    triajePendiente = false;

    // El tripulante pide el aviso con palabras ("avisá al oficial médico"): no hace falta la IA.
    if (pideAviso(pregunta)) {
      avisarOficial(motivoDelHilo(pregunta), { anunciar: false });
      await responderLocal(mensajeAvisoEnviado(retrasoMin));
      return;
    }

    // Red de seguridad local: no depende de la IA ni de la red.
    let urgencia = detectarUrgencia(pregunta, { retrasoMin });
    if (!urgencia && esperabaTriaje && esAfirmacion(pregunta)) {
      // Contestó "sí" a la pregunta por señales rojas sin decir cuál: se trata como urgente.
      urgencia = {
        nivel: 'alta',
        triaje: 'urgente',
        categoria: 'senal-roja',
        protocolo: 'triaje',
        titulo: 'Señal roja sin detallar',
        mensaje: `Entonces lo tratamos como urgente: quedate quieto, sin esfuerzo, y que el oficial médico te tome presión, pulso y saturación ya. ${cierreSegunEnlace('urgente', retrasoMin)} Mientras tanto, contame qué sentís.`,
        citas: [],
      };
    }
    if (urgencia) {
      alAvisarOficial({
        nivel: urgencia.nivel,
        categoria: urgencia.categoria,
        protocolo: urgencia.protocolo,
        motivo: `${urgencia.titulo}: «${pregunta}»`,
        origen: 'vega',
        ts: new Date().toISOString(),
      });
      const local = { urgente: true, triaje: urgencia.triaje, citas: urgencia.citas };
      emitir({ sugerirAviso: false });
      if (urgencia.nivel === 'critica') {
        // Emergencia: los pasos salen de a bordo y no se espera a nadie.
        await responderLocal(urgencia.mensaje, local);
        return;
      }
      // Urgencia: se leen los primeros pasos Y se consulta a la IA a la vez (no se espera a que termine de hablar).
      agregar({ rol: 'vega', texto: urgencia.mensaje, origen: 'local', ...local });
      if (hablar) lectura = leerEnVoz(urgencia.mensaje, vigente, marcarInterrumpido);
    } else if (esMalestarVago(pregunta)) {
      // "Me siento mal" sin detalles: primero se descartan las señales rojas, como en un triaje.
      triajePendiente = true;
      await responderLocal(PREGUNTA_TRIAJE, { triaje: 'pregunta' });
      return;
    }

    const leve = urgencia ? null : triar(pregunta); // nivel "aviso": molestia esperable en vuelo

    consultando = true;
    emitir({ fase: 'pensando' });
    const cuerpo = await consultar(pregunta, historialPrevio);
    consultando = false;
    if (!vigente()) return; // llegó otra pregunta mientras tanto

    if (!cuerpo) {
      // Sin red, el protocolo local sigue sirviendo.
      const texto = leve ? mensajeDeProtocolo(leve.protocolo, { retrasoMin }) : MENSAJE_SIN_CONEXION;
      agregar({ rol: 'vega', texto, origen: 'local', citas: leve?.protocolo.fuentes ?? [] });
      emitir({ fase: 'inactivo', sugerirAviso: true });
      if (hablar && leve && !(await lectura) && !interrumpidoPorUsuario && vigente()) await leerEnVoz(texto, vigente, marcarInterrumpido);
      return;
    }

    const textoVoz = cuerpo.textoVoz ?? textoParaVoz(cuerpo.texto);
    recordar(textoVoz);
    agregar({ rol: 'vega', texto: textoVoz, citas: cuerpo.citasUsadas ?? [], origen: cuerpo.origen, motivo: cuerpo.motivo });
    emitir({ fase: 'inactivo', sugerirAviso: normalizar(textoVoz).includes('oficial medico') || Boolean(urgencia) || Boolean(leve) });
    if (hablar) {
      const cortadoEnAviso = await lectura; // primero termina el aviso, después la respuesta
      if (!cortadoEnAviso && !interrumpidoPorUsuario && vigente()) {
        await leerEnVoz(textoVoz, vigente, marcarInterrumpido);
      }
    }
  }

  /** Botón del micrófono / esfera: escucha una frase y la pregunta. */
  async function preguntarPorVoz() {
    if (!voz?.soportaReconocimiento) {
      emitir({ error: 'Este navegador no reconoce voz. Probá con Safari o Chrome, o escribí la pregunta.' });
      return;
    }
    controlador?.abort();
    const mio = ++numero;
    escuchandoVoz = true;
    emitir({ fase: 'escuchando', error: '', parcial: '' });
    try {
      const texto = await voz.escuchar();
      escuchandoVoz = false;
      if (mio !== numero) return;
      emitir({ parcial: '' });
      await preguntar(texto, { hablar: true });
    } catch (e) {
      escuchandoVoz = false;
      if (mio !== numero || e?.codigo === 'aborted') return;
      emitir({ fase: 'inactivo', parcial: '', error: e?.mensaje ?? 'No pude usar el micrófono.' });
    }
  }

  /** Lo que contó el tripulante en los últimos turnos, para que el aviso diga de qué se trata. */
  function motivoDelHilo(pedido) {
    const contado = estado.mensajes
      .filter((m) => m.rol === 'usuario' && m.texto !== pedido && !pideAviso(m.texto))
      .slice(-3)
      .map((m) => m.texto)
      .join(' · ');
    return contado ? `Pedido por el tripulante. Contó: «${contado}»` : 'Pedido por el tripulante desde la conversación con VYTA';
  }

  /** Acción "avisar al oficial médico" desde la conversación (botón o pedido por voz). */
  function avisarOficial(motivo = motivoDelHilo(), { anunciar = true } = {}) {
    alAvisarOficial({ nivel: 'alta', categoria: 'manual', motivo, origen: 'vega', ts: new Date().toISOString() });
    if (anunciar) agregar({ rol: 'vega', texto: 'Listo, avisé al oficial médico.', origen: 'local' });
    emitir({ sugerirAviso: false });
  }

  function terminarEscucha() {
    if (estado.fase === 'escuchando' && voz?.finalizarEscucha) {
      voz.finalizarEscucha();
      return;
    }
    cancelar();
  }

  function cancelar() {
    ++numero;
    escuchandoVoz = false;
    consultando = false;
    detenerMonitor();
    controlador?.abort();
    voz?.pararDeEscuchar();
    voz?.callar();
    emitir({ fase: 'inactivo', parcial: '' });
  }

  function detenerConversacionContinua() {
    modoContinuo = false;
    detenerMonitor();
    emitir({ continuo: false });
    cancelar();
    voz?.cerrarCanalContinuo?.();
  }

  /** Inicia una charla fluida manos libres con escucha continua e interrupción (barge-in). */
  async function iniciarConversacionContinua() {
    if (!voz?.soportaReconocimiento) {
      emitir({ error: 'Este navegador no reconoce voz. Probá con Safari o Chrome, o escribí la pregunta.' });
      return;
    }
    if (modoContinuo) {
      detenerConversacionContinua();
      return;
    }
    modoContinuo = true;
    emitir({ continuo: true, error: '', parcial: '' });

    try {
      await voz?.abrirCanalContinuo?.();
    } catch (e) {
      modoContinuo = false;
      emitir({ continuo: false, fase: 'inactivo', error: e?.mensaje ?? 'No pude abrir el micrófono.' });
      return;
    }

    if (!modoContinuo) {
      voz?.cerrarCanalContinuo?.();
      return;
    }

    try {
      while (modoContinuo) {
        controlador?.abort();
        const mio = ++numero;
        escuchandoVoz = true;
        emitir({ fase: 'escuchando', parcial: '' });
        try {
          const texto = await voz.escuchar({ esperaMs: 15000, pausaSilencioMs: 1400 });
          escuchandoVoz = false;
          if (!modoContinuo || mio !== numero) break;
          emitir({ parcial: '' });
          if (esFraseDeCierre(texto)) {
            modoContinuo = false;
            emitir({ continuo: false });
            agregar({ rol: 'usuario', texto });
            const despedida = 'Perfecto, pauso la charla. Tocá la esfera cuando quieras seguir.';
            agregar({ rol: 'vega', texto: despedida, origen: 'local' });
            await leerEnVoz(despedida, () => true);
            break;
          }
          await preguntar(texto, { hablar: true });
        } catch (e) {
          escuchandoVoz = false;
          if (!modoContinuo) break;
          if (e?.codigo === 'aborted') break;
          if (e?.codigo === 'no-speech') {
            emitir({ fase: 'inactivo', parcial: '' });
            break;
          }
          emitir({ fase: 'inactivo', parcial: '', error: e?.mensaje ?? 'No pude usar el micrófono.' });
          break;
        }
      }
    } finally {
      escuchandoVoz = false;
      modoContinuo = false;
      detenerMonitor();
      voz?.cerrarCanalContinuo?.();
      emitir({ continuo: false, fase: 'inactivo', parcial: '' });
    }
  }

  function tocar() {
    if (estado.fase === 'escuchando') terminarEscucha();
    else if (['solicitando', 'transcribiendo', 'pensando'].includes(estado.fase)) cancelar();
    else return preguntarPorVoz();
  }

  function tocarContinuo() {
    if (modoContinuo) {
      detenerConversacionContinua();
      return;
    }
    return iniciarConversacionContinua();
  }

  return {
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    obtener: () => estado,
    /** El micrófono informa texto parcial mientras se habla: pasarlo con `voz.alOirParcial`. */
    ponerParcial: (parcial) => emitir({ parcial }),
    /** Propaga fases de captura/transcripción ('solicitando'|'escuchando'|'transcribiendo') mientras escucha. */
    ponerFaseVoz: (fase) => {
      if (escuchandoVoz && ['solicitando', 'escuchando', 'transcribiendo'].includes(fase)) emitir({ fase });
    },
    preguntar,
    preguntarPorVoz,
    iniciarConversacionContinua,
    detenerConversacionContinua,
    terminarEscucha,
    tocar,
    tocarContinuo,
    avisarOficial,
    cancelar,
  };
}
