-- Entrega B — convidar quem ainda NÃO tem conta, pelo telefone
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- O QUE ISTO RESOLVE
-- ============================================================
-- Hoje só dá para convidar quem já está no app, e a busca é por NOME. Mas
-- o jogo real de grupo fixo tem sempre alguém que ainda não se cadastrou —
-- e é justamente esse pessoal que precisa entrar para a sessão contar.
--
-- A regra de conta obrigatória (Decisão 1) continua de pé: o convite por
-- telefone fica PENDENTE até a pessoa criar conta. Ela não vira
-- participante por decreto de terceiro.
--
-- ⚠️ Vale só para SESSÃO PRIVADA (decisão do fundador, 15/08/2026).
-- Partida aberta não tem convite — as pessoas entram sozinhas pelo feed.
-- Abrir convite lá criaria um segundo caminho de entrada, com regras
-- diferentes das vagas e da fila.
--
-- O banco já nasceu preparado no script `014`: `telefone` na tabela,
-- `jogador_id` podendo ficar vazio, trava exigindo um dos dois, e índice
-- impedindo convidar o mesmo telefone duas vezes na mesma partida.

-- ============================================================
-- 1) ⚠️ O TELEFONE DO CONVIDADO NÃO PODE FICAR À VISTA DO GRUPO
-- ============================================================
-- `partida_jogadores` é legível por todos os participantes da partida
-- (script 023). Sem esta trava, convidar alguém por telefone entregaria o
-- número dessa pessoa para o grupo inteiro — sem ela ter aceitado nada.
--
-- É a mesma família de erro do script `022`, onde bastava convidar alguém
-- para obter o telefone dela. O telefone em `jogadores` já é fechado por
-- privilégio de coluna desde o Sprint 4; o desta tabela passa a ser também.
revoke select (telefone) on public.partida_jogadores from authenticated;

-- O organizador PRECISA ver o que digitou, para conferir e reenviar o
-- link. Volta por um caminho controlado, só para ele.
create or replace function public.convites_por_telefone(p_partida_id uuid)
returns table (nome text, telefone text, convidado_em timestamptz)
language plpgsql
security definer
set search_path = public
stable
as $fn$
begin
  if not exists (
    select 1 from public.partidas
    where id = p_partida_id and organizador_id = auth.uid()
  ) then
    raise exception 'SO_O_ORGANIZADOR' using errcode = 'P0001';
  end if;

  return query
    select pj.nome_convidado, pj.telefone, pj.convidado_em
    from public.partida_jogadores pj
    where pj.partida_id = p_partida_id
      and pj.telefone is not null
      and pj.jogador_id is null;   -- já virou conta? então não é mais isto
end;
$fn$;

revoke all on function public.convites_por_telefone(uuid) from public, anon;
grant execute on function public.convites_por_telefone(uuid) to authenticated;

-- Um nome para o organizador reconhecer quem é aquele número na lista.
alter table public.partida_jogadores
  add column if not exists nome_convidado text;

revoke select (nome_convidado) on public.partida_jogadores from authenticated;


-- ============================================================
-- 2) DE ONDE VEIO CADA JOGADOR (rastreamento, para o dono do app)
-- ============================================================
-- ⚠️ Isto NÃO tem tela. É dado para o fundador consultar, não informação
-- que o app mostre a ninguém — a pessoa não vê quem convidou quem. Se um
-- dia houver campanha de recompensa, aí sim se decide o que exibir e como
-- dificultar fraude, com estes dados já acumulados.
alter table public.jogadores
  add column if not exists convidado_por uuid references auth.users (id) on delete set null,
  add column if not exists origem_cadastro text;

-- Fechados por privilégio de coluna: é dado nosso, não do jogador.
revoke select (convidado_por, origem_cadastro) on public.jogadores from authenticated;

-- O código curto que vai no link de convite. Curto de propósito: ele é
-- colado em WhatsApp, e um endereço gigante desanima antes de abrir.
alter table public.jogadores
  add column if not exists codigo_convite text;

create unique index if not exists jogadores_codigo_convite_unico
  on public.jogadores (codigo_convite) where codigo_convite is not null;

create or replace function public.gerar_codigo_convite()
returns trigger
language plpgsql
as $fn$
begin
  if new.codigo_convite is null then
    -- 8 caracteres do md5: colisão é improvável e o índice único pega.
    new.codigo_convite := substr(md5(new.id::text || clock_timestamp()::text), 1, 8);
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_gerar_codigo_convite on public.jogadores;
create trigger trg_gerar_codigo_convite
  before insert on public.jogadores
  for each row execute function public.gerar_codigo_convite();

-- Quem já existe também ganha um código.
update public.jogadores
set codigo_convite = substr(md5(id::text || clock_timestamp()::text), 1, 8)
where codigo_convite is null;

-- Descobrir de quem é um código. Devolve só o id — nada de nome ou
-- telefone, porque quem chama isto ainda nem tem conta.
create or replace function public.dono_do_codigo(p_codigo text)
returns uuid
language sql
security definer
set search_path = public
stable
as $fn$
  select id from public.jogadores where codigo_convite = p_codigo;
$fn$;

revoke all on function public.dono_do_codigo(text) from public, anon;
grant execute on function public.dono_do_codigo(text) to authenticated, anon;


-- ============================================================
-- 3) CONVIDAR PELO TELEFONE
-- ============================================================
create or replace function public.convidar_por_telefone(
  p_partida_id uuid,
  p_telefone text,
  p_nome text
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid := auth.uid();
  v_partida public.partidas;
  v_tel text;
  v_existente uuid;
begin
  if v_org is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_partida.organizador_id <> v_org then
    raise exception 'SO_O_ORGANIZADOR' using errcode = 'P0001';
  end if;
  -- Só sessão privada. Partida aberta tem vaga e fila, não convite.
  if v_partida.tipo <> 'privada' then
    raise exception 'SO_SESSAO_PRIVADA' using errcode = 'P0001';
  end if;
  if v_partida.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA' using errcode = 'P0001';
  end if;

  -- Guarda só dígitos: o mesmo número digitado de dois jeitos tem de ser
  -- reconhecido como um só, senão o convite nunca acha a conta.
  v_tel := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  if length(v_tel) < 10 then
    raise exception 'TELEFONE_INVALIDO' using errcode = 'P0001';
  end if;

  -- Se esse telefone JÁ tem conta, o convite é o normal, com jogador_id.
  -- Convidar por telefone alguém que já está no app não pode criar um
  -- participante fantasma paralelo à conta dela.
  select id into v_existente from public.jogadores
  where regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_tel;

  if v_existente is not null then
    perform public.convidar_participante(p_partida_id, v_existente);
    return 'ja_tem_conta';
  end if;

  insert into public.partida_jogadores (
    partida_id, jogador_id, telefone, nome_convidado, papel, ordem,
    estado, convidado_por, convidado_em
  ) values (
    p_partida_id, null, v_tel, nullif(trim(coalesce(p_nome, '')), ''),
    'jogador',
    coalesce((select max(ordem) from public.partida_jogadores where partida_id = p_partida_id), 0) + 1,
    'convidado', v_org, now()
  )
  on conflict do nothing;

  return 'convite_pendente';
end;
$fn$;

revoke all on function public.convidar_por_telefone(uuid, text, text) from public, anon;
grant execute on function public.convidar_por_telefone(uuid, text, text) to authenticated;


-- ============================================================
-- 4) QUANDO A PESSOA CRIA CONTA, OS CONVITES A ENCONTRAM
-- ============================================================
-- Chamada logo depois de o perfil existir. Liga à conta nova todos os
-- convites que estavam esperando aquele telefone.
--
-- O convite continua `convidado`: ela ainda precisa ACEITAR. Criar conta
-- não é dizer sim para um jogo — e ninguém entra numa conta a pagar sem
-- dizer sim (Decisão 1).
create or replace function public.vincular_convites_do_telefone()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  v_tel text;
  v_qtd integer;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select regexp_replace(coalesce(telefone, ''), '\D', '', 'g') into v_tel
  from public.jogadores where id = v_jog;

  if v_tel is null or length(v_tel) < 10 then
    return 0;
  end if;

  with ligados as (
    update public.partida_jogadores pj
    set jogador_id = v_jog, telefone = null, nome_convidado = null
    where pj.telefone = v_tel
      and pj.jogador_id is null
      -- Não liga a partidas em que a pessoa já entrou por outro caminho.
      and not exists (
        select 1 from public.partida_jogadores outro
        where outro.partida_id = pj.partida_id and outro.jogador_id = v_jog
      )
    returning 1
  )
  select count(*) into v_qtd from ligados;

  return v_qtd;
end;
$fn$;

revoke all on function public.vincular_convites_do_telefone() from public, anon;
grant execute on function public.vincular_convites_do_telefone() to authenticated;


-- ============================================================
-- CONSULTAS PARA O DONO DO APP (não são tela, são para você)
-- ============================================================
-- Quem trouxe quem, pelo link genérico:
--     select c.nome as convidou, count(*) as trouxe
--     from public.jogadores j join public.jogadores c on c.id = j.convidado_por
--     group by c.nome order by 2 desc;
--
-- Convites por telefone: quantos enviados, quantos viraram conta:
--     select c.nome as convidou,
--            count(*) filter (where pj.jogador_id is null) as ainda_sem_conta,
--            count(*) filter (where pj.jogador_id is not null) as viraram_conta,
--            count(*) filter (where pj.estado = 'aceito') as aceitaram
--     from public.partida_jogadores pj
--     join public.jogadores c on c.id = pj.convidado_por
--     where pj.convidado_em is not null
--     group by c.nome order by 2 desc;
