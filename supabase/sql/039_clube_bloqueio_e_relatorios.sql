-- ============================================================
-- 039 — PAINEL DO CLUBE: BLOQUEIO DE HORÁRIO, RELATÓRIOS E OCIOSIDADE
-- ============================================================
-- Entrega 2. Três buracos do Módulo 1.7 que o Checklist listava como "não
-- existe" há semanas.


-- ============================================================
-- 1) BLOQUEIO DE HORÁRIO
-- ============================================================
-- Manutenção, chuva, evento, quadra interditada. Hoje o único jeito é o
-- clube criar uma reserva de balcão FALSA, no nome de ninguém — o que suja
-- o faturamento (uma reserva que nunca foi paga) e mente no relatório de
-- ocupação (aparece como quadra vendida).
--
-- ⚠️ DECISÃO: bloqueio é uma `reserva` com `origem = 'bloqueio'`, e não uma
-- tabela nova.
--
-- Motivo: um bloqueio OCUPA a quadra exatamente como uma reserva ocupa. Numa
-- tabela separada, seria preciso reimplementar a trava de sobreposição
-- CRUZANDO as duas tabelas — e trava de overbooking que depende de duas
-- fontes é a receita para o furo que o Sprint 2 fechou. Aqui ele herda de
-- graça a `exclude using gist` que já existe, e some da agenda pública pelo
-- mesmo gatilho.

alter table public.reservas drop constraint if exists reservas_origem_check;
alter table public.reservas
  add constraint reservas_origem_check
  check (origem in ('balcao', 'app', 'bloqueio'));

alter table public.reservas
  add column if not exists motivo_bloqueio text;

-- Bloquear e desbloquear é do dono do clube, e a política de reservas que já
-- existe ("dono gerencia as reservas das próprias quadras") já cobre isso.
-- Nada de política nova.

create or replace function public.bloquear_horario(
  p_quadra_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  v_id uuid;
begin
  if eu is null then
    raise exception 'PRECISA_ESTAR_LOGADO';
  end if;

  if p_fim <= p_inicio then
    raise exception 'PERIODO_INVALIDO';
  end if;

  if not exists (
    select 1 from public.quadras q
    join public.clubes c on c.id = q.clube_id
    where q.id = p_quadra_id and c.dono_id = eu
  ) then
    raise exception 'SO_O_DONO';
  end if;

  -- Sem preço: bloqueio não é venda. É isto que mantém o faturamento
  -- honesto e a ocupação medindo o que foi de fato vendido.
  insert into public.reservas (quadra_id, inicio, fim, origem, motivo_bloqueio,
                               criado_por, preco_centavos)
  values (p_quadra_id, p_inicio, p_fim, 'bloqueio', nullif(p_motivo, ''), eu, 0)
  returning id into v_id;

  return v_id;
exception
  -- 23P01 é a violação da trava de sobreposição: já existe reserva ou
  -- bloqueio naquele horário.
  when exclusion_violation then
    raise exception 'HORARIO_OCUPADO';
end;
$fn$;

revoke all on function public.bloquear_horario(uuid, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.bloquear_horario(uuid, timestamptz, timestamptz, text)
  to authenticated;


-- ============================================================
-- 2) RELATÓRIOS DO CLUBE
-- ============================================================
-- Ocupação, faturamento e de onde vieram as reservas, num período.
--
-- ⚠️ A ocupação é calculada sobre as HORAS QUE O CLUBE ABRE, e não sobre 24h
-- por dia — senão todo clube pareceria ter 20% de ocupação e o número não
-- serviria para decidir nada. As horas de funcionamento saem das faixas de
-- preço, que é de onde o app já deriva o horário do clube desde o Sprint 2.
--
-- Bloqueio não conta como vendido NEM como disponível: a quadra não estava à
-- venda naquele horário. Contá-lo como disponível puniria o clube que fechou
-- para manutenção.

create or replace function public.relatorio_do_clube(
  p_clube_id uuid,
  p_de date,
  p_ate date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  v_res jsonb;
  v_horas_abertas numeric;
  v_horas_vendidas numeric;
  v_horas_bloqueadas numeric;
begin
  if not exists (
    select 1 from public.clubes where id = p_clube_id and dono_id = eu
  ) then
    raise exception 'SO_O_DONO';
  end if;

  -- Horas que o clube esteve aberto no período: para cada quadra, a soma das
  -- faixas de preço que valem em cada dia da semana dentro do intervalo.
  -- ⚠️ `dias` é smallint[] com a numeração do `extract(dow)` (0 = domingo),
  -- e não texto. E o dia da semana é lido no fuso de São Paulo, que é o
  -- mesmo critério que `reservar_quadra` usa desde o script 006 — senão uma
  -- reserva das 21h de sábado cairia em domingo no relatório.
  select coalesce(sum(
           extract(epoch from (qp.hora_fim - qp.hora_inicio)) / 3600.0
         ), 0)
    into v_horas_abertas
  from generate_series(p_de, p_ate, interval '1 day') d
  join public.quadras q on q.clube_id = p_clube_id
  join public.quadra_precos qp on qp.quadra_id = q.id
  where extract(dow from d)::smallint = any (qp.dias);

  select
    coalesce(sum(case when r.origem <> 'bloqueio'
                 then extract(epoch from (r.fim - r.inicio)) / 3600.0 end), 0),
    coalesce(sum(case when r.origem = 'bloqueio'
                 then extract(epoch from (r.fim - r.inicio)) / 3600.0 end), 0)
    into v_horas_vendidas, v_horas_bloqueadas
  from public.reservas r
  join public.quadras q on q.id = r.quadra_id
  where q.clube_id = p_clube_id
    and r.status = 'confirmada'
    and (r.inicio at time zone 'America/Sao_Paulo')::date between p_de and p_ate;

  select jsonb_build_object(
    'de', p_de,
    'ate', p_ate,

    'faturamento_centavos', coalesce((
      select sum(r.preco_centavos)
      from public.reservas r
      join public.quadras q on q.id = r.quadra_id
      where q.clube_id = p_clube_id
        and r.status = 'confirmada'
        and r.origem <> 'bloqueio'
        and (r.inicio at time zone 'America/Sao_Paulo')::date between p_de and p_ate
    ), 0),

    'reservas', coalesce((
      select count(*)
      from public.reservas r
      join public.quadras q on q.id = r.quadra_id
      where q.clube_id = p_clube_id
        and r.status = 'confirmada'
        and r.origem <> 'bloqueio'
        and (r.inicio at time zone 'America/Sao_Paulo')::date between p_de and p_ate
    ), 0),

    -- De onde veio cada reserva. É o número que diz se o app está trazendo
    -- gente nova ou só digitalizando quem já ligava.
    'por_origem', coalesce((
      select jsonb_object_agg(origem, qtd) from (
        select r.origem, count(*) qtd
        from public.reservas r
        join public.quadras q on q.id = r.quadra_id
        where q.clube_id = p_clube_id
          and r.status = 'confirmada'
          and (r.inicio at time zone 'America/Sao_Paulo')::date between p_de and p_ate
        group by r.origem
      ) t
    ), '{}'::jsonb),

    'horas_abertas', round(v_horas_abertas, 1),
    'horas_vendidas', round(v_horas_vendidas, 1),
    'horas_bloqueadas', round(v_horas_bloqueadas, 1),
    'ocupacao_percentual', case
      when v_horas_abertas - v_horas_bloqueadas > 0
      then round(100 * v_horas_vendidas / (v_horas_abertas - v_horas_bloqueadas), 1)
      else 0 end,

    -- Os horários que mais ficam vazios, por dia da semana e hora. É o que
    -- alimenta a decisão de promover ociosidade.
    'mais_ociosos', coalesce((
      select jsonb_agg(x) from (
        select
          case extract(dow from d)::int
            when 0 then 'dom' when 1 then 'seg' when 2 then 'ter'
            when 3 then 'qua' when 4 then 'qui' when 5 then 'sex'
            else 'sab' end as dia,
          h as hora,
          count(r.id) as vendas
        from generate_series(p_de, p_ate, interval '1 day') d
        cross join generate_series(6, 22) h
        left join public.reservas r
          -- Mesmo fuso do resto: o horário que o clube enxerga na agenda.
          on (r.inicio at time zone 'America/Sao_Paulo')::date = d::date
         and extract(hour from (r.inicio at time zone 'America/Sao_Paulo')) = h
         and r.status = 'confirmada'
         and r.origem <> 'bloqueio'
         and r.quadra_id in (select id from public.quadras where clube_id = p_clube_id)
        group by dia, h
        order by vendas asc, h asc
        limit 8
      ) x
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$fn$;

revoke all on function public.relatorio_do_clube(uuid, date, date) from public, anon;
grant execute on function public.relatorio_do_clube(uuid, date, date) to authenticated;


-- ============================================================
-- 3) PROMOVER HORÁRIO OCIOSO
-- ============================================================
-- O clube avisa jogadores de que sobrou horário. Vira `avisos`, e o push já
-- sai sozinho pelo gatilho do script 033 — nada novo de envio.
--
-- ⚠️ Quem recebe: jogadores da CIDADE do clube, que não estão bloqueados por
-- inadimplência e que não são o próprio dono. Não filtra por categoria de
-- propósito: horário livre não tem nível, é oferta de quadra.
--
-- ⚠️ Trava de spam: no máximo um aviso por clube a cada 6 horas. É o mesmo
-- intervalo já usado nas cobranças de set (Decisão 1), para o produto ter
-- UMA noção de "não encher o saco", e não uma por funcionalidade.

alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos
  add constraint avisos_tipo_check
  check (tipo in ('set_registrado', 'votacao_aberta', 'promovido', 'horario_livre'));

alter table public.avisos
  add column if not exists clube_id uuid references public.clubes (id) on delete cascade;

create or replace function public.promover_horario_ocioso(
  p_quadra_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  v_clube public.clubes;
  v_qtd integer;
begin
  select c.* into v_clube
  from public.quadras q
  join public.clubes c on c.id = q.clube_id
  where q.id = p_quadra_id and c.dono_id = eu;

  if v_clube.id is null then
    raise exception 'SO_O_DONO';
  end if;

  if p_inicio <= now() then
    raise exception 'HORARIO_NO_PASSADO';
  end if;

  -- O horário precisa estar REALMENTE livre. Sem isto o clube anunciaria
  -- quadra já vendida, e quem corresse ao aviso bateria numa porta fechada.
  if exists (
    select 1 from public.reservas r
    where r.quadra_id = p_quadra_id
      and r.status = 'confirmada'
      and tstzrange(r.inicio, r.fim) && tstzrange(p_inicio, p_fim)
  ) then
    raise exception 'HORARIO_OCUPADO';
  end if;

  if exists (
    select 1 from public.avisos a
    where a.clube_id = v_clube.id
      and a.tipo = 'horario_livre'
      and a.criado_em > now() - interval '6 hours'
  ) then
    raise exception 'AGUARDE_6H';
  end if;

  with alvo as (
    select j.id
    from public.jogadores j
    where j.cidade = v_clube.cidade
      and j.id <> eu
      and j.anonimizado_em is null
      and not public.jogador_inadimplente(j.id)
  ), criados as (
    insert into public.avisos (jogador_id, tipo, clube_id, partida_id)
    select alvo.id, 'horario_livre', v_clube.id, null from alvo
    returning 1
  )
  select count(*) into v_qtd from criados;

  return v_qtd;
end;
$fn$;

revoke all on function public.promover_horario_ocioso(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.promover_horario_ocioso(uuid, timestamptz, timestamptz)
  to authenticated;


-- ============================================================
-- COMO CONFERIR
-- ============================================================
-- Bloqueio ocupa de verdade (a segunda linha tem de falhar):
--     select public.bloquear_horario('<quadra>', now() + interval '2 days',
--                                    now() + interval '2 days 1 hour', 'chuva');
--     select public.bloquear_horario('<quadra>', now() + interval '2 days',
--                                    now() + interval '2 days 1 hour', 'de novo');
--
-- Relatório (rodar logado como dono, pelo app):
--     select public.relatorio_do_clube('<clube>', current_date - 30, current_date);
--
-- Bloqueio NÃO pode entrar no faturamento nem na contagem de reservas.
