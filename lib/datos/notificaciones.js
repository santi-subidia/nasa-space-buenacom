// Store cliente y motor reactivo de notificaciones (#12).
'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';
import { getNotificationsDb } from '@/lib/db';
import { useAvisos } from '@/lib/datos/avisos';
import { useEnlace } from '@/lib/datos/enlace';
import { useRelojMision } from '@/lib/datos/jornada';
import { calcularEstadoEnvio } from '@/lib/enlace/logicaEnlace';
import {
  construirNotificacionAviso,
  construirNotificacionMotivacion,
  construirNotificacionTierra,
  evaluarHitosHorario,
  obtenerAspectoNotificacion,
  puedeNotificar,
} from '@/lib/notificaciones/logicaNotificaciones';
import { formatearHoraMision, normalizarMinutosSol } from '@/lib/reloj/relojMision';

export const CLAVE_NOTIFICACIONES = 'astrovitals:notificaciones:v1';
/** Evento de ventana para abrir/cerrar el panel desde la campana de la cabecera de misión. */
export const EVENTO_ALTERNAR_PANEL = 'vyta:alternar-notificaciones';

export function alternarPanelNotificaciones() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_ALTERNAR_PANEL));
}
const CLAVE_RELOJ_FALLBACK = 'astrovitals:reloj-mision:v1';
const MAX_NOTIFICACIONES = 50;
const MAX_CLAVES = 150;

const ESTADO_BASE = Object.freeze({
  items: [],
  silenciadasSueno: 0,
  sonidoActivo: true,
  clavesEmitidas: [],
  avisosProcesados: [],
});

let cache = null;
const oyentes = new Set();
let contadorId = 0;
let audioCtx = null;

function normalizarListaStrings(lista, max = MAX_CLAVES) {
  if (!Array.isArray(lista)) return [];
  const unicas = [];
  const vistas = new Set();
  for (const item of lista) {
    if (typeof item !== 'string' || !item || vistas.has(item)) continue;
    vistas.add(item);
    unicas.push(item);
  }
  return unicas.slice(-max);
}

function normalizarEstado(valor) {
  if (!valor || typeof valor !== 'object') return ESTADO_BASE;
  const items = Array.isArray(valor.items)
    ? valor.items.filter((it) => it && typeof it === 'object' && it.id && it.titulo).slice(0, MAX_NOTIFICACIONES)
    : [];
  const silenciadas = Number.isFinite(Number(valor.silenciadasSueno))
    ? Math.max(0, Math.floor(Number(valor.silenciadasSueno)))
    : 0;

  return {
    items,
    silenciadasSueno: silenciadas,
    sonidoActivo: valor.sonidoActivo !== undefined ? Boolean(valor.sonidoActivo) : true,
    clavesEmitidas: normalizarListaStrings(valor.clavesEmitidas),
    avisosProcesados: normalizarListaStrings(valor.avisosProcesados),
  };
}

function cargar() {
  if (typeof window === 'undefined') return ESTADO_BASE;
  if (cache) return cache;
  try {
    const crudo = localStorage.getItem(CLAVE_NOTIFICACIONES);
    cache = crudo ? normalizarEstado(JSON.parse(crudo)) : ESTADO_BASE;
  } catch {
    cache = ESTADO_BASE;
  }
  return cache;
}

function guardar(siguiente) {
  const normalizado = normalizarEstado(siguiente);
  cache = normalizado;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CLAVE_NOTIFICACIONES, JSON.stringify(normalizado));
    } catch {
      /* modo privado: queda solo en memoria */
    }
  }
  oyentes.forEach((f) => f());
  return normalizado;
}

function suscribir(avisar) {
  oyentes.add(avisar);
  const enOtraPestana = (e) => {
    if (e.key === CLAVE_NOTIFICACIONES) {
      cache = null;
      avisar();
    }
  };
  window.addEventListener('storage', enOtraPestana);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener('storage', enOtraPestana);
  };
}

function leerRelojFallback() {
  if (typeof window === 'undefined') return { sol: 42, minutos: 420 };
  try {
    const crudo = localStorage.getItem(CLAVE_RELOJ_FALLBACK);
    if (!crudo) return { sol: 42, minutos: 420 };
    const parsed = JSON.parse(crudo);
    return {
      sol: Number.isFinite(parsed?.sol) ? Math.floor(parsed.sol) : 42,
      minutos: Number.isFinite(parsed?.minutos) ? normalizarMinutosSol(parsed.minutos) : 420,
    };
  } catch {
    return { sol: 42, minutos: 420 };
  }
}

function reproducirTono(tipo = 'rutina', nivel = 'info') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioCtx) {
      audioCtx = new AudioCtor();
    }
    if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
      audioCtx.resume().catch(() => {});
    }

    const ahora = audioCtx.currentTime;
    const esCritica = tipo === 'alerta' && (nivel === 'red' || nivel === 'critica');

    let secuencia;
    if (esCritica) {
      secuencia = [
        { freq: 880, offset: 0, duracion: 0.12, ganancia: 0.14, onda: 'triangle' },
        { freq: 880, offset: 0.18, duracion: 0.12, ganancia: 0.14, onda: 'triangle' },
        { freq: 987.77, offset: 0.36, duracion: 0.16, ganancia: 0.16, onda: 'triangle' },
      ];
    } else if (tipo === 'alerta') {
      secuencia = [
        { freq: 659.25, offset: 0, duracion: 0.12, ganancia: 0.11, onda: 'triangle' },
        { freq: 659.25, offset: 0.19, duracion: 0.14, ganancia: 0.11, onda: 'triangle' },
      ];
    } else if (tipo === 'tierra') {
      secuencia = [
        { freq: 523.25, offset: 0, duracion: 0.14, ganancia: 0.08, onda: 'sine' },
        { freq: 659.25, offset: 0.13, duracion: 0.2, ganancia: 0.08, onda: 'sine' },
      ];
    } else if (tipo === 'motivacion') {
      secuencia = [
        { freq: 523.25, offset: 0, duracion: 0.11, ganancia: 0.08, onda: 'sine' },
        { freq: 783.99, offset: 0.12, duracion: 0.18, ganancia: 0.08, onda: 'sine' },
      ];
    } else {
      secuencia = [{ freq: 440, offset: 0, duracion: 0.16, ganancia: 0.06, onda: 'sine' }];
    }

    for (const nota of secuencia) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = nota.onda;
      osc.frequency.setValueAtTime(nota.freq, ahora + nota.offset);

      gain.gain.setValueAtTime(0.0001, ahora + nota.offset);
      gain.gain.exponentialRampToValueAtTime(nota.ganancia, ahora + nota.offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ahora + nota.offset + nota.duracion);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(ahora + nota.offset);
      osc.stop(ahora + nota.offset + nota.duracion + 0.02);
    }
  } catch {
    /* Web Audio API no disponible o bloqueada */
  }
}

function enviarNotificacionNavegador(notificacion) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;
  try {
    const prefijo = notificacion.horaMision ? `[${notificacion.horaMision}] ` : '';
    new window.Notification(`${notificacion.simbolo} ${notificacion.titulo}`, {
      body: `${prefijo}${notificacion.mensaje}`,
      tag: notificacion.id,
    });
  } catch {
    /* Entorno sin soporte de constructor Notification */
  }
}

function registrarClavesEmitidas(claves = []) {
  if (!Array.isArray(claves) || claves.length === 0) return;
  const actual = cargar();
  const combinadas = normalizarListaStrings([...actual.clavesEmitidas, ...claves]);
  if (combinadas.length === actual.clavesEmitidas.length) return;
  guardar({
    ...actual,
    clavesEmitidas: combinadas,
  });
}

function registrarAvisoProcesado(avisoKey) {
  if (!avisoKey) return;
  const actual = cargar();
  if (actual.avisosProcesados.includes(avisoKey)) return;
  guardar({
    ...actual,
    avisosProcesados: normalizarListaStrings([...actual.avisosProcesados, avisoKey]),
  });
}

function incrementarSilenciadas(cantidad = 1) {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return;
  const actual = cargar();
  guardar({
    ...actual,
    silenciadasSueno: actual.silenciadasSueno + Math.floor(cantidad),
  });
}

/** Solicita permiso al usuario para mostrar notificaciones del navegador (`window.Notification`). */
export async function pedirPermisoNavegador() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    if (window.Notification.permission === 'default') {
      return await window.Notification.requestPermission();
    }
    return window.Notification.permission;
  } catch {
    return window.Notification.permission || 'default';
  }
}

/**
 * Emite una notificación pasando por la compuerta de sueño protegido (22:00–06:30).
 * Si está bloqueada por sueño protegido, incrementa el contador `silenciadasSueno`.
 */
export function emitirNotificacion(entrada = {}, opciones = {}) {
  const actual = cargar();
  const relojFallback = leerRelojFallback();
  const minutosEfectivos = Number.isFinite(opciones.minutosSol)
    ? normalizarMinutosSol(opciones.minutosSol)
    : Number.isFinite(entrada.minutosSol)
      ? normalizarMinutosSol(entrada.minutosSol)
      : relojFallback.minutos;

  const tipo = entrada.tipo || 'rutina';
  const nivel = entrada.nivel || 'info';

  const permiso = opciones.forzar
    ? { permitido: true, conSonido: true, motivoBloqueo: null }
    : puedeNotificar({ tipo, nivel, minutosSol: minutosEfectivos });

  if (!permiso.permitido) {
    guardar({
      ...actual,
      silenciadasSueno: actual.silenciadasSueno + 1,
    });
    return {
      emitida: false,
      motivoBloqueo: permiso.motivoBloqueo,
      notificacion: null,
    };
  }

  const aspecto = obtenerAspectoNotificacion(tipo, nivel);
  contadorId += 1;
  const id = entrada.id || `notif-${Date.now()}-${contadorId}`;

  if (actual.items.some((it) => it.id === id)) {
    return {
      emitida: false,
      motivoBloqueo: 'duplicada',
      notificacion: null,
    };
  }

  const notificacion = {
    id,
    clave: entrada.clave || null,
    tipo,
    nivel,
    etiqueta: aspecto.etiqueta,
    color: aspecto.color,
    simbolo: aspecto.simbolo,
    titulo: entrada.titulo || aspecto.etiqueta,
    mensaje: entrada.mensaje || '',
    ruta: entrada.ruta ?? null,
    sol: Number.isFinite(entrada.sol) ? entrada.sol : relojFallback.sol,
    minutosSol: minutosEfectivos,
    horaMision: entrada.horaMision || formatearHoraMision(minutosEfectivos),
    origen: entrada.origen || 'sistema',
    conSonido: permiso.conSonido,
    ts: new Date().toISOString(),
  };

  const siguientesClaves = entrada.clave
    ? normalizarListaStrings([...actual.clavesEmitidas, entrada.clave])
    : actual.clavesEmitidas;

  guardar({
    ...actual,
    items: [notificacion, ...actual.items].slice(0, MAX_NOTIFICACIONES),
    clavesEmitidas: siguientesClaves,
  });

  if (actual.sonidoActivo && permiso.conSonido) {
    reproducirTono(tipo, nivel);
  }
  enviarNotificacionNavegador(notificacion);

  return {
    emitida: true,
    motivoBloqueo: null,
    notificacion,
  };
}

/** Dispara una de las 5 notificaciones de prueba rápida del panel. */
export function dispararPruebaNotificacion(variante = 'rutina', relojActual = null) {
  const reloj = relojActual || leerRelojFallback();
  const minutos = Number.isFinite(reloj?.minutos) ? reloj.minutos : 420;
  const sol = Number.isFinite(reloj?.sol) ? reloj.sol : 42;
  const sufijo = `${Date.now()}-${++contadorId}`;

  switch (variante) {
    case 'alerta':
      return emitirNotificacion(
        {
          id: `prueba-alerta-${sufijo}`,
          tipo: 'alerta',
          nivel: 'orange',
          titulo: 'Avisar al oficial médico',
          mensaje: 'Prueba de alerta media: parámetro en seguimiento clínico.',
          ruta: '/enlace',
          sol,
          minutosSol: minutos,
          origen: 'prueba',
        },
        { minutosSol: minutos },
      );

    case 'alerta_roja_sueno':
    case 'alerta_roja': {
      const minutosSueno = 23 * 60 + 30; // 23:30 dentro de sueño protegido
      return emitirNotificacion(
        {
          id: `prueba-roja-${sufijo}`,
          tipo: 'alerta',
          nivel: 'red',
          titulo: 'Alerta roja en sueño protegido',
          mensaje: 'Evento crítico en descanso (23:30): atraviesa sueño protegido con sonido.',
          ruta: '/enlace',
          sol,
          minutosSol: minutosSueno,
          origen: 'prueba',
        },
        { minutosSol: minutosSueno },
      );
    }

    case 'tierra': {
      const notifTierra = construirNotificacionTierra({ sol, minutosSol: minutos });
      return emitirNotificacion(
        { ...notifTierra, id: `prueba-tierra-${sufijo}`, origen: 'prueba' },
        { minutosSol: minutos },
      );
    }

    case 'motivacion': {
      const notifMot = construirNotificacionMotivacion({ rachaDias: 12, minutosSol: minutos });
      return emitirNotificacion(
        { ...notifMot, id: `prueba-motivacion-${sufijo}`, origen: 'prueba' },
        { minutosSol: minutos },
      );
    }

    case 'rutina':
    default:
      return emitirNotificacion(
        {
          id: `prueba-rutina-${sufijo}`,
          tipo: 'rutina',
          nivel: 'info',
          titulo: 'Toca el chequeo matutino',
          mensaje: 'Chequeo de 90 s: presión, temperatura, ánimo y reacción.',
          ruta: '/registrar',
          sol,
          minutosSol: minutos,
          origen: 'prueba',
        },
        { minutosSol: minutos },
      );
  }
}

/** Elimina una notificación puntual de la bandeja y de los toasts visibles. */
export function descartarNotificacion(id) {
  if (!id) return;
  const actual = cargar();
  const filtradas = actual.items.filter((it) => it.id !== id);
  if (filtradas.length === actual.items.length) return;
  guardar({
    ...actual,
    items: filtradas,
  });
}

/** Limpia todas las notificaciones, silenciadas y claves horarias acumuladas. */
export function limpiarNotificaciones() {
  const actual = cargar();
  guardar({
    ...actual,
    items: [],
    silenciadasSueno: 0,
    clavesEmitidas: [],
  });
}

/** Activa o silencia el audio Web Audio API de las notificaciones. */
export function alternarSonidoNotificaciones() {
  const actual = cargar();
  const siguiente = !actual.sonidoActivo;
  guardar({
    ...actual,
    sonidoActivo: siguiente,
  });
  return siguiente;
}

/** Suscripción SSR-safe al estado de notificaciones y sus acciones. */
export function useNotificaciones() {
  const estado = useSyncExternalStore(suscribir, cargar, () => ESTADO_BASE);
  const [permisoNavegador, setPermisoNavegador] = useState('default');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermisoNavegador('unsupported');
      return;
    }
    setPermisoNavegador(window.Notification.permission);
  }, []);

  async function solicitarPermiso() {
    const resultado = await pedirPermisoNavegador();
    setPermisoNavegador(resultado);
    return resultado;
  }

  return {
    items: estado.items,
    silenciadasSueno: estado.silenciadasSueno,
    sonidoActivo: estado.sonidoActivo,
    permisoNavegador,
    emitirNotificacion,
    dispararPruebaNotificacion,
    descartarNotificacion,
    limpiarNotificaciones,
    alternarSonidoNotificaciones,
    pedirPermisoNavegador: solicitarPermiso,
  };
}

/**
 * Conecta el motor de notificaciones con `useRelojMision`, `useAvisos` y `useEnlace`.
 * Debe montarse una sola vez en la raíz de la aplicación (`CentroNotificaciones`).
 */
export function useMotorNotificaciones() {
  const reloj = useRelojMision();
  const avisos = useAvisos();
  const enlace = useEnlace();
  const notificaciones = useNotificaciones();

  const relojActualRef = useRef({ sol: reloj.sol, minutos: reloj.minutos });
  relojActualRef.current = { sol: reloj.sol, minutos: reloj.minutos };

  const prevRelojRef = useRef(null);

  // 1) Hitos horarios del sol marciano
  useEffect(() => {
    const actualStore = cargar();
    const prev = prevRelojRef.current;

    if (prev && prev.sol === reloj.sol && prev.minutos === reloj.minutos) {
      return;
    }

    const evaluacion = evaluarHitosHorario({
      sol: reloj.sol,
      minutosAnteriores: prev ? prev.minutos : null,
      minutosActuales: reloj.minutos,
      diaSemana: reloj.diaSemana,
      yaEmitidas: new Set(actualStore.clavesEmitidas),
    });

    prevRelojRef.current = { sol: reloj.sol, minutos: reloj.minutos };

    if (evaluacion.nuevasClaves.length > 0) {
      registrarClavesEmitidas(evaluacion.nuevasClaves);
    }

    for (const notif of evaluacion.emitidas) {
      emitirNotificacion(notif, { minutosSol: notif.minutosSol });
    }

    if (evaluacion.bloqueadas.length > 0) {
      incrementarSilenciadas(evaluacion.bloqueadas.length);
    }
  }, [reloj.sol, reloj.minutos, reloj.diaSemana]);

  // 2) Avisos médicos guardados en `astrovitals:avisos:v1` (Vega, Cara, Junta)
  useEffect(() => {
    if (!Array.isArray(avisos) || avisos.length === 0) return;
    const actualStore = cargar();
    const yaProcesados = new Set(actualStore.avisosProcesados);

    for (const aviso of avisos) {
      const claveAviso = aviso?.id || aviso?.ts;
      if (!claveAviso || yaProcesados.has(claveAviso)) continue;

      yaProcesados.add(claveAviso);
      registrarAvisoProcesado(claveAviso);

      const { minutos } = relojActualRef.current;
      const notif = construirNotificacionAviso(aviso, minutos);
      emitirNotificacion(notif, { minutosSol: minutos });
    }
  }, [avisos]);

  // 3) Enlace con Tierra: cuando `respuestaDisponible` pasa a `true`
  const envio =
    enlace?.envio ?? calcularEstadoEnvio(enlace?.iniciado ? enlace?.minutosTranscurridos : null);
  const respuestaDisponible = Boolean(envio?.respuestaDisponible);
  const prevRespuestaRef = useRef(respuestaDisponible);

  useEffect(() => {
    if (!prevRespuestaRef.current && respuestaDisponible) {
      const { sol, minutos } = relojActualRef.current;
      const notif = construirNotificacionTierra({ sol, minutosSol: minutos });
      emitirNotificacion(notif, { minutosSol: minutos });
    }
    prevRespuestaRef.current = respuestaDisponible;
  }, [respuestaDisponible]);

  // 4) Alertas y notificaciones guardadas en la BD (ej. simulador de soles futuros)
  useEffect(() => {
    const sub = liveQuery(() => getNotificationsDb()).subscribe({
      next: (lista = []) => {
        const actualStore = cargar();
        const yaEmitidas = new Set(actualStore.clavesEmitidas);
        for (const n of lista) {
          if (!n?.id || yaEmitidas.has(n.id)) continue;
          yaEmitidas.add(n.id);
          registrarClavesEmitidas([n.id]);
          const { minutos } = relojActualRef.current;
          emitirNotificacion(
            {
              clave: n.id,
              tipo: n.tipo ?? 'alerta',
              nivel: n.nivel ?? n.color ?? 'orange',
              color: n.color ?? n.nivel ?? 'orange',
              titulo: n.titulo,
              mensaje: n.mensaje,
              ruta: n.ruta ?? '/',
              sol: n.sol ?? relojActualRef.current.sol,
            },
            { minutosSol: minutos },
          );
        }
      },
      error: () => {},
    });
    return () => sub.unsubscribe();
  }, []);

  return {
    ...notificaciones,
    reloj,
  };
}
