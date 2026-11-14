-- Esquema AstroVitals en PostgreSQL + pgvector + RLS (Supabase)

create extension if not exists vector with schema extensions;

-- ─── Tripulantes ───────────────────────────────────────────────────────────
create table if not exists public.tripulantes (
  id text primary key,
  name text not null,
  role text not null,
  baseline jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─── Mediciones clínicas (sincronizadas desde IndexedDB) ───────────────────
create table if not exists public.mediciones (
  id text primary key,
  astronaut_id text not null references public.tripulantes(id) on delete cascade,
  indicator text not null,
  value numeric not null,
  unit text not null,
  ts timestamptz not null default now(),
  source text not null default 'manual'
);

create index if not exists idx_mediciones_astronaut_ts
  on public.mediciones (astronaut_id, ts desc);

create index if not exists idx_mediciones_indicator_ts
  on public.mediciones (astronaut_id, indicator, ts desc);

-- ─── Síntomas reportados ───────────────────────────────────────────────────
create table if not exists public.sintomas (
  id text primary key,
  astronaut_id text not null references public.tripulantes(id) on delete cascade,
  body_zone text not null,
  code text not null,
  severity smallint not null default 1,
  notes text,
  ts timestamptz not null default now()
);

create index if not exists idx_sintomas_astronaut_ts
  on public.sintomas (astronaut_id, ts desc);

-- ─── Resultados de Junta médica / Cara / Vega / Chequeo ────────────────────
create table if not exists public.resultados_ia (
  id text primary key,
  kind text not null,
  astronaut_id text,
  sol integer,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  ts timestamptz not null default now()
);

create index if not exists idx_resultados_ia_kind_ts
  on public.resultados_ia (kind, ts desc);

-- ─── Transmisiones Marte <-> Houston (Bandeja de la Médica de Vuelo) ───────
create table if not exists public.transmisiones_enlace (
  id text primary key,
  astronaut_id text not null,
  astronaut_name text not null,
  sol integer not null default 42,
  nivel text not null default 'orange',
  estado text not null default 'en_houston',
  titulo text not null,
  resumen_tecnico text not null,
  hallazgos jsonb not null default '[]'::jsonb,
  plan_sugerido jsonb not null default '[]'::jsonb,
  respuesta_medica jsonb,
  traduccion_vega jsonb,
  enviado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_transmisiones_enlace_enviado
  on public.transmisiones_enlace (actualizado_en desc, enviado_en desc);

-- ─── Base vectorial RAG de protocolos y fichas clínicas NASA (pgvector) ────
create table if not exists public.documentos_clinicos (
  id text primary key,
  riesgo_id text not null,
  titulo text not null,
  categoria text not null,
  resumen text not null,
  contenido text not null,
  fuentes jsonb not null default '[]'::jsonb,
  embedding extensions.vector(384) not null,
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_documentos_clinicos_embedding
  on public.documentos_clinicos
  using hnsw (embedding extensions.vector_cosine_ops);

-- Función RPC para búsqueda semántica vectorial en pgvector
create or replace function public.buscar_documentos_clinicos(
  query_embedding extensions.vector(384),
  match_count int default 4
)
returns table (
  id text,
  riesgo_id text,
  titulo text,
  categoria text,
  resumen text,
  contenido text,
  fuentes jsonb,
  similitud float
)
language sql
stable
set search_path = public, extensions
as $$
  select
    d.id,
    d.riesgo_id,
    d.titulo,
    d.categoria,
    d.resumen,
    d.contenido,
    d.fuentes,
    1 - (d.embedding <=> query_embedding) as similitud
  from public.documentos_clinicos d
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- ─── Seguridad RLS ─────────────────────────────────────────────────────────
alter table public.tripulantes enable row level security;
alter table public.mediciones enable row level security;
alter table public.sintomas enable row level security;
alter table public.resultados_ia enable row level security;
alter table public.transmisiones_enlace enable row level security;
alter table public.documentos_clinicos enable row level security;

drop policy if exists "Lectura tripulantes" on public.tripulantes;
create policy "Lectura tripulantes" on public.tripulantes
  for select to anon, authenticated using (true);
drop policy if exists "Escritura tripulantes" on public.tripulantes;
create policy "Escritura tripulantes" on public.tripulantes
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "Lectura mediciones" on public.mediciones;
create policy "Lectura mediciones" on public.mediciones
  for select to anon, authenticated using (true);
drop policy if exists "Escritura mediciones" on public.mediciones;
create policy "Escritura mediciones" on public.mediciones
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "Lectura sintomas" on public.sintomas;
create policy "Lectura sintomas" on public.sintomas
  for select to anon, authenticated using (true);
drop policy if exists "Escritura sintomas" on public.sintomas;
create policy "Escritura sintomas" on public.sintomas
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "Lectura resultados_ia" on public.resultados_ia;
create policy "Lectura resultados_ia" on public.resultados_ia
  for select to anon, authenticated using (true);
drop policy if exists "Escritura resultados_ia" on public.resultados_ia;
create policy "Escritura resultados_ia" on public.resultados_ia
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "Lectura transmisiones_enlace" on public.transmisiones_enlace;
create policy "Lectura transmisiones_enlace" on public.transmisiones_enlace
  for select to anon, authenticated using (true);
drop policy if exists "Escritura transmisiones_enlace" on public.transmisiones_enlace;
create policy "Escritura transmisiones_enlace" on public.transmisiones_enlace
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "Lectura documentos_clinicos" on public.documentos_clinicos;
create policy "Lectura documentos_clinicos" on public.documentos_clinicos
  for select to anon, authenticated using (true);
