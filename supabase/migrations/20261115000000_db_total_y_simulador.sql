-- Ampliación de esquema AstroVitals para persistencia total en DB y simulador de soles futuros.
-- Cumple con RLS de Supabase y mantiene compatibilidad hacia atrás con datos existentes.

-- ─── Extensiones de columnas en tablas existentes ──────────────────────────
alter table public.tripulantes
  add column if not exists titulo text;

alter table public.mediciones
  add column if not exists sol integer,
  add column if not exists note text,
  add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists idx_mediciones_astronaut_sol_ts
  on public.mediciones (astronaut_id, sol desc, ts desc);

alter table public.sintomas
  add column if not exists sol integer;

create index if not exists idx_sintomas_astronaut_sol_ts
  on public.sintomas (astronaut_id, sol desc, ts desc);

-- ─── Estado de misión compartido (reloj marciano, sol actual, escenario) ───
create table if not exists public.estado_mision (
  id text primary key,
  mission_name text not null default 'Ares IV · Base Marte',
  entorno text not null default 'mars_base',
  sol_actual integer not null default 42,
  total_soles integer not null default 60,
  minutos_sol integer not null default 390,
  dia_semana text not null default 'jueves',
  pausado boolean not null default true,
  acelerado boolean not null default true,
  simulacion_activa jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─── Telemetría de cabina y dosímetro ambiental por sol ────────────────────
create table if not exists public.telemetria_cabina (
  id text primary key,
  sol integer not null,
  ts timestamptz not null default now(),
  co2_mmhg numeric not null,
  o2_pct numeric not null,
  pressure_kpa numeric not null,
  noise_dba numeric not null,
  noise_rest_db numeric not null default 42,
  radiation_rate_msv_sol numeric not null,
  radiation_total_msv numeric not null,
  tormenta boolean not null default false,
  en_refugio boolean not null default false,
  source text not null default 'cabin_sensors',
  note text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_telemetria_cabina_sol_ts
  on public.telemetria_cabina (sol desc, ts desc);

-- ─── Tareas de jornada y recordatorios ─────────────────────────────────────
create table if not exists public.tareas_jornada (
  id text primary key,
  astronaut_id text not null references public.tripulantes(id) on delete cascade,
  kind text not null default 'routine',
  title text not null,
  mission_time text not null,
  day_type text,
  recurrence text not null default 'daily',
  done boolean not null default false,
  sol integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tareas_jornada_astronaut_sol
  on public.tareas_jornada (astronaut_id, sol desc, mission_time asc);

-- ─── Notificaciones de misión ──────────────────────────────────────────────
create table if not exists public.notificaciones_mision (
  id text primary key,
  astronaut_id text,
  sol integer,
  tipo text not null,
  nivel text,
  titulo text not null,
  mensaje text not null,
  leida boolean not null default false,
  ruta text,
  meta jsonb not null default '{}'::jsonb,
  ts timestamptz not null default now()
);

create index if not exists idx_notificaciones_mision_astronaut_ts
  on public.notificaciones_mision (astronaut_id, ts desc);

-- ─── Row Level Security (demo pública anon + authenticated) ─────────────────
alter table public.estado_mision enable row level security;
alter table public.telemetria_cabina enable row level security;
alter table public.tareas_jornada enable row level security;
alter table public.notificaciones_mision enable row level security;

drop policy if exists "estado_mision_lectura_demo" on public.estado_mision;
create policy "estado_mision_lectura_demo" on public.estado_mision
  for select to anon, authenticated using (true);
drop policy if exists "estado_mision_escritura_demo" on public.estado_mision;
create policy "estado_mision_escritura_demo" on public.estado_mision
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "telemetria_cabina_lectura_demo" on public.telemetria_cabina;
create policy "telemetria_cabina_lectura_demo" on public.telemetria_cabina
  for select to anon, authenticated using (true);
drop policy if exists "telemetria_cabina_escritura_demo" on public.telemetria_cabina;
create policy "telemetria_cabina_escritura_demo" on public.telemetria_cabina
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "tareas_jornada_lectura_demo" on public.tareas_jornada;
create policy "tareas_jornada_lectura_demo" on public.tareas_jornada
  for select to anon, authenticated using (true);
drop policy if exists "tareas_jornada_escritura_demo" on public.tareas_jornada;
create policy "tareas_jornada_escritura_demo" on public.tareas_jornada
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "notificaciones_mision_lectura_demo" on public.notificaciones_mision;
create policy "notificaciones_mision_lectura_demo" on public.notificaciones_mision
  for select to anon, authenticated using (true);
drop policy if exists "notificaciones_mision_escritura_demo" on public.notificaciones_mision;
create policy "notificaciones_mision_escritura_demo" on public.notificaciones_mision
  for all to anon, authenticated using (true) with check (true);
