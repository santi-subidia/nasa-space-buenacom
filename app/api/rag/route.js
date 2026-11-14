// POST /api/rag — Búsqueda semántica en protocolos NASA (pgvector en Supabase con respaldo local).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generarEmbedding384, formatearVectorPg, similitudCoseno } from '@/lib/rag/embeddings';

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

let cacheLocal = null;

function obtenerDocumentosLocales() {
  if (cacheLocal) return cacheLocal;
  try {
    const indice = JSON.parse(readFileSync(join(process.cwd(), 'ai', 'fichas', 'indice.generado.json'), 'utf8'));
    cacheLocal = Object.entries(indice.riesgos ?? {}).map(([riesgoId, meta]) => {
      // Acepta la ruta actual (doc/nasa/riesgos/) y la anterior a la reorganización (doc/02-riesgos/).
      const subruta = String(meta.ficha ?? '').replace(/^doc\/(nasa\/riesgos|02-riesgos)\//, '').split('/');
      const contenido = readFileSync(join(process.cwd(), 'doc', 'nasa', 'riesgos', ...subruta), 'utf8').replace(/\r\n/g, '\n');
      const titulo = meta.titulo.replace(/\*+/g, '').trim();
      const lineas = contenido
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('|'));
      const resumen = lineas.slice(0, 3).join(' ').replace(/\*\*/g, '');
      const textoIndexado = `${titulo} ${meta.grupo} ${riesgoId.replace(/-/g, ' ')} ${meta.peligros} ${contenido}`;
      return {
        id: `ficha-${riesgoId}`,
        riesgo_id: riesgoId,
        titulo,
        categoria: meta.grupo,
        resumen: resumen.length > 320 ? `${resumen.slice(0, 317)}…` : resumen,
        contenido,
        fuentes: (meta.fuentes ?? []).map((f) => ({ titulo: f.titulo, url: f.url, tipo: f.tipo })),
        embedding: generarEmbedding384(textoIndexado),
      };
    });
    return cacheLocal;
  } catch {
    return [];
  }
}

export async function POST(request) {
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }

  const consulta = String(cuerpo?.consulta ?? '').trim();
  const limite = Math.max(1, Math.min(8, Number(cuerpo?.limite ?? 4)));
  if (!consulta) {
    return json({ ok: false, error: 'Escribí una consulta clínica para buscar.' }, 400);
  }

  const vector = generarEmbedding384(consulta);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    try {
      const supabase = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await supabase.rpc('buscar_documentos_clinicos', {
        query_embedding: formatearVectorPg(vector),
        match_count: limite,
      });
      if (!error && Array.isArray(data) && data.length > 0) {
        return json({ ok: true, fuente: 'pgvector', resultados: data });
      }
    } catch {
      /* continúa con respaldo local */
    }
  }

  const docs = obtenerDocumentosLocales()
    .map(({ embedding, ...doc }) => ({
      ...doc,
      similitud: similitudCoseno(vector, embedding),
    }))
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, limite);

  return json({ ok: true, fuente: 'local', resultados: docs });
}
