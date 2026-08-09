-- Sprint 5 (motor de rating, peça 1) — sets também em PARTIDA ABERTA
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- POR QUE ESTE SCRIPT EXISTE
-- ============================================================
-- Em 08/08/2026 a regra nº 5 foi fechada assim: **a unidade do rating é
-- sempre o SET**, em qualquer contexto. Some o antigo "partida cheia = 1x".
--
-- Só que a área de sets existia apenas na sessão privada, e a partida
-- aberta não gravava resultado nenhum. Ou seja, o motor de rating nasceria
-- cego justamente para o jogo entre DESCONHECIDOS — que é o que mais
-- interessa medir, e a razão de o rating existir.
--
-- O banco já aceitava sets em partida aberta (`registrar_set` nunca travou
-- por `tipo`). Faltava a tela — e faltava uma trava que só faz falta lá.
--
-- ============================================================
-- A TRAVA QUE FALTAVA — O SUBSTITUTO DA FILA
-- ============================================================
-- Todas as funções de set perguntam `estado = 'aceito'` e mais nada. Isso
-- bastava na sessão privada, onde todo mundo tem `papel = 'jogador'`.
--
-- A partida aberta tem **fila de substitutos**, e o substituto também tem
-- `estado = 'aceito'` — ele aceitou entrar na fila. Sem olhar o `papel`,
-- quem está na fila poderia registrar um set, ser escalado num set que não
-- jogou, contestar e votar. Ele nem entrou em quadra.
--
-- É a mesma família de erro dos scripts `017` a `023`: uma condição escrita
-- quando o outro caso ainda não existia. Aqui o caso novo não é o convite —
-- é a fila.
--
-- As cinco funções abaixo são o texto do script `014` com UMA condição
-- acrescentada em cada checagem de participante: `papel = 'jogador'`.
-- Nada mais mudou. Em sessão privada o comportamento é idêntico ao de
-- antes (lá `papel` é sempre 'jogador'); a diferença aparece só na aberta.
--
-- ⚠️ NÃO mexo nas políticas de LEITURA de `sets`, `set_contestacoes` e
-- `set_votos`: o substituto está na partida e pode VER os sets. O que ele
-- não pode é agir sobre eles. Ver ≠ agir — a distinção que o `023` fez.

create or replace function public.elegiveis_para_votar(p_set_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.partida_jogadores pj
  join public.sets s on s.id = p_set_id
  left join public.set_contestacoes c on c.set_id = s.id
  where pj.partida_id = s.partida_id
    and pj.estado = 'aceito'
    and pj.papel = 'jogador'
    and pj.jogador_id is not null
    and pj.jogador_id <> s.registrado_por
    and (c.contestado_por is null or pj.jogador_id <> c.contestado_por);
$$;

create or replace function public.registrar_set(
  p_partida_id uuid,
  p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_games_a smallint, p_games_b smallint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  v_partida public.partidas;
  v_qtd integer;
  v_id uuid;
  v_p uuid;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_partida.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA' using errcode = 'P0001';
  end if;
  if v_partida.inicio > now() then
    raise exception 'PARTIDA_NAO_COMECOU' using errcode = 'P0001';
  end if;
  -- Janela de 24h após o fim para registrar.
  if now() > v_partida.fim + interval '24 hours' then
    raise exception 'FORA_DA_JANELA' using errcode = 'P0001';
  end if;

  -- Quem registra precisa ser participante aceito.
  if not exists (
    select 1 from public.partida_jogadores
    where partida_id = p_partida_id and jogador_id = v_jog and estado = 'aceito'
      and papel = 'jogador'
  ) then
    raise exception 'SO_PARTICIPANTE_REGISTRA' using errcode = 'P0001';
  end if;

  -- Os quatro do set também precisam ser participantes aceitos.
  foreach v_p in array array[p_a1, p_a2, p_b1, p_b2] loop
    if not exists (
      select 1 from public.partida_jogadores
      where partida_id = p_partida_id and jogador_id = v_p and estado = 'aceito'
        and papel = 'jogador'
    ) then
      raise exception 'JOGADOR_NAO_ESTA_NA_SESSAO' using errcode = 'P0001';
    end if;
  end loop;

  -- Teto de plausibilidade física (1 set a cada 20 min de reserva).
  select count(*) into v_qtd from public.sets where partida_id = p_partida_id;
  if v_qtd >= public.teto_de_sets(p_partida_id) then
    raise exception 'TETO_DE_SETS' using errcode = 'P0001';
  end if;

  insert into public.sets (
    partida_id, ordem, a1, a2, b1, b2, games_a, games_b, registrado_por
  ) values (
    p_partida_id, v_qtd + 1, p_a1, p_a2, p_b1, p_b2, p_games_a, p_games_b, v_jog
  )
  returning id into v_id;

  -- Avisa os outros do set: eles têm 24h para contestar. Sem aviso, "silêncio
  -- vale como concordância" viraria arapuca para quem abre menos o app.
  insert into public.avisos (jogador_id, tipo, set_id)
  select distinct j, 'set_registrado', v_id
  from unnest(array[p_a1, p_a2, p_b1, p_b2]) as j
  where j <> v_jog;

  return v_id;
end;
$fn$;

create or replace function public.contestar_set(
  p_set_id uuid,
  p_games_a smallint,
  p_games_b smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  s public.sets;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into s from public.sets where id = p_set_id;
  if s.id is null then
    raise exception 'SET_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;
  if s.registrado_por = v_jog then
    raise exception 'QUEM_REGISTROU_NAO_CONTESTA' using errcode = 'P0001';
  end if;
  if now() > s.registrado_em + interval '24 hours' then
    raise exception 'FORA_DA_JANELA' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.partida_jogadores
    where partida_id = s.partida_id and jogador_id = v_jog and estado = 'aceito'
      and papel = 'jogador'
  ) then
    raise exception 'SO_PARTICIPANTE_CONTESTA' using errcode = 'P0001';
  end if;

  insert into public.set_contestacoes (set_id, contestado_por, games_a, games_b)
  values (p_set_id, v_jog, p_games_a, p_games_b);

  -- Abre a votação e avisa quem pode votar.
  insert into public.avisos (jogador_id, tipo, set_id)
  select pj.jogador_id, 'votacao_aberta', p_set_id
  from public.partida_jogadores pj
  where pj.partida_id = s.partida_id
    and pj.estado = 'aceito'
    and pj.papel = 'jogador'
    and pj.jogador_id is not null
    and pj.jogador_id <> s.registrado_por
    and pj.jogador_id <> v_jog;

  update public.sets set ultimo_aviso_votacao = now() where id = p_set_id;
end;
$fn$;

create or replace function public.votar_set(p_set_id uuid, p_voto text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  s public.sets;
  c public.set_contestacoes;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;
  if p_voto not in ('original', 'contestado') then
    raise exception 'VOTO_INVALIDO' using errcode = 'P0001';
  end if;

  select * into s from public.sets where id = p_set_id;
  select * into c from public.set_contestacoes where set_id = p_set_id;
  if c.id is null then
    raise exception 'SEM_CONTESTACAO' using errcode = 'P0001';
  end if;
  if v_jog in (s.registrado_por, c.contestado_por) then
    raise exception 'EM_DISPUTA_NAO_VOTA' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.partida_jogadores
    where partida_id = s.partida_id and jogador_id = v_jog and estado = 'aceito'
      and papel = 'jogador'
  ) then
    raise exception 'SO_PARTICIPANTE_VOTA' using errcode = 'P0001';
  end if;

  insert into public.set_votos (set_id, votante_id, voto)
  values (p_set_id, v_jog, p_voto)
  on conflict (set_id, votante_id) do update set voto = excluded.voto;
end;
$fn$;

create or replace function public.avisar_votacao(p_set_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  s public.sets;
  c public.set_contestacoes;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into s from public.sets where id = p_set_id;
  select * into c from public.set_contestacoes where set_id = p_set_id;
  if c.id is null then
    raise exception 'SEM_CONTESTACAO' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.partida_jogadores
    where partida_id = s.partida_id and jogador_id = v_jog and estado = 'aceito'
      and papel = 'jogador'
  ) then
    raise exception 'SO_PARTICIPANTE_AVISA' using errcode = 'P0001';
  end if;
  if s.ultimo_aviso_votacao is not null
     and now() < s.ultimo_aviso_votacao + interval '6 hours' then
    raise exception 'COOLDOWN' using errcode = 'P0001';
  end if;

  -- Só quem ainda não votou.
  insert into public.avisos (jogador_id, tipo, set_id)
  select pj.jogador_id, 'votacao_aberta', p_set_id
  from public.partida_jogadores pj
  where pj.partida_id = s.partida_id
    and pj.estado = 'aceito'
    and pj.papel = 'jogador'
    and pj.jogador_id is not null
    and pj.jogador_id <> s.registrado_por
    and pj.jogador_id <> c.contestado_por
    and not exists (
      select 1 from public.set_votos v
      where v.set_id = p_set_id and v.votante_id = pj.jogador_id
    );

  update public.sets set ultimo_aviso_votacao = now() where id = p_set_id;
end;
$fn$;

-- Permissões: idênticas às do script 014, repetidas porque `create or
-- replace` não as preserva quando a assinatura é recriada.
revoke all on function public.elegiveis_para_votar(uuid) from public, anon;
grant execute on function public.elegiveis_para_votar(uuid) to authenticated;
revoke all on function public.registrar_set(uuid, uuid, uuid, uuid, uuid, smallint, smallint) from public, anon;
grant execute on function public.registrar_set(uuid, uuid, uuid, uuid, uuid, smallint, smallint) to authenticated;
revoke all on function public.contestar_set(uuid, smallint, smallint) from public, anon;
grant execute on function public.contestar_set(uuid, smallint, smallint) to authenticated;
revoke all on function public.votar_set(uuid, text) from public, anon;
grant execute on function public.votar_set(uuid, text) to authenticated;
revoke all on function public.avisar_votacao(uuid) from public, anon;
grant execute on function public.avisar_votacao(uuid) to authenticated;
