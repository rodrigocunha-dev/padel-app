-- Sprint 4 (parte B) — Pagamentos, split e bloqueio de inadimplente
-- Rode no Supabase: SQL Editor → New query → colar → Run.

-- ============================================================
-- PAGAMENTOS
-- Uma linha por (partida, jogador). Nasce quando o jogador inicia o
-- pagamento. status: pendente → pago (ou estornado). A "costura" com o
-- gateway aparece nas colunas provedor/cobranca_externa_id/qr_code.
-- ============================================================
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.partidas (id) on delete cascade,
  jogador_id uuid not null references auth.users (id) on delete cascade,
  valor_centavos integer not null check (valor_centavos >= 0),
  status text not null default 'pendente'
    check (status in ('pendente', 'pago', 'estornado')),
  provedor text not null default 'simulado',
  cobranca_externa_id text,
  qr_code text,
  copia_e_cola text,
  pago_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (partida_id, jogador_id)
);

alter table public.pagamentos enable row level security;

-- Quem está na partida (jogador ou organizador) vê os pagamentos dela —
-- é o "caderninho" de quem pagou e quem não. Ninguém vê pagamento de
-- partida que não é sua.
drop policy if exists "pagamentos_leitura_participantes" on public.pagamentos;
create policy "pagamentos_leitura_participantes"
  on public.pagamentos for select to authenticated
  using (
    exists (
      select 1 from public.partida_jogadores pj
      where pj.partida_id = pagamentos.partida_id
        and pj.jogador_id = (select auth.uid())
    )
    or exists (
      select 1 from public.partidas p
      where p.id = pagamentos.partida_id
        and p.organizador_id = (select auth.uid())
    )
  );

-- Cada jogador cria/edita só o próprio pagamento.
drop policy if exists "pagamentos_gerencia_proprio" on public.pagamentos;
create policy "pagamentos_gerencia_proprio"
  on public.pagamentos for all to authenticated
  using ((select auth.uid()) = jogador_id)
  with check ((select auth.uid()) = jogador_id);

-- ============================================================
-- INADIMPLENTE — bloqueio do calote (regra decidida com o fundador)
-- Um jogador é inadimplente se jogou uma partida que JÁ ACONTECEU e cujo
-- prazo de acerto (fim + 24h) passou, sem ter um pagamento 'pago'.
-- Partida futura nunca conta. 24h de folga depois do jogo.
-- ============================================================
create or replace function public.jogador_inadimplente(p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.partida_jogadores pj
    join public.partidas p on p.id = pj.partida_id
    where pj.jogador_id = p_uid
      and pj.papel = 'jogador'
      and p.status <> 'cancelada'
      and p.preco_centavos > 0
      and p.fim + interval '24 hours' < now()
      and not exists (
        select 1 from public.pagamentos pg
        where pg.partida_id = p.id
          and pg.jogador_id = p_uid
          and pg.status = 'pago'
      )
  );
$$;

-- ============================================================
-- Re-cria criar_partida e entrar_na_partida COM o bloqueio de
-- inadimplente na entrada. (Mesmas funções do 008/009 + a checagem.)
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
  v_preco integer;
  v_reserva_id uuid;
  v_partida_id uuid;
  v_partida public.partidas;
begin
  if v_org is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;
  if public.jogador_inadimplente(v_org) then
    raise exception 'PENDENCIA' using errcode = 'P0001';
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
  v_preco := round(v_preco_hora * v_minutos / 60);

  insert into public.reservas (
    quadra_id, inicio, fim, origem, jogador_id, status, criado_por, preco_centavos
  ) values (
    p_quadra_id, p_inicio, p_fim, 'app', v_org, 'confirmada', v_org, v_preco
  ) returning id into v_reserva_id;

  insert into public.partidas (
    reserva_id, organizador_id, categoria_min, categoria_max,
    competitiva, sexo_jogo, max_jogadores,
    quadra_id, inicio, fim, preco_centavos
  ) values (
    v_reserva_id, v_org, p_categoria_min, p_categoria_max,
    p_competitiva, p_sexo_jogo, p_max_jogadores,
    p_quadra_id, p_inicio, p_fim, v_preco
  ) returning id into v_partida_id;

  select * into v_partida from public.partidas where id = v_partida_id;
  if not public.jogador_compativel(v_partida, v_org) then
    raise exception 'ORGANIZADOR_INCOMPATIVEL' using errcode = 'P0001';
  end if;

  insert into public.partida_jogadores (partida_id, jogador_id, papel, ordem)
  values (v_partida_id, v_org, 'jogador', 1);

  return v_partida_id;
end;
$$;

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
  if public.jogador_inadimplente(v_jog) then
    raise exception 'PENDENCIA' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id for update;
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

  if v_papel = 'jogador' and v_qtd_jogadores + 1 = v_partida.max_jogadores then
    update public.partidas set status = 'completa' where id = p_partida_id;
  end if;

  return v_papel;
end;
$$;

-- ============================================================
-- CONTATO PARA O ORGANIZADOR COBRAR
-- Devolve nome + telefone dos jogadores da partida, SÓ para o
-- organizador. É o caminho controlado que reabre o telefone (fechado no
-- script 008) apenas para quem precisa cobrar.
-- ============================================================
create or replace function public.contato_jogadores_partida(p_partida_id uuid)
returns table (jogador_id uuid, nome text, telefone text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.partidas
    where id = p_partida_id and organizador_id = auth.uid()
  ) then
    raise exception 'SO_O_ORGANIZADOR' using errcode = 'P0001';
  end if;

  return query
    select j.id, j.nome, j.telefone
    from public.partida_jogadores pj
    join public.jogadores j on j.id = pj.jogador_id
    where pj.partida_id = p_partida_id
      and pj.papel = 'jogador';
end;
$$;

revoke all on function public.contato_jogadores_partida(uuid) from public, anon;
grant execute on function public.contato_jogadores_partida(uuid) to authenticated;

-- ============================================================
-- Tempo real dos pagamentos
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.pagamentos;
  exception when duplicate_object then null;
  end;
end $$;
