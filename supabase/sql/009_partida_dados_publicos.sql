-- Sprint 4 (parte A, correção) — Dados públicos da partida
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- Por quê: a partida é PÚBLICA (todo jogador compatível precisa ver
-- horário, quadra e preço para decidir entrar), mas a RESERVA que segura
-- a quadra é PRIVADA (LGPD — um jogador não lê a reserva de outro). Então
-- a partida passa a carregar seu próprio horário/quadra/preço, sem depender
-- da reserva privada. A reserva continua existindo para a trava de
-- overbooking e para a agenda do clube.

alter table public.partidas
  add column if not exists quadra_id uuid references public.quadras (id),
  add column if not exists inicio timestamptz,
  add column if not exists fim timestamptz,
  add column if not exists preco_centavos integer;

-- Preenche as partidas que já existem a partir da reserva delas.
update public.partidas p
set quadra_id = r.quadra_id,
    inicio = r.inicio,
    fim = r.fim,
    preco_centavos = r.preco_centavos
from public.reservas r
where r.id = p.reserva_id
  and p.inicio is null;

-- criar_partida passa a gravar esses dados também.
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
