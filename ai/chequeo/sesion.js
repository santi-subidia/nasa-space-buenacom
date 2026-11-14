// Chequeo matutino por voz: Vega pregunta de a una cosa, escucha, anota y sigue hasta completar.
// No depende de React: igual que la sesión de Vega, expone un store (suscribir / obtener).
//
//   const chequeo = crearChequeoPorVoz({ voz, astronautId: 'ana', alRegistrar: (reading) => db.readings.add(reading) });
//   await chequeo.iniciar();                     // "Completar por voz" en la pantalla Registrar
//   await chequeo.anotar('Anotá 37 con 6 de temperatura');   // frase suelta en cualquier momento
//
// `alRegistrar` recibe una Reading del modelo de datos con `source: 'voice'`.
import { describirMedicion, IDS_DE_VOZ, INDICADORES, validarMedicion } from './indicadores.js';
import { interpretarLocal } from './local.js';
import { normalizar } from '../vega/texto.js';

/** Pasos del chequeo matutino de 90 s (el sueño llega solo del Watch simulado). Configurable. */
export const PASOS_MATUTINOS = [
  { id: 'presion', indicadores: ['bp_sys', 'bp_dia'], pregunta: 'Empecemos por la presión. ¿Qué cifras te dio? Decime la alta y la baja.' },
  { id: 'temperatura', indicadores: ['temp'], pregunta: '¿Qué temperatura tenés?' },
  { id: 'animo', indicadores: ['mood'], pregunta: '¿Cómo te sentís hoy, del uno al cinco? Cinco es muy bien.' },
  { id: 'estres', indicadores: ['stress'], pregunta: '¿Y el estrés, del uno al diez?' },
];

const MAX_INTENTOS = 3;
const TIEMPO_MAXIMO_MS = 25_000;

const esComando = (texto, palabras) => {
  const t = normalizar(texto);
  return palabras.some((p) => new RegExp(`\\b${p}`).test(t));
};
const quiereSaltar = (t) => esComando(t, ['salte', 'saltar', 'despues', 'omiti', 'omitir', 'no se']);
const quiereTerminar = (t) => esComando(t, ['cancel', 'terminar', 'basta', 'para ya', 'dejalo']);

function nuevaReading({ indicador, valor, unidad }, astronautId, ahora) {
  const id = globalThis.crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, astronautId, indicator: indicador, value: valor, unit: unidad, ts: ahora(), source: 'voice' };
}

export function crearChequeoPorVoz({
  voz,
  pasos = PASOS_MATUTINOS,
  astronautId,
  alRegistrar = () => {},
  fetchFn = globalThis.fetch?.bind(globalThis),
  url = '/api/claude',
  ahora = () => new Date().toISOString(),
} = {}) {
  let estado = { fase: 'inactivo', pasoActual: null, hechos: {}, omitidos: [], mensajes: [], error: '' };
  let corrida = 0;
  const oyentes = new Set();

  const emitir = (cambios) => {
    estado = { ...estado, ...cambios };
    for (const oyente of oyentes) oyente();
  };

  async function decir(texto) {
    // Mientras Vega habla la fase es "preguntando" (en pantalla, "hablando"); al terminar queda "completo" si ya se terminó.
    emitir({ fase: estado.fase === 'completo' ? 'completo' : 'preguntando', mensajes: [...estado.mensajes, { rol: 'vega', texto }] });
    await voz?.hablar?.(texto);
  }

  /** Local primero (digitos); si no alcanza, Claude con la herramienta. null = no se entendió. */
  async function interpretar(texto, esperado) {
    const local = interpretarLocal(texto, { esperado });
    if (local) {
      const validadas = local.map(validarMedicion);
      return { mediciones: validadas.filter((v) => v.ok).map((v) => v.medicion), problema: validadas.find((v) => !v.ok)?.mensaje ?? null };
    }
    try {
      const respuesta = await fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo: 'check', texto, pendientes: esperado.filter((id) => IDS_DE_VOZ.includes(id)) }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok || !cuerpo.ok) return null;
      const validadas = (cuerpo.mediciones ?? []).map(validarMedicion).filter((v) => v.ok).map((v) => v.medicion);
      return { mediciones: validadas, problema: cuerpo.rechazadas?.[0]?.mensaje ?? null };
    } catch {
      return null;
    }
  }

  function registrar(mediciones) {
    const hechos = { ...estado.hechos };
    for (const m of mediciones) {
      const reading = nuevaReading(m, astronautId, ahora);
      alRegistrar(reading);
      hechos[m.indicador] = reading;
    }
    emitir({ hechos });
  }

  const resumen = (mediciones) => mediciones.map(describirMedicion).join(' y ');

  /** Frase suelta: "Anotá 37 con 6 de temperatura". Devuelve las mediciones registradas. */
  async function anotar(texto) {
    const resultado = await interpretar(String(texto ?? ''), []);
    if (!resultado?.mediciones.length) {
      await decir(resultado?.problema ?? 'No entendí qué anotar. Decime el indicador y el valor, por ejemplo "temperatura 37 con 6".');
      return [];
    }
    registrar(resultado.mediciones);
    await decir(`Anoté ${resumen(resultado.mediciones)}.`);
    return resultado.mediciones;
  }

  async function hacerPaso(paso, vigente) {
    emitir({ pasoActual: paso.id, fase: 'preguntando' });
    await decir(paso.pregunta);
    let pendientes = [...paso.indicadores];

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      if (!vigente()) return 'cancelado';
      emitir({ fase: 'escuchando', error: '' });
      let texto;
      try {
        texto = await voz.escuchar();
      } catch (e) {
        if (!vigente() || e?.codigo === 'aborted') return 'cancelado';
        if (e?.codigo === 'no-speech') {
          await decir('No te escuché. Decímelo de nuevo.');
          continue;
        }
        emitir({ fase: 'inactivo', error: e?.mensaje ?? 'No pude usar el micrófono.' });
        return 'error';
      }
      if (!vigente()) return 'cancelado';
      emitir({ mensajes: [...estado.mensajes, { rol: 'usuario', texto }] });

      if (quiereTerminar(texto)) return 'cancelado';
      if (quiereSaltar(texto)) return 'omitido';

      emitir({ fase: 'pensando' });
      const resultado = await interpretar(texto, pendientes);
      if (!vigente()) return 'cancelado';

      if (resultado?.mediciones.length) {
        // Solo cuenta lo que este paso esperaba: no se cuela otro indicador por un error de reconocimiento.
        const utiles = resultado.mediciones.filter((m) => pendientes.includes(m.indicador));
        if (utiles.length) {
          registrar(utiles);
          pendientes = pendientes.filter((id) => !utiles.some((m) => m.indicador === id));
          if (!pendientes.length) {
            await decir(`Anoté ${resumen(utiles)}.`);
            return 'hecho';
          }
          await decir(`Anoté ${resumen(utiles)}. Me falta ${pendientes.map((id) => INDICADORES[id].nombre).join(' y ')}.`);
          continue;
        }
      }
      await decir(resultado?.problema ?? 'No te entendí. Probá con números, por ejemplo "37 con 6".');
    }
    return 'omitido'; // demasiados intentos: se sigue con el próximo paso
  }

  /** Recorre los pasos que faltan. Resuelve cuando termina o se cancela. */
  async function iniciar() {
    if (!voz?.soportaReconocimiento) {
      emitir({ error: 'Este navegador no reconoce voz. Completá el chequeo con el teclado.' });
      return { completo: false };
    }
    const mio = ++corrida;
    const vigente = () => mio === corrida;
    emitir({ fase: 'preguntando', error: '', mensajes: [], hechos: {}, omitidos: [] });

    for (const paso of pasos) {
      if (paso.indicadores.every((id) => estado.hechos[id])) continue;
      const resultado = await hacerPaso(paso, vigente);
      if (resultado === 'cancelado' || resultado === 'error') {
        if (vigente()) emitir({ fase: 'inactivo', pasoActual: null });
        return { completo: false };
      }
      if (resultado === 'omitido') emitir({ omitidos: [...estado.omitidos, paso.id] });
    }

    const completo = estado.omitidos.length === 0;
    emitir({ fase: 'completo', pasoActual: null });
    await decir(completo ? 'Chequeo completo. Que tengas un buen día.' : `Chequeo terminado. Quedó sin anotar: ${estado.omitidos.join(', ')}.`);
    return { completo };
  }

  function cancelar() {
    ++corrida;
    voz?.pararDeEscuchar?.();
    voz?.callar?.();
    emitir({ fase: 'inactivo', pasoActual: null });
  }

  return {
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    obtener: () => estado,
    iniciar,
    anotar,
    cancelar,
  };
}
