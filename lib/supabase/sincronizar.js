// Capa de sincronización offline-first (IndexedDB <-> Supabase PostgreSQL + pgvector).
// Todas las operaciones capturan errores de red para no romper el funcionamiento autónomo de Base Marte.

import { obtenerSupabaseCliente } from './cliente.js';
import { generarEmbedding384, formatearVectorPg, similitudCoseno } from '../rag/embeddings.js';
import {
  INFORME_TECNICO_RESPALDO_SOL42,
  RESPUESTA_MEDICA_SOL42,
  TRADUCCION_VEGA_SOL42,
} from '../enlace/logicaEnlace.js';

export const ID_TRANSMISION_SOL42 = 'enlace-sol42-ana';

function idTransmisionDe(informe) {
  const sol = Number.isInteger(informe?.sol) ? informe.sol : 42;
  const astro = String(informe?.astronauta ?? 'ana').toLowerCase().includes('marcos') ? 'marcos' : 'ana';
  return `enlace-sol${sol}-${astro}`;
}

export async function sincronizarLecturaRemota(lectura) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase || !lectura?.id) return false;
  try {
    const { error } = await supabase.from('mediciones').upsert(
      {
        id: lectura.id,
        astronaut_id: lectura.astronautId,
        indicator: lectura.indicator,
        value: Number(lectura.value),
        unit: lectura.unit,
        ts: lectura.ts ?? new Date().toISOString(),
        source: lectura.source ?? 'manual',
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function sincronizarSintomaRemoto(sintoma) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase || !sintoma?.id) return false;
  try {
    const { error } = await supabase.from('sintomas').upsert(
      {
        id: sintoma.id,
        astronaut_id: sintoma.astronautId,
        body_zone: sintoma.bodyZone,
        code: sintoma.code,
        severity: Number(sintoma.severity ?? 1),
        notes: sintoma.notes ?? null,
        ts: sintoma.ts ?? new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function sincronizarResultadoIaRemoto(resultado) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase || !resultado?.id) return false;
  try {
    const astronautId =
      resultado.input?.astronauta ??
      resultado.input?.astronautId ??
      null;
    const sol = Number.isInteger(resultado.input?.sol) ? resultado.input.sol : null;
    const { error } = await supabase.from('resultados_ia').upsert(
      {
        id: resultado.id,
        kind: resultado.kind,
        astronaut_id: astronautId,
        sol,
        input: resultado.input ?? {},
        output: resultado.output ?? {},
        ts: resultado.ts ?? new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function publicarInformeEnlaceRemoto(informe, estado = 'en_houston') {
  const supabase = obtenerSupabaseCliente();
  const base = informe?.resumen ? informe : INFORME_TECNICO_RESPALDO_SOL42;
  if (!supabase) return null;
  const id = idTransmisionDe(base);
  const ahora = new Date().toISOString();
  try {
    const { data: existente } = await supabase
      .from('transmisiones_enlace')
      .select('respuesta_medica, traduccion_vega')
      .eq('id', id)
      .maybeSingle();

    const fila = {
      id,
      astronaut_id: String(base.astronauta ?? '').toLowerCase().includes('marcos') ? 'marcos' : 'ana',
      astronaut_name: base.astronauta ?? 'Ana Ríos',
      sol: Number.isInteger(base.sol) ? base.sol : 42,
      nivel: base.nivel ?? 'orange',
      estado,
      titulo: base.titulo ?? 'Informe para médicos de vuelo',
      resumen_tecnico: base.resumen,
      hallazgos: Array.isArray(base.hallazgos) ? base.hallazgos : [],
      plan_sugerido: Array.isArray(base.plan) ? base.plan : [],
      respuesta_medica: existente?.respuesta_medica ?? RESPUESTA_MEDICA_SOL42,
      traduccion_vega: existente?.traduccion_vega ?? TRADUCCION_VEGA_SOL42,
      enviado_en: base.ts ?? ahora,
      actualizado_en: ahora,
    };

    const { data, error } = await supabase
      .from('transmisiones_enlace')
      .upsert(fila, { onConflict: 'id' })
      .select()
      .single();

    return error ? null : data;
  } catch {
    return null;
  }
}

export function transmisionRespaldoLocal() {
  return {
    id: ID_TRANSMISION_SOL42,
    astronaut_id: 'ana',
    astronaut_name: INFORME_TECNICO_RESPALDO_SOL42.astronauta,
    sol: INFORME_TECNICO_RESPALDO_SOL42.sol,
    nivel: INFORME_TECNICO_RESPALDO_SOL42.nivel,
    estado: 'en_houston',
    titulo: INFORME_TECNICO_RESPALDO_SOL42.titulo,
    resumen_tecnico: INFORME_TECNICO_RESPALDO_SOL42.resumen,
    hallazgos: INFORME_TECNICO_RESPALDO_SOL42.hallazgos,
    plan_sugerido: INFORME_TECNICO_RESPALDO_SOL42.plan,
    respuesta_medica: RESPUESTA_MEDICA_SOL42,
    traduccion_vega: TRADUCCION_VEGA_SOL42,
    enviado_en: '2026-10-12T12:14:00.000Z',
    actualizado_en: '2026-10-12T12:16:00.000Z',
    origen: 'local',
  };
}

export async function listarTransmisionesEnlaceRemotas({ astronautId, incluirRespaldo = true } = {}) {
  const supabase = obtenerSupabaseCliente();
  const respaldo = incluirRespaldo ? [transmisionRespaldoLocal()] : [];
  if (!supabase) return { ok: false, modo: 'local', datos: respaldo };
  try {
    let consulta = supabase
      .from('transmisiones_enlace')
      .select('*');
    if (astronautId) consulta = consulta.eq('astronaut_id', astronautId);
    const { data, error } = await consulta
      .order('actualizado_en', { ascending: false })
      .limit(100)
      .abortSignal(AbortSignal.timeout(10000));
    if (error || !Array.isArray(data) || data.length === 0) {
      return { ok: !error, modo: error ? 'local' : 'supabase', datos: respaldo };
    }
    return { ok: true, modo: 'supabase', datos: data };
  } catch {
    return { ok: false, modo: 'local', datos: respaldo };
  }
}

/** Publica un envío del canal en la bandeja existente de Control Terrestre. */
export async function publicarTransmisionEnlaceRemota(transmision, supabase = obtenerSupabaseCliente()) {
  if (!supabase) return null;
  const fila = {
    id: transmision.id,
    astronaut_id: transmision.astronaut_id,
    astronaut_name: transmision.astronaut_name,
    sol: transmision.sol,
    nivel: transmision.nivel,
    estado: 'en_houston',
    titulo: transmision.titulo,
    resumen_tecnico: transmision.resumen_tecnico,
    hallazgos: transmision.hallazgos,
    plan_sugerido: transmision.plan_sugerido,
    enviado_en: transmision.enviado_en,
    actualizado_en: transmision.enviado_en,
  };
  try {
    // Un reintento conserva el mismo id y respeta una respuesta que haya llegado entre ambos envíos.
    const { error } = await supabase.from('transmisiones_enlace')
      .upsert(fila, { onConflict: 'id', ignoreDuplicates: true })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) return null;
    const { data } = await supabase.from('transmisiones_enlace').select('*')
      .eq('id', fila.id).maybeSingle().abortSignal(AbortSignal.timeout(10000));
    return data || fila;
  } catch {
    return null;
  }
}

export async function obtenerUltimaTransmisionEnlace(id = ID_TRANSMISION_SOL42) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('transmisiones_enlace')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!error && data) return data;

    const { data: lista } = await supabase
      .from('transmisiones_enlace')
      .select('*')
      .order('actualizado_en', { ascending: false })
      .limit(1);
    return lista?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function guardarRespuestaHoustonRemota(idTransmision, respuestaMedica, traduccionVega) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase) return { ok: false, error: 'Supabase no está configurado en el cliente.' };
  try {
    const { data, error } = await supabase
      .from('transmisiones_enlace')
      .update({
        estado: 'recibido',
        respuesta_medica: respuestaMedica,
        traduccion_vega: traduccionVega,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', idTransmision)
      .select()
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, dato: data };
  } catch (err) {
    return { ok: false, error: err?.message ?? 'Error al guardar en Supabase' };
  }
}

export async function listarActividadRecienteHouston(astronautId = 'ana') {
  const supabase = obtenerSupabaseCliente();
  if (!supabase) return { ok: false, mediciones: [], sintomas: [] };
  try {
    const [{ data: mediciones }, { data: sintomas }] = await Promise.all([
      supabase
        .from('mediciones')
        .select('id, indicator, value, unit, ts, source')
        .eq('astronaut_id', astronautId)
        .order('ts', { ascending: false })
        .limit(12),
      supabase
        .from('sintomas')
        .select('id, body_zone, code, severity, notes, ts')
        .eq('astronaut_id', astronautId)
        .order('ts', { ascending: false })
        .limit(6),
    ]);
    return { ok: true, mediciones: mediciones ?? [], sintomas: sintomas ?? [] };
  } catch {
    return { ok: false, mediciones: [], sintomas: [] };
  }
}

export async function buscarProtocolosRag(consulta, limite = 4) {
  const texto = String(consulta ?? '').trim();
  const vector = generarEmbedding384(texto || 'reactivacion viral inmunidad sueno estres');
  const supabase = obtenerSupabaseCliente();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('buscar_documentos_clinicos', {
        query_embedding: formatearVectorPg(vector),
        match_count: limite,
      });
      if (!error && Array.isArray(data) && data.length > 0) {
        return { ok: true, fuente: 'pgvector', resultados: data };
      }
    } catch {
      /* fallback local abajo */
    }
  }

  return { ok: false, fuente: 'local', resultados: [] };
}

export { similitudCoseno };
