-- Sprint 5 (ajuste pós-teste) — set só pode ser registrado 15 min após o início
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- Levantado pelo fundador testando no celular: o botão de registrar set
-- liberava assim que dava a hora da partida. Duas coisas saíram disso:
--
--  1) A tela oferecia o botão mesmo sem 4 confirmados. Isso é da tela —
--     o servidor já recusava, porque registrar_set exige que os quatro
--     jogadores do set sejam participantes ACEITOS.
--
--  2) Nada impedia registrar um set no minuto 1. Trava nova: só a partir
--     de 15 minutos do início. Ninguém joga um set em menos que isso, e
--     isso fecha mais uma porta de partida fantasma (criar o jogo e sair
--     registrando resultado sem ter jogado).
--
-- Por que 15 e não 20: o teto de sets usa 20 min por set (quantos CABEM
-- na reserva). Esta é outra regra — QUANDO o primeiro pode ser registrado.
-- Números diferentes de propósito; não "harmonizar" os dois depois.
--
-- Esperar não custa nada real: a janela para registrar é de 24h após o
-- fim da sessão, então um set rápido é registrado alguns minutos depois.

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

  -- NOVO: dá tempo de um set acontecer de verdade.
  if now() < v_partida.inicio + interval '15 minutes' then
    raise exception 'ESPERE_15_MIN' using errcode = 'P0001';
  end if;

  -- Janela de 24h após o fim para registrar.
  if now() > v_partida.fim + interval '24 hours' then
    raise exception 'FORA_DA_JANELA' using errcode = 'P0001';
  end if;

  -- Quem registra precisa ser participante aceito.
  if not exists (
    select 1 from public.partida_jogadores
    where partida_id = p_partida_id and jogador_id = v_jog and estado = 'aceito'
  ) then
    raise exception 'SO_PARTICIPANTE_REGISTRA' using errcode = 'P0001';
  end if;

  -- Os quatro do set também precisam ser participantes aceitos. É isto que
  -- garante, na prática, que não dá para registrar sem 4 confirmados.
  foreach v_p in array array[p_a1, p_a2, p_b1, p_b2] loop
    if not exists (
      select 1 from public.partida_jogadores
      where partida_id = p_partida_id and jogador_id = v_p and estado = 'aceito'
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

  -- Avisa os outros do set: eles têm 24h para contestar.
  insert into public.avisos (jogador_id, tipo, set_id)
  select distinct j, 'set_registrado', v_id
  from unnest(array[p_a1, p_a2, p_b1, p_b2]) as j
  where j <> v_jog;

  return v_id;
end;
$fn$;

revoke all on function public.registrar_set(uuid, uuid, uuid, uuid, uuid, smallint, smallint) from public, anon;
grant execute on function public.registrar_set(uuid, uuid, uuid, uuid, uuid, smallint, smallint) to authenticated;
