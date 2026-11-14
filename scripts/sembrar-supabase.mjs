// Siembra Supabase PostgreSQL + pgvector + Supabase Auth con los datos iniciales de AstroVitals.
// Ejecutar con: node --env-file=.env.local scripts/sembrar-supabase.mjs

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { generarEmbedding384, formatearVectorPg } from '../lib/rag/embeddings.js';
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

async function sembrarTripulantesYDatos() {
  const demo = JSON.parse(readFileSync(join(RAIZ, 'lib', 'demo', 'demo-data.json'), 'utf8'));

  const tripulantes = demo.astronauts.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    baseline: a.baseline ?? {},
    updated_at: new Date().toISOString(),
  }));

  const { error: errTrip } = await supabase.from('tripulantes').upsert(tripulantes, { onConflict: 'id' });
  if (errTrip) throw errTrip;

  // Sembrar mediciones de los últimos 7 soles (Soles 36–42) para mantener agilidad en el esquema cloud
  const mediciones = demo.readings
    .filter((r) => (r.sol ?? 42) >= 36)
    .map((r) => ({
      id: r.id,
      astronaut_id: r.astronautId,
      indicator: r.indicator,
      value: r.value,
      unit: r.unit,
      ts: r.ts,
      source: r.source ?? 'manual',
    }));

  const { error: errMed } = await supabase.from('mediciones').upsert(mediciones, { onConflict: 'id' });
  if (errMed) throw errMed;

  const sintomas = (demo.symptoms ?? []).map((s) => ({
    id: s.id,
    astronaut_id: s.astronautId,
    body_zone: s.bodyZone,
    code: s.code,
    severity: s.severity ?? 1,
    notes: s.notes ?? null,
    ts: s.ts,
  }));

  if (sintomas.length > 0) {
    const { error: errSint } = await supabase.from('sintomas').upsert(sintomas, { onConflict: 'id' });
    if (errSint) throw errSint;
  }

  return { tripulantes: tripulantes.length, mediciones: mediciones.length, sintomas: sintomas.length };
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
        nombre: 'Cmdt. Ana Ríos',
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
