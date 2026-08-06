-- Sprint 5 (ajustes pós-teste) — remover convidado + substituir vaga certa
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- Dois achados do fundador testando no celular:
--
-- 1) Não havia como o organizador tirar alguém que ele convidou por
--    engano. Convite errado ficava lá para sempre, ocupando vaga.
--
-- 2) Com DUAS pessoas oferecendo a vaga, quem entrava assumia sempre a
--    vaga de quem desistiu primeiro. Mas se foi o jogador B que achou o
--    substituto, é a vaga de B que tem de ser preenchida — senão o B
--    continua no jogo contra a vontade e o A sai sem ter arrumado
--    ninguém.


-- ============================================================
-- 1) COLUNA: a qual vaga este convite se destina
-- ============================================================
-- Nulo = convite comum. Preenchido = convite feito para substituir uma
-- pessoa específica que ofereceu a vaga.
alter table public.partida_jogadores
  add column if not exists substitui_jogador_id uuid
    references auth.users (id) on delete set null;


-- ============================================================
-- 2) REMOVER PARTICIPANTE — só o organizador, e nunca quem pagou
-- ============================================================
-- Quem já pagou não pode ser removido: o dinheiro dele está naquela vaga,
-- e não existe estorno enquanto o PIX for simulado. Tirar alguém que
-- pagou seria apagar a contrapartida do pagamento.
create or replace function public.remover_participante(
  p_partida_id uuid,
  p_jogador_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid := auth.uid();
  v_partida public.partidas;
begin
  if v_org is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_partida.organizador_id <> v_org then
    raise exception 'SO_O_ORGANIZADOR_REMOVE' using errcode = 'P0001';
  end if;
  if p_jogador_id = v_partida.organizador_id then
    raise exception 'ORGANIZADOR_NAO_SAI' using errcode = 'P0001';
  end if;
  if v_partida.inicio <= now() then
    raise exception 'PARTIDA_JA_COMECOU' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.pagamentos
    where partida_id = p_partida_id
      and jogador_id = p_jogador_id
      and status = 'pago'
  ) then
    raise exception 'JOGADOR_JA_PAGOU' using errcode = 'P0001';
  end if;

  delete from public.partida_jogadores
  where partida_id = p_partida_id and jogador_id = p_jogador_id;

  if not found then
    raise exception 'JOGADOR_NAO_ESTA_NA_SESSAO' using errcode = 'P0001';
  end if;
end;
$fn$;


-- ============================================================
-- 3) CONVIDAR — podendo dizer QUAL vaga o convite preenche
-- ============================================================
create or replace function public.convidar_participante(
  p_partida_id uuid,
  p_jogador_id uuid,
  p_substitui uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid := auth.uid();
  v_partida public.partidas;
begin
  if v_org is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_partida.organizador_id <> v_org then
    raise exception 'SO_O_ORGANIZADOR_CONVIDA' using errcode = 'P0001';
  end if;
  if v_partida.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA' using errcode = 'P0001';
  end if;
  if v_partida.inicio <= now() then
    raise exception 'PARTIDA_JA_COMECOU' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.jogadores where id = p_jogador_id) then
    raise exception 'PRECISA_TER_CONTA' using errcode = 'P0001';
  end if;

  -- Se disse qual vaga preenche, essa pessoa precisa ter oferecido a dela.
  if p_substitui is not null and not exists (
    select 1 from public.partida_jogadores
    where partida_id = p_partida_id
      and jogador_id = p_substitui
      and estado = 'aceito'
      and desistiu_em is not null
  ) then
    raise exception 'VAGA_ALVO_INVALIDA' using errcode = 'P0001';
  end if;

  if v_partida.divisor_congelado is not null
     and public.vagas_ocupadas(p_partida_id) >= v_partida.divisor_congelado then
    raise exception 'SEM_VAGA_ABERTA' using errcode = 'P0001';
  end if;

  insert into public.partida_jogadores (
    partida_id, jogador_id, papel, ordem, estado,
    convidado_por, convidado_em, substitui_jogador_id
  ) values (
    p_partida_id, p_jogador_id, 'jogador',
    coalesce((select max(ordem) from public.partida_jogadores where partida_id = p_partida_id), 0) + 1,
    'convidado', v_org, now(), p_substitui
  )
  on conflict (partida_id, jogador_id) do update
    set estado = 'convidado',
        desistiu_em = null,
        convidado_por = v_org,
        convidado_em = now(),
        respondido_em = null,
        substitui_jogador_id = p_substitui
    where public.partida_jogadores.estado in ('recusado', 'saiu');
end;
$fn$;


-- ============================================================
-- 4) ACEITAR — sai quem o convite dizia substituir
-- ============================================================
create or replace function public.responder_convite(
  p_partida_id uuid,
  p_aceito boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  v_linha public.partida_jogadores;
  v_congelado smallint;
  v_substituido uuid;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;
  if p_aceito and public.jogador_inadimplente(v_jog) then
    raise exception 'PENDENCIA' using errcode = 'P0001';
  end if;

  select * into v_linha
  from public.partida_jogadores
  where partida_id = p_partida_id and jogador_id = v_jog;

  if v_linha.id is null then
    raise exception 'CONVITE_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;
  if v_linha.estado <> 'convidado' then
    raise exception 'CONVITE_JA_RESPONDIDO' using errcode = 'P0001';
  end if;

  update public.partida_jogadores
  set estado = case when p_aceito then 'aceito' else 'recusado' end,
      respondido_em = now()
  where partida_id = p_partida_id and jogador_id = v_jog;

  if p_aceito then
    select divisor_congelado into v_congelado
    from public.partidas where id = p_partida_id;

    if v_congelado is not null then
      -- Se o convite dizia QUAL vaga preenche, é essa. Assim quem achou o
      -- próprio substituto sai, e não quem apenas ofereceu a vaga antes.
      -- Sem alvo, cai na regra antiga: sai quem ofereceu primeiro.
      if v_linha.substitui_jogador_id is not null then
        select jogador_id into v_substituido
        from public.partida_jogadores
        where partida_id = p_partida_id
          and jogador_id = v_linha.substitui_jogador_id
          and estado = 'aceito'
          and desistiu_em is not null;
      else
        select jogador_id into v_substituido
        from public.partida_jogadores
        where partida_id = p_partida_id
          and estado = 'aceito'
          and desistiu_em is not null
        order by desistiu_em
        limit 1;
      end if;

      if v_substituido is not null then
        update public.partida_jogadores
        set estado = 'saiu'
        where partida_id = p_partida_id and jogador_id = v_substituido;
      end if;
    end if;
  end if;
end;
$fn$;


revoke all on function public.remover_participante(uuid, uuid) from public, anon;
grant execute on function public.remover_participante(uuid, uuid) to authenticated;
revoke all on function public.convidar_participante(uuid, uuid, uuid) from public, anon;
grant execute on function public.convidar_participante(uuid, uuid, uuid) to authenticated;
revoke all on function public.responder_convite(uuid, boolean) from public, anon;
grant execute on function public.responder_convite(uuid, boolean) to authenticated;

-- A versão de 2 argumentos vira ambígua com a nova de 3 (que tem default).
-- Remover a antiga evita o erro "function is not unique" na chamada.
drop function if exists public.convidar_participante(uuid, uuid);
