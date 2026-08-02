-- Sprint 5 (correção) — Reserva não pode atravessar a meia-noite
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- BUG ENCONTRADO em 02/08/2026, testando o ciclo do script 014.
--
-- Uma reserva das 23:00 às 01:00 foi ACEITA num clube cuja faixa de
-- funcionamento termina às 23:59. O clube ficaria com gente em quadra
-- depois de fechado.
--
-- Causa: a checagem de funcionamento comparava só a HORA do início e do
-- fim contra a faixa:
--
--     and qp.hora_fim >= (p_fim at time zone 'America/Sao_Paulo')::time
--
-- Quando a reserva atravessa a meia-noite, o fim vira 01:00 — e
-- "23:59 >= 01:00" é VERDADEIRO comparando hora com hora. A verificação
-- não enxergava que o fim caiu no dia seguinte.
--
-- Correção: comparar em MINUTOS DESDE A MEIA-NOITE do dia em que a
-- reserva começa. Uma reserva que atravessa a meia-noite passa dos 1440
-- minutos e, com isso, nunca cabe em faixa nenhuma — que é o certo,
-- porque a faixa é sempre uma janela de um mesmo dia.
--
-- Vale para as duas funções: reservar_quadra (006/012) e remarcar_reserva
-- (007). Nada além dessa checagem muda.


-- ============================================================
-- Auxiliar: a reserva cabe numa faixa de funcionamento da quadra?
-- Devolve o menor preço/hora que serve, ou nulo se não couber.
-- ============================================================
create or replace function public.preco_da_faixa(
  p_quadra_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz
)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  with janela as (
    select
      (p_inicio at time zone 'America/Sao_Paulo') as ini_local,
      extract(epoch from (p_fim - p_inicio)) / 60 as duracao_min
  )
  select qp.preco_centavos
  from public.quadra_precos qp, janela j
  where qp.quadra_id = p_quadra_id
    and extract(dow from j.ini_local)::smallint = any (qp.dias)
    -- Minutos desde a meia-noite do dia em que a reserva COMEÇA.
    and (extract(hour from qp.hora_inicio) * 60 + extract(minute from qp.hora_inicio))
        <= (extract(hour from j.ini_local) * 60 + extract(minute from j.ini_local))
    -- O fim é o início + duração. Se atravessar a meia-noite, passa de
    -- 1440 e não cabe em faixa nenhuma — exatamente o que queremos.
    and (extract(hour from qp.hora_fim) * 60 + extract(minute from qp.hora_fim))
        >= (extract(hour from j.ini_local) * 60 + extract(minute from j.ini_local) + j.duracao_min)
  order by qp.preco_centavos
  limit 1;
$fn$;

revoke all on function public.preco_da_faixa(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.preco_da_faixa(uuid, timestamptz, timestamptz) to authenticated;


-- ============================================================
-- reservar_quadra — igual à versão do 012, só troca a checagem
-- ============================================================
create or replace function public.reservar_quadra(
  p_quadra_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jogador uuid := auth.uid();
  v_preco_hora integer;
  v_minutos numeric;
  v_id uuid;
begin
  if v_jogador is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  if public.jogador_inadimplente(v_jogador) then
    raise exception 'PENDENCIA' using errcode = 'P0001';
  end if;

  if p_fim <= p_inicio then
    raise exception 'PERIODO_INVALIDO' using errcode = 'P0001';
  end if;
  if p_inicio < now() then
    raise exception 'HORARIO_PASSADO' using errcode = 'P0001';
  end if;

  v_preco_hora := public.preco_da_faixa(p_quadra_id, p_inicio, p_fim);

  if v_preco_hora is null then
    raise exception 'FORA_DO_FUNCIONAMENTO' using errcode = 'P0001';
  end if;

  v_minutos := extract(epoch from (p_fim - p_inicio)) / 60;

  insert into public.reservas (
    quadra_id, inicio, fim, origem, jogador_id, status, criado_por, preco_centavos
  )
  values (
    p_quadra_id, p_inicio, p_fim, 'app', v_jogador, 'confirmada', v_jogador,
    round(v_preco_hora * v_minutos / 60)
  )
  returning id into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.reservar_quadra(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.reservar_quadra(uuid, timestamptz, timestamptz) to authenticated;


-- ============================================================
-- remarcar_reserva — igual à versão do 007, só troca a checagem
-- ============================================================
create or replace function public.remarcar_reserva(
  p_reserva_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jogador uuid := auth.uid();
  v_quadra uuid;
  v_preco_hora integer;
  v_minutos numeric;
begin
  if v_jogador is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  if p_fim <= p_inicio then
    raise exception 'PERIODO_INVALIDO' using errcode = 'P0001';
  end if;
  if p_inicio < now() then
    raise exception 'HORARIO_PASSADO' using errcode = 'P0001';
  end if;

  -- Só a própria reserva, feita pelo app e ainda confirmada.
  select r.quadra_id into v_quadra
  from public.reservas r
  where r.id = p_reserva_id
    and r.jogador_id = v_jogador
    and r.origem = 'app'
    and r.status = 'confirmada';

  if v_quadra is null then
    raise exception 'RESERVA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;

  v_preco_hora := public.preco_da_faixa(v_quadra, p_inicio, p_fim);

  if v_preco_hora is null then
    raise exception 'FORA_DO_FUNCIONAMENTO' using errcode = 'P0001';
  end if;

  v_minutos := extract(epoch from (p_fim - p_inicio)) / 60;

  -- O gatilho da política (script 006) roda aqui e barra se o prazo do
  -- clube já passou. A trava anti-overbooking barra se alguém pegou o
  -- horário no meio do caminho.
  update public.reservas
  set inicio = p_inicio,
      fim = p_fim,
      preco_centavos = round(v_preco_hora * v_minutos / 60)
  where id = p_reserva_id;
end;
$fn$;

revoke all on function public.remarcar_reserva(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.remarcar_reserva(uuid, timestamptz, timestamptz) to authenticated;
