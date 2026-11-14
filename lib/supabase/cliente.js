// Cliente de Supabase seguro para navegador, servidor Node y pruebas unitarias sin conexión.
// Cuando faltan las variables de entorno, devuelve `null` para mantener el modo offline IndexedDB.

import { createClient } from '@supabase/supabase-js';

let _cliente = null;

/** Indica si Next/Node tiene configurada la URL y clave pública de Supabase. */
export function estaSupabaseConfigurado() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Devuelve un singleton de `@supabase/supabase-js` usando la anon key, o `null` si no está configurado.
 * Nunca lanza error por falta de credenciales.
 */
export function obtenerSupabaseCliente() {
  if (!estaSupabaseConfigurado()) return null;
  if (!_cliente) {
    _cliente = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: typeof window !== 'undefined',
          autoRefreshToken: typeof window !== 'undefined',
          detectSessionInUrl: false,
        },
      }
    );
  }
  return _cliente;
}
