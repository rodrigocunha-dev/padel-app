-- Sprint 2 — Descoberta e Mapa + Painel do Clube v0
-- Rode no Supabase: SQL Editor → New query → colar → Run.
-- Cria: coordenadas no clube, fotos do clube, avaliações e reservas
-- com trava anti-overbooking no banco (regra de negócio nº 8).

-- ============================================================
-- CLUBES: localização para o mapa
-- ============================================================
alter table public.clubes
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- ============================================================
-- FOTOS DO CLUBE
-- ============================================================
create table if not exists public.clube_fotos (
  id uuid primary key default gen_random_uuid(),
  clube_id uuid not null references public.clubes (id) on delete cascade,
  url text not null,
  criado_em timestamptz not null default now()
);

alter table public.clube_fotos enable row level security;

create policy "clube_fotos_leitura_autenticada"
  on public.clube_fotos for select
  to authenticated
  using (true);

create policy "clube_fotos_gerencia_dono"
  on public.clube_fotos for all
  to authenticated
  using (exists (
    select 1 from public.clubes c
    where c.id = clube_id and c.dono_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.clubes c
    where c.id = clube_id and c.dono_id = (select auth.uid())
  ));

-- ============================================================
-- AVALIAÇÕES: nota 1–5 + comentário, uma por jogador por clube
-- ============================================================
create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  clube_id uuid not null references public.clubes (id) on delete cascade,
  jogador_id uuid not null references public.jogadores (id) on delete cascade,
  nota smallint not null check (nota between 1 and 5),
  comentario text,
  criado_em timestamptz not null default now(),
  unique (clube_id, jogador_id)
);

alter table public.avaliacoes enable row level security;

create policy "avaliacoes_leitura_autenticada"
  on public.avaliacoes for select
  to authenticated
  using (true);

-- Cada jogador cria/edita/apaga só a própria avaliação.
create policy "avaliacoes_gerencia_propria"
  on public.avaliacoes for all
  to authenticated
  using ((select auth.uid()) = jogador_id)
  with check ((select auth.uid()) = jogador_id);

-- ============================================================
-- RESERVAS com trava anti-overbooking NO BANCO
-- A extensão btree_gist permite a "exclusion constraint": o próprio
-- PostgreSQL recusa duas reservas confirmadas da mesma quadra com
-- horários que se cruzam — mesmo se duas pessoas clicarem juntas.
-- ============================================================
create extension if not exists btree_gist;

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  quadra_id uuid not null references public.quadras (id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  origem text not null default 'balcao' check (origem in ('balcao', 'app')),
  -- Reserva de balcão: dados do cliente anotados pelo clube
  cliente_nome text,
  cliente_telefone text,
  -- Reserva pelo app (módulos futuros): jogador dono da reserva
  jogador_id uuid references auth.users (id) on delete set null,
  status text not null default 'confirmada'
    check (status in ('confirmada', 'cancelada')),
  criado_por uuid not null references auth.users (id),
  criado_em timestamptz not null default now(),
  constraint reserva_valida check (fim > inicio),
  constraint sem_overbooking exclude using gist (
    quadra_id with =,
    tstzrange(inicio, fim) with &&
  ) where (status = 'confirmada')
);

alter table public.reservas enable row level security;

-- Dono do clube gerencia as reservas das próprias quadras.
create policy "reservas_gerencia_dono"
  on public.reservas for all
  to authenticated
  using (exists (
    select 1 from public.quadras q
    join public.clubes c on c.id = q.clube_id
    where q.id = quadra_id and c.dono_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.quadras q
    join public.clubes c on c.id = q.clube_id
    where q.id = quadra_id and c.dono_id = (select auth.uid())
  ));

-- Jogador vê as próprias reservas (feitas pelo app, no futuro).
create policy "reservas_jogador_ve_proprias"
  on public.reservas for select
  to authenticated
  using ((select auth.uid()) = jogador_id);

-- ============================================================
-- LGPD: jogadores NÃO podem ler as reservas dos outros (nome e
-- telefone de clientes são dados pessoais). Para o mapa saber o que
-- está ocupado, esta função devolve SÓ quadra e horários — nada de
-- dados pessoais — e roda com permissão elevada (security definer).
-- ============================================================
create or replace function public.horarios_ocupados(
  p_quadras uuid[],
  p_de timestamptz,
  p_ate timestamptz
)
returns table (quadra_id uuid, inicio timestamptz, fim timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select r.quadra_id, r.inicio, r.fim
  from public.reservas r
  where r.quadra_id = any (p_quadras)
    and r.status = 'confirmada'
    and r.inicio < p_ate
    and r.fim > p_de;
$$;

revoke all on function public.horarios_ocupados from public, anon;
grant execute on function public.horarios_ocupados to authenticated;
