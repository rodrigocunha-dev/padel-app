-- Sprint 4 (parte A) — Partidas abertas + privacidade do telefone
-- Rode no Supabase: SQL Editor → New query → colar → Run.
-- (Pode rodar mais de uma vez sem estragar nada.)

-- ============================================================
-- 1) SEXO NO PERFIL DO JOGADOR
-- Necessário para filtrar partidas por sexo do jogo (masc/fem/mista).
-- Fica nulo nos perfis que já existem; o app pede para completar.
-- ============================================================
alter table public.jogadores
  add column if not exists sexo text
    check (sexo in ('masculino', 'feminino'));

-- ============================================================
-- 2) PRIVACIDADE: fechar o telefone do jogador
-- Hoje qualquer usuário logado consegue ler o telefone de TODOS os
-- jogadores. Isso é uma lista de contatos à solta. Passamos a permitir
-- a leitura de todas as colunas MENOS telefone. O telefone volta a ser
-- acessível só por um caminho controlado (função do organizador, no
-- script 009). O jogador segue gravando o próprio telefone no cadastro.
-- ============================================================
revoke select on public.jogadores from anon, authenticated;
grant select (
  id, nome, foto_url, cidade, categoria, nivel_categoria, posicao, sexo,
  disponibilidade, raio_km, em_calibracao, calibracao_respostas,
  criado_em, atualizado_em
) on public.jogadores to authenticated;

-- ============================================================
-- 3) PARTIDAS
-- Cada partida nasce a partir de uma reserva (a quadra é confirmada na
-- hora — reserva na confiança; o pagamento é um caderninho por cima,
-- no script 009, e NÃO trava a quadra).
-- ============================================================
create table if not exists public.partidas (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas (id) on delete cascade,
  organizador_id uuid not null references auth.users (id) on delete cascade,
  -- Faixa de categoria aceita (número: 1=elite … 7=iniciante)
  categoria_min smallint not null check (categoria_min between 1 and 7),
  categoria_max smallint not null check (categoria_max between 1 and 7),
  competitiva boolean not null,
  sexo_jogo text not null check (sexo_jogo in ('masculino', 'feminino', 'mista')),
  max_jogadores smallint not null check (max_jogadores between 4 and 8),
  status text not null default 'aberta'
    check (status in ('aberta', 'completa', 'confirmada', 'cancelada')),
  criado_em timestamptz not null default now(),
  constraint faixa_categoria_valida check (categoria_max >= categoria_min)
);

alter table public.partidas enable row level security;

drop policy if exists "partidas_leitura_autenticada" on public.partidas;
create policy "partidas_leitura_autenticada"
  on public.partidas for select to authenticated using (true);
-- Escrita só pelas funções abaixo (security definer).

-- ============================================================
-- PARTIDA_JOGADORES: quem está na partida + fila de substitutos
-- papel: 'jogador' (conta para as vagas) ou 'substituto' (fila)
-- ============================================================
create table if not exists public.partida_jogadores (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.partidas (id) on delete cascade,
  jogador_id uuid not null references auth.users (id) on delete cascade,
  papel text not null default 'jogador' check (papel in ('jogador', 'substituto')),
  ordem integer not null,  -- ordem de entrada; define a fila de substitutos
  entrou_em timestamptz not null default now(),
  unique (partida_id, jogador_id)
);

alter table public.partida_jogadores enable row level security;

drop policy if exists "partida_jogadores_leitura_autenticada" on public.partida_jogadores;
create policy "partida_jogadores_leitura_autenticada"
  on public.partida_jogadores for select to authenticated using (true);

-- ============================================================
-- Função auxiliar: o jogador cabe nesta partida?
-- (categoria dentro da faixa + sexo compatível com o sexo do jogo)
-- ============================================================
create or replace function public.jogador_compativel(
  p_partida public.partidas,
  p_jogador_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_categoria smallint;
  v_sexo text;
begin
  select categoria, sexo into v_categoria, v_sexo
  from public.jogadores where id = p_jogador_id;

  if v_categoria is null then
    return false;  -- sem perfil completo
  end if;

  if v_categoria < p_partida.categoria_min
     or v_categoria > p_partida.categoria_max then
    return false;
  end if;

  -- Jogo masculino/feminino exige o sexo correspondente; mista aceita todos.
  if p_partida.sexo_jogo <> 'mista' then
    if v_sexo is null or v_sexo <> p_partida.sexo_jogo then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- ============================================================
-- CRIAR PARTIDA
-- Cria a reserva (quadra confirmada na hora) e a partida, de uma vez.
-- O organizador entra como primeiro jogador.
-- Regra nº 5/6: partida competitiva só com 4 jogadores; 5+ é revezamento
-- (amistoso), que não conta para o rating.
-- ============================================================
create or replace function public.criar_partida(
  p_quadra_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_categoria_min smallint,
  p_categoria_max smallint,
  p_competitiva boolean,
  p_sexo_jogo text,
  p_max_jogadores smallint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := auth.uid();
  v_preco_hora integer;
  v_minutos numeric;
  v_reserva_id uuid;
  v_partida_id uuid;
  v_partida public.partidas;
begin
  if v_org is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  if p_competitiva and p_max_jogadores <> 4 then
    raise exception 'COMPETITIVA_SO_COM_4' using errcode = 'P0001';
  end if;

  if p_fim <= p_inicio then
    raise exception 'PERIODO_INVALIDO' using errcode = 'P0001';
  end if;
  if p_inicio < now() then
    raise exception 'HORARIO_PASSADO' using errcode = 'P0001';
  end if;

  -- Preço da quadra na faixa de funcionamento do dia (mesma regra da
  -- reserva avulsa). Sem faixa = clube fechado naquele horário.
  select qp.preco_centavos into v_preco_hora
  from public.quadra_precos qp
  where qp.quadra_id = p_quadra_id
    and extract(dow from (p_inicio at time zone 'America/Sao_Paulo'))::smallint = any (qp.dias)
    and qp.hora_inicio <= (p_inicio at time zone 'America/Sao_Paulo')::time
    and qp.hora_fim >= (p_fim at time zone 'America/Sao_Paulo')::time
  order by qp.preco_centavos
  limit 1;

  if v_preco_hora is null then
    raise exception 'FORA_DO_FUNCIONAMENTO' using errcode = 'P0001';
  end if;

  v_minutos := extract(epoch from (p_fim - p_inicio)) / 60;

  -- Reserva confirmada na hora (a trava anti-overbooking do banco decide
  -- se o horário ainda está livre).
  insert into public.reservas (
    quadra_id, inicio, fim, origem, jogador_id, status, criado_por, preco_centavos
  ) values (
    p_quadra_id, p_inicio, p_fim, 'app', v_org, 'confirmada', v_org,
    round(v_preco_hora * v_minutos / 60)
  ) returning id into v_reserva_id;

  insert into public.partidas (
    reserva_id, organizador_id, categoria_min, categoria_max,
    competitiva, sexo_jogo, max_jogadores
  ) values (
    v_reserva_id, v_org, p_categoria_min, p_categoria_max,
    p_competitiva, p_sexo_jogo, p_max_jogadores
  ) returning id into v_partida_id;

  select * into v_partida from public.partidas where id = v_partida_id;

  -- O organizador precisa caber na própria partida.
  if not public.jogador_compativel(v_partida, v_org) then
    raise exception 'ORGANIZADOR_INCOMPATIVEL' using errcode = 'P0001';
  end if;

  insert into public.partida_jogadores (partida_id, jogador_id, papel, ordem)
  values (v_partida_id, v_org, 'jogador', 1);

  return v_partida_id;
end;
$$;

revoke all on function public.criar_partida(uuid, timestamptz, timestamptz, smallint, smallint, boolean, text, smallint) from public, anon;
grant execute on function public.criar_partida(uuid, timestamptz, timestamptz, smallint, smallint, boolean, text, smallint) to authenticated;

-- ============================================================
-- ENTRAR NA PARTIDA
-- Se há vaga, entra como jogador; se está cheia, entra na fila de
-- substitutos. Tudo em uma transação (nada de duas pessoas na última
-- vaga).
-- ============================================================
create or replace function public.entrar_na_partida(p_partida_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jog uuid := auth.uid();
  v_partida public.partidas;
  v_qtd_jogadores integer;
  v_proxima_ordem integer;
  v_papel text;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  -- Trava a linha da partida para o resto rodar sem corrida.
  select * into v_partida from public.partidas
  where id = p_partida_id for update;

  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_partida.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.partida_jogadores
             where partida_id = p_partida_id and jogador_id = v_jog) then
    raise exception 'JA_ESTA_NA_PARTIDA' using errcode = 'P0001';
  end if;

  if not public.jogador_compativel(v_partida, v_jog) then
    raise exception 'INCOMPATIVEL' using errcode = 'P0001';
  end if;

  select count(*) into v_qtd_jogadores
  from public.partida_jogadores
  where partida_id = p_partida_id and papel = 'jogador';

  select coalesce(max(ordem), 0) + 1 into v_proxima_ordem
  from public.partida_jogadores where partida_id = p_partida_id;

  if v_qtd_jogadores < v_partida.max_jogadores then
    v_papel := 'jogador';
  else
    v_papel := 'substituto';
  end if;

  insert into public.partida_jogadores (partida_id, jogador_id, papel, ordem)
  values (p_partida_id, v_jog, v_papel, v_proxima_ordem);

  -- Encheu? Marca como completa.
  if v_papel = 'jogador' and v_qtd_jogadores + 1 = v_partida.max_jogadores then
    update public.partidas set status = 'completa' where id = p_partida_id;
  end if;

  return v_papel;
end;
$$;

revoke all on function public.entrar_na_partida(uuid) from public, anon;
grant execute on function public.entrar_na_partida(uuid) to authenticated;

-- ============================================================
-- SAIR DA PARTIDA
-- Jogador que sai abre vaga: o primeiro substituto da fila sobe sozinho.
-- O organizador não "sai" — ele cancela a partida (função abaixo).
-- ============================================================
create or replace function public.sair_da_partida(p_partida_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jog uuid := auth.uid();
  v_partida public.partidas;
  v_papel text;
  v_promovido uuid;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas
  where id = p_partida_id for update;

  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_jog = v_partida.organizador_id then
    raise exception 'ORGANIZADOR_NAO_SAI' using errcode = 'P0001';
  end if;

  select papel into v_papel from public.partida_jogadores
  where partida_id = p_partida_id and jogador_id = v_jog;

  if v_papel is null then
    raise exception 'NAO_ESTA_NA_PARTIDA' using errcode = 'P0001';
  end if;

  delete from public.partida_jogadores
  where partida_id = p_partida_id and jogador_id = v_jog;

  if v_papel = 'jogador' then
    -- Promove o primeiro da fila de substitutos, se houver.
    select jogador_id into v_promovido
    from public.partida_jogadores
    where partida_id = p_partida_id and papel = 'substituto'
    order by ordem
    limit 1;

    if v_promovido is not null then
      update public.partida_jogadores set papel = 'jogador'
      where partida_id = p_partida_id and jogador_id = v_promovido;
    else
      -- Sem substituto: abriu vaga, a partida volta a ficar aberta.
      update public.partidas set status = 'aberta'
      where id = p_partida_id and status = 'completa';
    end if;
  end if;
end;
$$;

revoke all on function public.sair_da_partida(uuid) from public, anon;
grant execute on function public.sair_da_partida(uuid) to authenticated;

-- ============================================================
-- CANCELAR PARTIDA (organizador)
-- Cancela a partida e libera a quadra. Estornos dos pagamentos entram
-- no script 009.
-- ============================================================
create or replace function public.cancelar_partida(p_partida_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jog uuid := auth.uid();
  v_partida public.partidas;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_jog <> v_partida.organizador_id then
    raise exception 'SO_O_ORGANIZADOR_CANCELA' using errcode = 'P0001';
  end if;

  update public.partidas set status = 'cancelada' where id = p_partida_id;
  update public.reservas set status = 'cancelada' where id = v_partida.reserva_id;
end;
$$;

revoke all on function public.cancelar_partida(uuid) from public, anon;
grant execute on function public.cancelar_partida(uuid) to authenticated;

-- ============================================================
-- Tempo real das partidas
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.partidas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.partida_jogadores;
  exception when duplicate_object then null;
  end;
end $$;
