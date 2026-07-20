-- Módulo 1.1 — Contas e Onboarding
-- Rode no Supabase: SQL Editor → New query → colar → Run.
-- Cria: jogadores, clubes, quadras, quadra_precos + bucket de fotos. RLS em tudo.

-- ============================================================
-- JOGADORES: perfil 1-para-1 com o login (auth.users)
-- ============================================================
create table if not exists public.jogadores (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  foto_url text,
  cidade text not null,
  telefone text not null,
  -- Categoria brasileira: 1 (elite) a 7 (iniciante), com nível interno
  categoria smallint not null check (categoria between 1 and 7),
  nivel_categoria text not null default 'medio'
    check (nivel_categoria in ('forte', 'medio', 'fraco')),
  posicao text check (posicao in ('esquerda', 'direita', 'ambas')),
  -- Disponibilidade: lista de dia/turnos, ex.:
  -- [{"dia":"seg","turnos":["manha","noite"]}, {"dia":"sab","turnos":["tarde"]}]
  disponibilidade jsonb not null default '[]'::jsonb,
  raio_km smallint not null default 10 check (raio_km between 1 and 100),
  -- Calibração: todo jogador nasce "em calibração" (selo some após
  -- validação por pares + 5 partidas — módulos futuros)
  em_calibracao boolean not null default true,
  calibracao_respostas jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.jogadores enable row level security;

-- Qualquer usuário LOGADO pode ver perfis (necessário para matchmaking);
-- visitantes anônimos não veem nada.
create policy "jogadores_leitura_autenticada"
  on public.jogadores for select
  to authenticated
  using (true);

-- Cada um cria/edita apenas o próprio perfil.
create policy "jogadores_insere_proprio"
  on public.jogadores for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "jogadores_atualiza_proprio"
  on public.jogadores for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ============================================================
-- CLUBES
-- ============================================================
create table if not exists public.clubes (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  cidade text not null,
  endereco text,
  telefone text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.clubes enable row level security;

create policy "clubes_leitura_autenticada"
  on public.clubes for select
  to authenticated
  using (true);

create policy "clubes_insere_dono"
  on public.clubes for insert
  to authenticated
  with check ((select auth.uid()) = dono_id);

create policy "clubes_atualiza_dono"
  on public.clubes for update
  to authenticated
  using ((select auth.uid()) = dono_id)
  with check ((select auth.uid()) = dono_id);

create policy "clubes_apaga_dono"
  on public.clubes for delete
  to authenticated
  using ((select auth.uid()) = dono_id);

-- ============================================================
-- QUADRAS: multiesporte desde o dia 1 (regra de negócio nº 2)
-- ============================================================
create table if not exists public.quadras (
  id uuid primary key default gen_random_uuid(),
  clube_id uuid not null references public.clubes (id) on delete cascade,
  nome text not null,
  esporte text not null
    check (esporte in ('padel', 'beach_tennis', 'tenis', 'futebol_society')),
  tipo text not null
    check (tipo in ('vidro', 'alvenaria', 'areia', 'saibro', 'grama')),
  coberta boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table public.quadras enable row level security;

create policy "quadras_leitura_autenticada"
  on public.quadras for select
  to authenticated
  using (true);

-- Só o dono do clube gerencia as quadras dele.
create policy "quadras_gerencia_dono"
  on public.quadras for all
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
-- PREÇOS POR FAIXA HORÁRIA
-- ============================================================
create table if not exists public.quadra_precos (
  id uuid primary key default gen_random_uuid(),
  quadra_id uuid not null references public.quadras (id) on delete cascade,
  -- Dias da semana da faixa: 0=domingo ... 6=sábado
  dias smallint[] not null,
  hora_inicio time not null,
  hora_fim time not null,
  -- Preço em centavos (evita erro de arredondamento com dinheiro)
  preco_centavos integer not null check (preco_centavos >= 0),
  constraint faixa_valida check (hora_fim > hora_inicio)
);

alter table public.quadra_precos enable row level security;

create policy "precos_leitura_autenticada"
  on public.quadra_precos for select
  to authenticated
  using (true);

create policy "precos_gerencia_dono"
  on public.quadra_precos for all
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

-- ============================================================
-- FOTOS DE PERFIL (Supabase Storage)
-- Bucket público para leitura (foto de perfil aparece no app);
-- cada usuário só grava na própria pasta (auth.uid()/arquivo.jpg).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

create policy "fotos_upload_propria_pasta"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "fotos_atualiza_propria_pasta"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "fotos_apaga_propria_pasta"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
