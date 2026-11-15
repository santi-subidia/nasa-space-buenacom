// Gestión de sesión y roles de misión (Base Marte <-> Médica de Vuelo en Houston).
// Usa `localStorage` + `useSyncExternalStore` y autentica contra Supabase Auth cuando está configurado.

import { useSyncExternalStore } from 'react';
import { obtenerSupabaseCliente, estaSupabaseConfigurado } from '../supabase/cliente.js';

export const CLAVE_SESION = 'astrovitals:sesion:v1';

export const PERFILES_DEMO = [
  {
    id: 'ana',
    email: 'ana@ares4.nasa.gov',
    passwordDemo: 'ares4-marte',
    nombre: 'Cmdt. Nicolás Méndez',
    rol: 'tripulante',
    entorno: 'Base Marte · Ares IV',
    astronautId: 'ana',
    titulo: 'Comandante de misión',
    descripcion: 'Carga chequeos diarios, conversa con Vega y envía informes clínicos hacia Tierra.',
    rutaInicial: '/',
  },
  {
    id: 'marcos',
    email: 'marcos@ares4.nasa.gov',
    passwordDemo: 'ares4-marte',
    nombre: 'Dr. Marcos Silva',
    rol: 'cmo',
    entorno: 'Base Marte · Ares IV',
    astronautId: 'marcos',
    titulo: 'Oficial médico de a bordo (CMO)',
    descripcion: 'Revisa alertas médicas de la tripulación en Base Marte con permisos de privacidad.',
    rutaInicial: '/tripulacion',
  },
  {
    id: 'elena',
    email: 'elena.vance@houston.nasa.gov',
    passwordDemo: 'houston-jsc',
    nombre: 'Dra. Elena Vance',
    rol: 'houston',
    entorno: 'Tierra · Houston JSC',
    astronautId: null,
    titulo: 'Médica de vuelo · Control de Misión',
    descripcion: 'Recibe los diagnósticos desde Marte, consulta protocolos NASA en pgvector y envía indicaciones.',
    rutaInicial: '/houston',
  },
];

const PERFIL_DEFECTO = PERFILES_DEMO[0];

const ESTADO_SERVIDOR = Object.freeze({
  id: PERFIL_DEFECTO.id,
  email: PERFIL_DEFECTO.email,
  nombre: PERFIL_DEFECTO.nombre,
  rol: PERFIL_DEFECTO.rol,
  entorno: PERFIL_DEFECTO.entorno,
  astronautId: PERFIL_DEFECTO.astronautId,
  titulo: PERFIL_DEFECTO.titulo,
  origen: 'demo',
});

let cacheSesion = null;
const oyentes = new Set();

export function obtenerPerfilPorId(id) {
  return PERFILES_DEMO.find((p) => p.id === id) ?? PERFIL_DEFECTO;
}

export function obtenerPerfilPorEmail(email) {
  const normalizado = String(email ?? '').trim().toLowerCase();
  return PERFILES_DEMO.find((p) => p.email === normalizado) ?? null;
}

function normalizarSesion(raw) {
  if (!raw || typeof raw !== 'object') return { ...ESTADO_SERVIDOR };
  const base = raw.id ? obtenerPerfilPorId(raw.id) : PERFIL_DEFECTO;
  const nombreRaw = raw.nombre ?? base.nombre;
  const nombre = nombreRaw === 'Cmdt. Ana Ríos' ? 'Cmdt. Nicolás Méndez' : nombreRaw;
  return {
    id: raw.id ?? base.id,
    email: raw.email ?? base.email,
    nombre,
    rol: raw.rol ?? base.rol,
    entorno: raw.entorno ?? base.entorno,
    astronautId: raw.astronautId !== undefined ? raw.astronautId : base.astronautId,
    titulo: raw.titulo ?? base.titulo,
    origen: raw.origen ?? 'demo',
  };
}

function cargarSesion() {
  if (typeof window === 'undefined') return ESTADO_SERVIDOR;
  if (cacheSesion) return cacheSesion;
  try {
    const raw = localStorage.getItem(CLAVE_SESION);
    cacheSesion = raw ? normalizarSesion(JSON.parse(raw)) : { ...ESTADO_SERVIDOR };
  } catch {
    cacheSesion = { ...ESTADO_SERVIDOR };
  }
  return cacheSesion;
}

function guardarSesion(nueva) {
  const normalizada = normalizarSesion(nueva);
  cacheSesion = normalizada;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(normalizada));
    } catch {
      /* almacenamiento bloqueado */
    }
    if (normalizada.astronautId) {
      import('../datos/tripulante.js')
        .then((m) => m.cambiarTripulanteActivo(normalizada.astronautId))
        .catch(() => {});
    }
  }
  oyentes.forEach((fn) => fn());
  return normalizada;
}

function suscribir(fn) {
  oyentes.add(fn);
  const enStorage = (e) => {
    if (e.key === CLAVE_SESION) {
      cacheSesion = null;
      fn();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', enStorage);
  }
  return () => {
    oyentes.delete(fn);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', enStorage);
    }
  };
}

export function leerSesionActual() {
  return cargarSesion();
}

/** Inicia sesión usando email y contraseña contra Supabase Auth (con fallback local si está sin red). */
export async function iniciarSesionConCredenciales(email, password) {
  const correo = String(email ?? '').trim().toLowerCase();
  const clave = String(password ?? '');
  if (!correo || !clave) {
    return { ok: false, error: 'Ingresá correo y contraseña.' };
  }

  const supabase = obtenerSupabaseCliente();
  if (supabase && estaSupabaseConfigurado()) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
    if (error) {
      return { ok: false, error: error.message };
    }
    const meta = data.user?.user_metadata ?? {};
    const perfilCoincidente = obtenerPerfilPorEmail(correo);
    const sesion = guardarSesion({
      id: perfilCoincidente?.id ?? meta.astronautId ?? 'custom',
      email: data.user?.email ?? correo,
      nombre: meta.nombre ?? perfilCoincidente?.nombre ?? correo,
      rol: meta.rol ?? perfilCoincidente?.rol ?? 'tripulante',
      entorno: meta.rol === 'houston' ? 'Tierra · Houston JSC' : 'Base Marte · Ares IV',
      astronautId: meta.astronautId !== undefined ? meta.astronautId : (perfilCoincidente?.astronautId ?? null),
      titulo: meta.titulo ?? perfilCoincidente?.titulo ?? 'Usuario verificado',
      origen: 'supabase',
    });
    return { ok: true, sesion, modo: 'supabase' };
  }

  const perfilDemo = obtenerPerfilPorEmail(correo);
  if (perfilDemo && clave === perfilDemo.passwordDemo) {
    const sesion = guardarSesion({ ...perfilDemo, origen: 'demo' });
    return { ok: true, sesion, modo: 'demo' };
  }
  return { ok: false, error: 'Credenciales inválidas o Supabase sin conexión.' };
}

/** Acceso directo en 1 clic a uno de los perfiles de misión (autentica en Supabase Auth en segundo plano). */
export async function entrarComoPerfil(perfilId) {
  const perfil = obtenerPerfilPorId(perfilId);
  const resultado = await iniciarSesionConCredenciales(perfil.email, perfil.passwordDemo);
  if (resultado.ok) return resultado;
  const sesion = guardarSesion({ ...perfil, origen: 'demo' });
  return { ok: true, sesion, modo: 'demo' };
}

export async function cerrarSesion() {
  const supabase = obtenerSupabaseCliente();
  if (supabase) {
    await supabase.auth.signOut().catch(() => {});
  }
  return guardarSesion({ ...ESTADO_SERVIDOR, origen: 'demo' });
}

export function useSesion() {
  return useSyncExternalStore(suscribir, cargarSesion, () => ESTADO_SERVIDOR);
}
