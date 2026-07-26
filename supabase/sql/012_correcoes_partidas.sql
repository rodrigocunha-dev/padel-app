-- Sprint 4 (correções pós-teste) — cancelar partida + inadimplente na reserva
-- Rode no Supabase: SQL Editor → New query → colar → Run.

-- ============================================================
-- BUG 1 — cancelar partida falhava dentro da janela do clube
-- Cancelar a partida cancela a reserva por baixo, e isso disparava o
-- gatilho da política de cancelamento (checar_politica_reserva). Se a
-- partida estava dentro da janela e o organizador não era dono do clube,
-- o gatilho recusava. Solução: o cancelamento da PARTIDA é regido pela
-- partida, não pela política de reserva avulsa. A função avisa o gatilho
-- (por uma flag de sessão) para ele deixar passar.
-- ============================================================
create or replace function public.checar_politica_reserva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite smallint;
  v_dono uuid;
  v_usuario uuid := auth.uid();
begin
  -- Cancelamento vindo de cancelar_partida: a partida já governa isso.
  if current_setting('app.pular_politica', true) = '1' then
    return new;
  end if;

  if new.status = old.status
     and new.inicio = old.inicio
     and new.fim = old.fim then
    return new;
  end if;

  select c.horas_limite_cancelamento, c.dono_id
    into v_limite, v_dono
  from public.quadras q
  join public.clubes c on c.id = q.clube_id
  where q.id = old.quadra_id;

  if v_usuario is null or v_usuario = v_dono then
    return new;
  end if;

  if old.inicio - now() < make_interval(hours => coalesce(v_limite, 12)::int) then
    raise exception 'FORA_DO_PRAZO' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

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

  -- Avisa o gatilho da política para não bloquear: quem cancela a partida
  -- é o organizador, e a partida governa a própria reserva.
  perform set_config('app.pular_politica', '1', true);

  update public.partidas set status = 'cancelada' where id = p_partida_id;
  update public.reservas set status = 'cancelada' where id = v_partida.reserva_id;
end;
$$;

revoke all on function public.cancelar_partida(uuid) from public, anon;
grant execute on function public.cancelar_partida(uuid) to authenticated;

-- ============================================================
-- BUG 3 — jogador inadimplente ainda conseguia reservar quadra
-- O bloqueio existia em criar/entrar partida, mas não na reserva avulsa.
-- Agora inadimplente também não reserva quadra.
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
as $$
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
$$;
