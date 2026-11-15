// Siembra Supabase PostgreSQL + pgvector + Supabase Auth con los datos iniciales de AstroVitals.
// Ejecutar con: node --env-file=.env.local scripts/sembrar-supabase.mjs

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { generarEmbedding384, formatearVectorPg } from '../lib/rag/embeddings.js';
import { panelCabina } from '../lib/cabina/simulador.js';
import {
  INFORME_TECNICO_RESPALDO_SOL42,
  RESPUESTA_MEDICA_SOL42,
  TRADUCCION_VEGA_SOL42,
} from '../lib/enlace/logicaEnlace.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function extraerResumenFicha(markdown) {
  const lineas = markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('|'));
  const texto = lineas.slice(0, 4).join(' ').replace(/\*\*/g, '');
  return texto.length > 340 ? `${texto.slice(0, 337)}…` : texto;
}

function esErrorEsquema(error) {
  const code = String(error?.code ?? '');
  const msg = String(error?.message ?? '');
  return (
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '42703' ||
    code === '42P01' ||
    /column .* does not exist|could not find .* column|could not find the table|relation .* does not exist/i.test(msg)
  );
}

async function sembrarTripulantesYDatos() {
  const demo = JSON.parse(readFileSync(join(RAIZ, 'lib', 'demo', 'demo-data.json'), 'utf8'));

  const tripulantesCompletos = demo.astronauts.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    titulo: a.titulo ?? null,
    baseline: a.baseline ?? {},
    updated_at: new Date().toISOString(),
  }));

  const { error: errTrip } = await supabase.from('tripulantes').upsert(tripulantesCompletos, { onConflict: 'id' });
  if (errTrip) {
    if (!esErrorEsquema(errTrip)) throw errTrip;
    const basico = tripulantesCompletos.map(({ titulo: _t, ...r }) => r);
    const { error: errBase } = await supabase.from('tripulantes').upsert(basico, { onConflict: 'id' });
    if (errBase) throw errBase;
  }

  // Sembrar los 60 soles completos en lotes de 300.
  const medicionesCompletas = demo.readings.map((r) => ({
    id: r.id,
    astronaut_id: r.astronautId,
    indicator: r.indicator,
    value: r.value,
    unit: r.unit,
    ts: r.ts,
    source: r.source ?? 'manual',
    sol: r.sol ?? null,
    note: r.note ?? null,
    meta: r.meta ?? {},
  }));

  for (let i = 0; i < medicionesCompletas.length; i += 300) {
    const lote = medicionesCompletas.slice(i, i + 300);
    const { error: errMed } = await supabase.from('mediciones').upsert(lote, { onConflict: 'id' });
    if (errMed) {
      if (!esErrorEsquema(errMed)) throw errMed;
      const baseLote = lote.map(({ sol: _s, note: _n, meta: _m, ...resto }) => resto);
      const { error: errMedBase } = await supabase.from('mediciones').upsert(baseLote, { onConflict: 'id' });
      if (errMedBase) throw errMedBase;
    }
  }

  const sintomas = (demo.symptoms ?? []).map((s) => ({
    id: s.id,
    astronaut_id: s.astronautId,
    body_zone: s.bodyZone,
    code: s.code,
    severity: s.severity ?? 1,
    notes: s.notes ?? null,
    sol: s.sol ?? null,
    ts: s.ts,
  }));

  if (sintomas.length > 0) {
    const { error: errSint } = await supabase.from('sintomas').upsert(sintomas, { onConflict: 'id' });
    if (errSint) {
      if (!esErrorEsquema(errSint)) throw errSint;
      const sinBase = sintomas.map(({ sol: _s, ...r }) => r);
      const { error: errSintBase } = await supabase.from('sintomas').upsert(sinBase, { onConflict: 'id' });
      if (errSintBase) throw errSintBase;
    }
  }

  // Sembrar estado de misión y telemetría de cabina (tablas dedicadas o respaldo en resultados_ia).
  const estado = {
    id: 'ares-iv',
    missionName: demo.mission.nombre,
    entorno: demo.mission.env,
    solActual: demo.mission.solActual,
    totalSoles: demo.mission.totalSoles,
    minutos: 390,
    diaSemana: 'jueves',
    pausado: true,
    acelerado: true,
    updatedAt: new Date().toISOString(),
  };

  const { error: errEst } = await supabase.from('estado_mision').upsert({
    id: estado.id,
    mission_name: estado.missionName,
    entorno: estado.entorno,
    sol_actual: estado.solActual,
    total_soles: estado.totalSoles,
    minutos_sol: estado.minutos,
    dia_semana: estado.diaSemana,
    pausado: estado.pausado,
    acelerado: estado.acelerado,
    updated_at: estado.updatedAt,
  }, { onConflict: 'id' });

  if (errEst && esErrorEsquema(errEst)) {
    await supabase.from('resultados_ia').upsert({
      id: 'estado-mision-ares-iv',
      kind: 'estado_mision',
      sol: estado.solActual,
      input: { id: 'ares-iv' },
      output: estado,
      ts: estado.updatedAt,
    }, { onConflict: 'id' });
  }

  const cabFilas = Array.from({ length: demo.mission.totalSoles }, (_, i) => {
    const sol = i + 1;
    const p = panelCabina({ sol, astronautId: 'ana' });
    const ts = new Date(Date.parse('2026-09-01T12:00:00.000Z') + (sol - 1) * 86_400_000).toISOString();
    return {
      id: `cabina-sol-${sol}`,
      sol,
      ts,
      co2Mmhg: p.atmosfera.find((a) => a.id === 'co2')?.valor ?? 2.1,
      o2Pct: p.atmosfera.find((a) => a.id === 'o2')?.valor ?? 20.9,
      pressureKpa: p.atmosfera.find((a) => a.id === 'presion')?.valor ?? 101.2,
      noiseDba: p.atmosfera.find((a) => a.id === 'ruido')?.valor ?? 53,
      noiseRestDb: 42,
      radiationRateMsvSol: p.dosis.tasaMSvDia,
      radiationTotalMsv: p.dosis.total,
      tormenta: false,
      enRefugio: false,
      source: 'cabin_sensors',
      note: `Telemetría Base Marte · Sol ${sol}`,
    };
  });

  const { error: errCab } = await supabase.from('telemetria_cabina').upsert(
    cabFilas.map((r) => ({
      id: r.id,
      sol: r.sol,
      ts: r.ts,
      co2_mmhg: r.co2Mmhg,
      o2_pct: r.o2Pct,
      pressure_kpa: r.pressureKpa,
      noise_dba: r.noiseDba,
      noise_rest_db: r.noiseRestDb,
      radiation_rate_msv_sol: r.radiationRateMsvSol,
      radiation_total_msv: r.radiationTotalMsv,
      tormenta: r.tormenta,
      en_refugio: r.enRefugio,
      source: r.source,
      note: r.note,
    })),
    { onConflict: 'id' },
  );
  if (errCab && esErrorEsquema(errCab)) {
    const cabIa = cabFilas.map((r) => ({
      id: `cabina-${r.id}`,
      kind: 'cabina_sol',
      sol: r.sol,
      input: { sol: r.sol },
      output: r,
      ts: r.ts,
    }));
    await supabase.from('resultados_ia').upsert(cabIa, { onConflict: 'id' });
  }

  return { tripulantes: tripulantesCompletos.length, mediciones: medicionesCompletas.length, sintomas: sintomas.length, cabina: cabFilas.length };
}

async function sembrarTransmisionInicial() {
  const registro = {
    id: 'enlace-sol42-ana',
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
  };

  const { error } = await supabase.from('transmisiones_enlace').upsert([registro], { onConflict: 'id' });
  if (error) throw error;
  return 1;
}

async function sembrarDocumentosRag() {
  const indice = JSON.parse(readFileSync(join(RAIZ, 'ai', 'fichas', 'indice.generado.json'), 'utf8'));
  const filas = [];

  for (const [riesgoId, meta] of Object.entries(indice.riesgos ?? {})) {
    const contenido = readFileSync(join(RAIZ, meta.ficha), 'utf8').replace(/\r\n/g, '\n');
    const tituloLimpio = meta.titulo.replace(/\*+/g, '').trim();
    const resumen = extraerResumenFicha(contenido);
    const fuentesTexto = (meta.fuentes ?? []).map((f) => `${f.titulo} ${f.tipo}`).join(' ');
    const textoIndexado = `${tituloLimpio} ${meta.grupo} ${riesgoId.replace(/-/g, ' ')} ${meta.peligros} ${fuentesTexto} ${contenido}`;
    const embedding = formatearVectorPg(generarEmbedding384(textoIndexado));

    filas.push({
      id: `ficha-${riesgoId}`,
      riesgo_id: riesgoId,
      titulo: tituloLimpio,
      categoria: meta.grupo,
      resumen,
      contenido,
      fuentes: (meta.fuentes ?? []).map((f) => ({
        titulo: f.titulo,
        url: f.url,
        tipo: f.tipo,
      })),
      embedding,
      actualizado_en: new Date().toISOString(),
    });
  }

  const { error } = await supabase.from('documentos_clinicos').upsert(filas, { onConflict: 'id' });
  if (error) throw error;
  return filas.length;
}

async function sembrarUsuariosDemo() {
  const usuarios = [
    {
      email: 'ana@ares4.nasa.gov',
      password: 'ares4-marte',
      email_confirm: true,
      user_metadata: {
        nombre: 'Cmdt. Nicolás Méndez',
        rol: 'tripulante',
        astronautId: 'ana',
        titulo: 'Comandante · Base Marte (Ares IV)',
      },
    },
    {
      email: 'marcos@ares4.nasa.gov',
      password: 'ares4-marte',
      email_confirm: true,
      user_metadata: {
        nombre: 'Dr. Marcos Silva',
        rol: 'cmo',
        astronautId: 'marcos',
        titulo: 'Oficial Médico de a Bordo (CMO · Base Marte)',
      },
    },
    {
      email: 'elena.vance@houston.nasa.gov',
      password: 'houston-jsc',
      email_confirm: true,
      user_metadata: {
        nombre: 'Dra. Elena Vance',
        rol: 'houston',
        astronautId: null,
        titulo: 'Médica de Vuelo · Control de Misión (Houston JSC)',
      },
    },
  ];

  let creadosOExistentes = 0;
  for (const u of usuarios) {
    const { error } = await supabase.auth.admin.createUser(u);
    if (error && !/already been registered|already exists/i.test(error.message)) {
      throw error;
    }
    creadosOExistentes += 1;
  }
  return creadosOExistentes;
}

async function main() {
  console.log('Sembrando Supabase (astrovitals)...');
  const datos = await sembrarTripulantesYDatos();
  const transmisiones = await sembrarTransmisionInicial();
  const docsRag = await sembrarDocumentosRag();
  const usuarios = await sembrarUsuariosDemo();

  console.log(JSON.stringify({
    ok: true,
    ...datos,
    transmisiones,
    docsRag,
    usuariosDemo: usuarios,
  }, null, 2));
}

main().catch((err) => {
  console.error('Error sembrando Supabase:', err);
  process.exit(1);
});
