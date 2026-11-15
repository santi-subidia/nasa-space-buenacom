// Capa de sincronización bidireccional offline-first (IndexedDB <-> Supabase PostgreSQL + pgvector).
// Todas las operaciones capturan errores de red para no romper el funcionamiento autónomo de Base Marte.
// Si las columnas/tablas nuevas aún no fueron migradas en Supabase, degrada limpiamente usando `resultados_ia`
// sin inventar datos ni bloquear la sincronización.

import { obtenerSupabaseCliente } from './cliente.js';
import { generarEmbedding384, formatearVectorPg, similitudCoseno } from '../rag/embeddings.js';
import {
  INFORME_TECNICO_RESPALDO_SOL42,
  normalizarRespuestaMedica,
  normalizarTraduccionVega,
  RESPUESTA_MEDICA_SOL42,
  TRADUCCION_VEGA_SOL42,
} from '../enlace/logicaEnlace.js';

export const ID_TRANSMISION_SOL42 = 'enlace-sol42-ana';
const INICIO_MISION_UTC = Date.parse('2026-09-01T00:00:00.000Z');
const MS_DIA = 86_400_000;

function idTransmisionDe(informe) {
  const sol = Number.isInteger(informe?.sol) ? informe.sol : 42;
  const astro = String(informe?.astronauta ?? 'ana').toLowerCase().includes('marcos') ? 'marcos' : 'ana';
  return `enlace-sol${sol}-${astro}`;
}

function esErrorDeEsquema(error) {
  const code = String(error?.code ?? '');
  const msg = String(error?.message ?? '');
  return (
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '42703' ||
    code === '42P01' ||
    /column .* does not exist/i.test(msg) ||
    /could not find .* column/i.test(msg) ||
    /could not find the table/i.test(msg) ||
    /relation .* does not exist/i.test(msg)
  );
}

/** Deriva `sol` si el registro remoto aún no tiene columna `sol` poblada. */
export function derivarSol(registro, solPorDefecto = null) {
  if (Number.isInteger(registro?.sol) && registro.sol >= 1) return registro.sol;
  const matchId = /^(?:demo|sim)-[^-]+-(\d+)-/.exec(String(registro?.id ?? ''));
  if (matchId) return Number(matchId[1]);
  if (registro?.ts) {
    const ms = Date.parse(registro.ts);
    if (Number.isFinite(ms) && ms >= INICIO_MISION_UTC && ms <= INICIO_MISION_UTC + 120 * MS_DIA) {
      return Math.max(1, Math.floor((ms - INICIO_MISION_UTC) / MS_DIA) + 1);
    }
  }
  return solPorDefecto;
}

function mapearLecturaRemotaFila(lectura) {
  return {
    id: lectura.id,
    astronaut_id: lectura.astronautId,
    indicator: lectura.indicator,
    value: Number(lectura.value),
    unit: lectura.unit,
    ts: lectura.ts ?? new Date().toISOString(),
    source: lectura.source ?? 'manual',
    sol: Number.isInteger(lectura.sol) ? lectura.sol : null,
    note: lectura.note ?? null,
    meta: lectura.meta ?? {},
  };
}

function mapearLecturaBaseFila(lectura) {
  return {
    id: lectura.id,
    astronaut_id: lectura.astronautId,
    indicator: lectura.indicator,
    value: Number(lectura.value),
    unit: lectura.unit,
    ts: lectura.ts ?? new Date().toISOString(),
    source: lectura.source ?? 'manual',
  };
}

function mapearFilaALecturaLocal(fila) {
  return {
    id: fila.id,
    astronautId: fila.astronaut_id,
    indicator: fila.indicator,
    value: Number(fila.value),
    unit: fila.unit,
    ts: fila.ts,
    source: fila.source ?? 'manual',
    ...(derivarSol(fila) != null ? { sol: derivarSol(fila) } : {}),
    ...(fila.note != null ? { note: fila.note } : {}),
    ...(fila.meta && Object.keys(fila.meta).length ? { meta: fila.meta } : {}),
  };
}

function mapearFilaASintomaLocal(fila) {
  return {
    id: fila.id,
    astronautId: fila.astronaut_id,
    bodyZone: fila.body_zone,
    code: fila.code,
    severity: Number(fila.severity ?? 1),
    ...(fila.notes != null ? { notes: fila.notes } : {}),
    ...(derivarSol(fila) != null ? { sol: derivarSol(fila) } : {}),
    ts: fila.ts,
  };
}

// ─── Escritura hacia Supabase ──────────────────────────────────────────────

export async function sincronizarTripulanteRemoto(tripulante) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase || !tripulante?.id) return false;
  const completo = {
    id: tripulante.id,
    name: tripulante.name,
    role: tripulante.role ?? 'crew',
    titulo: tripulante.titulo ?? null,
    baseline: tripulante.baseline ?? {},
    updated_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from('tripulantes').upsert(completo, { onConflict: 'id' });
    if (!error) return true;
    if (!esErrorDeEsquema(error)) return false;
    const { titulo: _ignorado, ...basico } = completo;
    const { error: errBasico } = await supabase.from('tripulantes').upsert(basico, { onConflict: 'id' });
    return !errBasico;
  } catch {
    return false;
  }
}

export async function sincronizarLecturaRemota(lectura) {
  if (!lectura?.id) return false;
  return sincronizarLecturasRemotas([lectura]);
}

export async function sincronizarLecturasRemotas(lecturas = []) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase || !Array.isArray(lecturas) || lecturas.length === 0) return false;
  const validas = lecturas.filter((l) => l?.id && l?.astronautId && l?.indicator);
  if (!validas.length) return false;
  try {
    for (let i = 0; i < validas.length; i += 250) {
      const lote = validas.slice(i, i + 250);
      const { error } = await supabase
        .from('mediciones')
        .upsert(lote.map(mapearLecturaRemotaFila), { onConflict: 'id' });
      if (error) {
        if (!esErrorDeEsquema(error)) return false;
        const { error: errBase } = await supabase
          .from('mediciones')
          .upsert(lote.map(mapearLecturaBaseFila), { onConflict: 'id' });
        if (errBase) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function sincronizarSintomaRemoto(sintoma) {
  if (!sintoma?.id) return false;
  return sincronizarSintomasRemotos([sintoma]);
}

export async function sincronizarSintomasRemotos(sintomas = []) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase || !Array.isArray(sintomas) || sintomas.length === 0) return false;
  const validos = sintomas.filter((s) => s?.id && s?.astronautId && s?.code);
  if (!validos.length) return false;
  const completo = validos.map((s) => ({
    id: s.id,
    astronaut_id: s.astronautId,
    body_zone: s.bodyZone,
    code: s.code,
    severity: Number(s.severity ?? 1),
    notes: s.notes ?? null,
    sol: Number.isInteger(s.sol) ? s.sol : null,
    ts: s.ts ?? new Date().toISOString(),
  }));
  try {
    const { error } = await supabase.from('sintomas').upsert(completo, { onConflict: 'id' });
    if (!error) return true;
    if (!esErrorDeEsquema(error)) return false;
    const basico = completo.map(({ sol: _s, ...resto }) => resto);
    const { error: errBasico } = await supabase.from('sintomas').upsert(basico, { onConflict: 'id' });
    return !errBasico;
  } catch {
    return false;
  }
}

export async function sincronizarResultadoIaRemoto(resultado) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase || !resultado?.id) return false;
  try {
    const astronautId =
      resultado.astronautId ??
      resultado.input?.astronauta ??
      resultado.input?.astronautId ??
      null;
    const sol = Number.isInteger(resultado.sol)
      ? resultado.sol
      : Number.isInteger(resultado.input?.sol)
        ? resultado.input.sol
        : null;
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
      { onConflict: 'id' },
    );
    return !error;
  } catch {
    return false;
  }
}

export async function sincronizarEstadoMisionRemoto(estado) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase || !estado?.id) return false;
  const fila = {
    id: estado.id,
    mission_name: estado.missionName ?? 'Ares IV · Mars Base',
    entorno: estado.entorno ?? 'mars_base',
    sol_actual: Number(estado.solActual ?? 42),
    total_soles: Number(estado.totalSoles ?? 60),
    minutos_sol: Number(estado.minutos ?? 390),
    dia_semana: estado.diaSemana ?? 'jueves',
    pausado: Boolean(estado.pausado ?? true),
    acelerado: Boolean(estado.acelerado ?? true),
    simulacion_activa: estado.simulacionActiva ?? {},
    updated_at: estado.updatedAt ?? new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from('estado_mision').upsert(fila, { onConflict: 'id' });
    if (!error) return true;
    if (!esErrorDeEsquema(error)) return false;
    return sincronizarResultadoIaRemoto({
      id: `estado-mision-${estado.id}`,
      kind: 'estado_mision',
      sol: fila.sol_actual,
      input: { id: estado.id },
      output: estado,
      ts: fila.updated_at,
    });
  } catch {
    return false;
  }
}

export async function sincronizarCabinaRemota(registros) {
  const lista = Array.isArray(registros) ? registros : [registros];
  const supabase = obtenerSupabaseCliente();
  if (!supabase || !lista.length) return false;
  const filas = lista.map((r) => ({
    id: r.id,
    sol: Number(r.sol),
    ts: r.ts ?? new Date().toISOString(),
    co2_mmhg: Number(r.co2Mmhg ?? r.co2 ?? 2.1),
    o2_pct: Number(r.o2Pct ?? r.o2 ?? 20.9),
    pressure_kpa: Number(r.pressureKpa ?? r.presionKpa ?? 101.2),
    noise_dba: Number(r.noiseDba ?? r.ruidoTrabajo ?? 53),
    noise_rest_db: Number(r.noiseRestDb ?? r.ruidoDescanso ?? 42),
    radiation_rate_msv_sol: Number(r.radiationRateMsvSol ?? r.tasaMSvDia ?? 0.73),
    radiation_total_msv: Number(r.radiationTotalMsv ?? r.dosisTotalMsv ?? 350),
    tormenta: Boolean(r.tormenta),
    en_refugio: Boolean(r.enRefugio),
    source: r.source ?? 'cabin_sensors',
    note: r.note ?? null,
    meta: r.meta ?? {},
  }));
  try {
    const { error } = await supabase.from('telemetria_cabina').upsert(filas, { onConflict: 'id' });
    if (!error) return true;
    if (!esErrorDeEsquema(error)) return false;
    for (const r of lista) {
      await sincronizarResultadoIaRemoto({
        id: `cabina-${r.id}`,
        kind: 'cabina_sol',
        sol: r.sol,
        input: { sol: r.sol },
        output: r,
        ts: r.ts ?? new Date().toISOString(),
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function sincronizarTareasRemotas(tareas) {
  const lista = Array.isArray(tareas) ? tareas : [tareas];
  const supabase = obtenerSupabaseCliente();
  if (!supabase || !lista.length) return false;
  const filas = lista.map((t) => ({
    id: t.id,
    astronaut_id: t.astronautId,
    kind: t.kind ?? 'routine',
    title: t.title,
    mission_time: t.missionTime ?? '08:00',
    day_type: t.dayType ?? null,
    recurrence: t.recurrence ?? 'daily',
    done: Boolean(t.done),
    sol: Number.isInteger(t.sol) ? t.sol : null,
    updated_at: new Date().toISOString(),
  }));
  try {
    const { error } = await supabase.from('tareas_jornada').upsert(filas, { onConflict: 'id' });
    if (!error) return true;
    if (!esErrorDeEsquema(error)) return false;
    for (const t of lista) {
      await sincronizarResultadoIaRemoto({
        id: `tarea-${t.id}`,
        kind: 'tarea_jornada',
        astronautId: t.astronautId,
        sol: t.sol ?? null,
        input: { taskId: t.id, astronautId: t.astronautId },
        output: t,
        ts: new Date().toISOString(),
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function sincronizarNotificacionRemota(notif) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase || !notif?.id) return false;
  const fila = {
    id: notif.id,
    astronaut_id: notif.astronautId ?? null,
    sol: Number.isInteger(notif.sol) ? notif.sol : null,
    tipo: notif.tipo ?? 'rutina',
    nivel: notif.nivel ?? notif.color ?? 'blue',
    titulo: notif.titulo,
    mensaje: notif.mensaje ?? '',
    leida: Boolean(notif.leida),
    ruta: notif.ruta ?? null,
    meta: notif.meta ?? {},
    ts: notif.ts ?? new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from('notificaciones_mision').upsert(fila, { onConflict: 'id' });
    if (!error) return true;
    if (!esErrorDeEsquema(error)) return false;
    return sincronizarResultadoIaRemoto({
      id: `notif-${notif.id}`,
      kind: 'notificacion_mision',
      astronautId: notif.astronautId ?? null,
      sol: fila.sol,
      input: { id: notif.id },
      output: notif,
      ts: fila.ts,
    });
  } catch {
    return false;
  }
}

// ─── Lectura / Hidratación desde Supabase ──────────────────────────────────

async function fetchPaginado(supabase, tabla, ordenCol, asc = true) {
  const todo = [];
  const paso = 1000;
  for (let desde = 0; desde < 20000; desde += paso) {
    const { data, error } = await supabase
      .from(tabla)
      .select('*')
      .order(ordenCol, { ascending: asc })
      .range(desde, desde + paso - 1);
    if (error) return { ok: false, error, datos: [] };
    if (!Array.isArray(data) || data.length === 0) break;
    todo.push(...data);
    if (data.length < paso) break;
  }
  return { ok: true, datos: todo };
}

/**
 * Descarga todo el estado clínico y operativo real desde Supabase para hidratar IndexedDB.
 * Retorna `null` si Supabase no está configurado o no hay conectividad.
 */
export async function hidratarTodoDesdeSupabase() {
  const supabase = obtenerSupabaseCliente();
  if (!supabase) return null;

  try {
    const [tripRes, medRes, sinRes, iaRes, txRes] = await Promise.all([
      supabase.from('tripulantes').select('*'),
      fetchPaginado(supabase, 'mediciones', 'ts', true),
      supabase.from('sintomas').select('*').order('ts', { ascending: true }),
      supabase.from('resultados_ia').select('*').order('ts', { ascending: false }).limit(500),
      supabase.from('transmisiones_enlace').select('*').order('actualizado_en', { ascending: false }).limit(50),
    ]);

    if (tripRes.error || !medRes.ok) {
      return null;
    }

    const iaRows = Array.isArray(iaRes.data) ? iaRes.data : [];

    // Estado de misión (tabla dedicada o respaldo en `resultados_ia`).
    let missionState = null;
    const estRes = await supabase.from('estado_mision').select('*').eq('id', 'ares-iv').maybeSingle();
    if (!estRes.error && estRes.data) {
      missionState = {
        id: estRes.data.id,
        missionName: estRes.data.mission_name,
        entorno: estRes.data.entorno,
        solActual: estRes.data.sol_actual,
        totalSoles: estRes.data.total_soles,
        minutos: estRes.data.minutos_sol,
        diaSemana: estRes.data.dia_semana,
        pausado: estRes.data.pausado,
        acelerado: estRes.data.acelerado,
        simulacionActiva: estRes.data.simulacion_activa ?? {},
        updatedAt: estRes.data.updated_at,
      };
    } else {
      const iaEstado = iaRows.find((r) => r.kind === 'estado_mision');
      if (iaEstado?.output) missionState = iaEstado.output;
    }

    // Telemetría de cabina (tabla dedicada o respaldo en `resultados_ia`).
    let cabinTelemetry = [];
    const cabRes = await supabase.from('telemetria_cabina').select('*').order('sol', { ascending: true });
    if (!cabRes.error && Array.isArray(cabRes.data)) {
      cabinTelemetry = cabRes.data.map((c) => ({
        id: c.id,
        sol: Number(c.sol),
        ts: c.ts,
        co2Mmhg: Number(c.co2_mmhg),
        o2Pct: Number(c.o2_pct),
        pressureKpa: Number(c.pressure_kpa),
        noiseDba: Number(c.noise_dba),
        noiseRestDb: Number(c.noise_rest_db ?? 42),
        radiationRateMsvSol: Number(c.radiation_rate_msv_sol),
        radiationTotalMsv: Number(c.radiation_total_msv),
        tormenta: Boolean(c.tormenta),
        enRefugio: Boolean(c.en_refugio),
        source: c.source ?? 'cabin_sensors',
        note: c.note ?? null,
        meta: c.meta ?? {},
      }));
    } else {
      cabinTelemetry = iaRows.filter((r) => r.kind === 'cabina_sol' && r.output).map((r) => r.output);
    }

    // Tareas de jornada (tabla dedicada o respaldo en `resultados_ia`).
    let tasks = [];
    const tarRes = await supabase.from('tareas_jornada').select('*');
    if (!tarRes.error && Array.isArray(tarRes.data)) {
      tasks = tarRes.data.map((t) => ({
        id: t.id,
        astronautId: t.astronaut_id,
        kind: t.kind,
        title: t.title,
        missionTime: t.mission_time,
        dayType: t.day_type,
        recurrence: t.recurrence,
        done: Boolean(t.done),
        ...(t.sol != null ? { sol: Number(t.sol) } : {}),
      }));
    } else {
      tasks = iaRows.filter((r) => r.kind === 'tarea_jornada' && r.output).map((r) => r.output);
    }

    // Notificaciones de misión (tabla dedicada o respaldo en `resultados_ia`).
    let notifications = [];
    const notRes = await supabase.from('notificaciones_mision').select('*').order('ts', { ascending: false }).limit(100);
    if (!notRes.error && Array.isArray(notRes.data)) {
      notifications = notRes.data.map((n) => ({
        id: n.id,
        astronautId: n.astronaut_id,
        sol: n.sol,
        tipo: n.tipo,
        color: n.nivel,
        nivel: n.nivel,
        titulo: typeof n.titulo === 'string' ? n.titulo.replace(/\bAna Ríos\b/g, 'Nicolás Méndez') : n.titulo,
        mensaje: typeof n.mensaje === 'string' ? n.mensaje.replace(/\bAna Ríos\b/g, 'Nicolás Méndez') : n.mensaje,
        leida: Boolean(n.leida),
        ruta: n.ruta,
        meta: n.meta ?? {},
        ts: n.ts,
      }));
    } else {
      notifications = iaRows.filter((r) => r.kind === 'notificacion_mision' && r.output).map((r) => r.output);
    }

    const aiResults = iaRows
      .filter((r) => !['estado_mision', 'cabina_sol', 'tarea_jornada', 'notificacion_mision'].includes(r.kind))
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        astronautId: r.astronaut_id,
        sol: r.sol,
        input: r.input ?? {},
        output: r.output ?? {},
        ts: r.ts,
      }));

    const TITULOS_POR_DEFECTO = {
      ana: 'Mission Commander',
      marcos: 'Crew Medical Officer (CMO)',
    };

    const astronauts = (tripRes.data ?? []).map((t) => ({
      id: t.id,
      name: t.id === 'ana' && t.name === 'Ana Ríos' ? 'Nicolás Méndez' : t.name,
      role: t.role,
      titulo: t.titulo || TITULOS_POR_DEFECTO[t.id] || (t.role === 'cmo' ? 'Crew Medical Officer (CMO)' : 'Mission Crewmember'),
      baseline: t.baseline ?? {},
      updatedAt: t.updated_at,
    }));

    return {
      astronauts,
      readings: medRes.datos.map(mapearFilaALecturaLocal),
      symptoms: (sinRes.data ?? []).map(mapearFilaASintomaLocal),
      aiResults,
      transmisiones: Array.isArray(txRes.data) ? txRes.data.map(normalizarTransmisionRemota) : [],
      missionState,
      cabinTelemetry,
      tasks,
      notifications,
    };
  } catch {
    return null;
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
      astronaut_name: base.astronauta ?? 'Nicolás Méndez',
      sol: Number.isInteger(base.sol) ? base.sol : 42,
      nivel: base.nivel ?? 'orange',
      estado,
      titulo: base.titulo ?? 'Flight Surgeon Report',
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

function normalizarTransmisionRemota(fila) {
  if (!fila || typeof fila !== 'object') return fila;
  const esSeedEspanol =
    fila.id === ID_TRANSMISION_SOL42 &&
    (/^Tripulante Ana Ríos, Sol 42/i.test(String(fila.resumen_tecnico ?? '')) ||
      fila.titulo === 'Informe para médicos de vuelo · Sol 42');
  return {
    ...fila,
    astronaut_name: fila.astronaut_name === 'Ana Ríos' ? 'Nicolás Méndez' : fila.astronaut_name,
    ...(esSeedEspanol
      ? {
          titulo: INFORME_TECNICO_RESPALDO_SOL42.titulo,
          resumen_tecnico: INFORME_TECNICO_RESPALDO_SOL42.resumen,
          hallazgos: INFORME_TECNICO_RESPALDO_SOL42.hallazgos,
          plan_sugerido: INFORME_TECNICO_RESPALDO_SOL42.plan,
        }
      : {}),
    ...(fila.respuesta_medica ? { respuesta_medica: normalizarRespuestaMedica(fila.respuesta_medica) } : {}),
    ...(fila.traduccion_vega ? { traduccion_vega: normalizarTraduccionVega(fila.traduccion_vega) } : {}),
  };
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
    return { ok: true, modo: 'supabase', datos: data.map(normalizarTransmisionRemota) };
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
    return normalizarTransmisionRemota(data || fila);
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
    if (!error && data) return normalizarTransmisionRemota(data);

    const { data: lista } = await supabase
      .from('transmisiones_enlace')
      .select('*')
      .order('actualizado_en', { ascending: false })
      .limit(1);
    return lista?.[0] ? normalizarTransmisionRemota(lista[0]) : null;
  } catch {
    return null;
  }
}

export async function guardarRespuestaHoustonRemota(idTransmision, respuestaMedica, traduccionVega) {
  const supabase = obtenerSupabaseCliente();
  if (!supabase) return { ok: false, error: 'Supabase is not configured on the client.' };
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
    return { ok: false, error: err?.message ?? 'Error saving to Supabase' };
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
