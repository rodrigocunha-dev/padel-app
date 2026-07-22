-- Sprint 3 (complemento) — Remarcar reserva
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- Por que uma função no servidor em vez de "cancelar e reservar de novo":
--  * o preço é recalculado pelo servidor (o jogador não pode inventar valor);
--  * mover a reserva para um horário que encosta no atual funciona
--    (é a MESMA reserva mudando de hora, não uma nova brigando com a antiga);
--  * se o novo horário for tomado no meio do caminho, a reserva original
--    continua de pé — o jogador nunca fica sem nada.

create or replace function public.remarcar_reserva(
  p_reserva_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  -- O novo horário precisa caber numa faixa de funcionamento do dia.
  select qp.preco_centavos into v_preco_hora
  from public.quadra_precos qp
  where qp.quadra_id = v_quadra
    and extract(dow from (p_inicio at time zone 'America/Sao_Paulo'))::smallint = any (qp.dias)
    and qp.hora_inicio <= (p_inicio at time zone 'America/Sao_Paulo')::time
    and qp.hora_fim >= (p_fim at time zone 'America/Sao_Paulo')::time
  order by qp.preco_centavos
  limit 1;

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
$$;

revoke all on function public.remarcar_reserva(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.remarcar_reserva(uuid, timestamptz, timestamptz) to authenticated;
