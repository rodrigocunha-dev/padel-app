-- ============================================================
-- 047 — BLOQUEIO RECORRENTE ("toda terça às 8h")
-- ============================================================
-- Hoje o clube bloqueia um horário de cada vez. Para uma aula fixa ou uma
-- manutenção semanal, isso é dezenas de toques.
--
-- ⚠️ DECISÃO: a recorrência CRIA os bloqueios um a um, de verdade, em vez de
-- guardar uma regra ("toda terça") que a agenda interpretaria na hora de
-- desenhar.
--
-- O motivo é o zero overbooking. A trava que impede reserva em cima de
-- reserva é uma restrição do banco sobre LINHAS existentes. Uma regra não é
-- linha: para respeitá-la seria preciso reimplementar a checagem em todo
-- lugar que cria reserva — a tela do jogador, a do balcão, a remarcação — e
-- basta esquecer um para o overbooking voltar. Materializando, cada bloqueio
-- entra na mesma trava que já protege tudo desde o Sprint 2.
--
-- O custo é ter um horizonte: não dá para criar bloqueios até o infinito.
-- Fica limitado a 1 ano, e o clube renova quando precisar.


-- Para conseguir remover a série inteira depois. Bloqueio avulso fica nulo.
alter table public.reservas
  add column if not exists serie_id uuid;

create index if not exists idx_reservas_serie
  on public.reservas (serie_id) where serie_id is not null;


create or replace function public.bloquear_recorrente(
  p_quadra_id uuid,
  p_dia_semana smallint,        -- 0 = domingo, como o extract(dow)
  p_hora time,
  p_duracao_min integer,
  p_de date,
  p_ate date,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  v_serie uuid := gen_random_uuid();
  d date;
  v_inicio timestamptz;
  v_criados integer := 0;
  v_pulados integer := 0;
begin
  if not exists (
    select 1 from public.quadras q
    join public.clubes c on c.id = q.clube_id
    where q.id = p_quadra_id and c.dono_id = eu
  ) then
    raise exception 'SO_O_DONO';
  end if;

  if p_ate < p_de then
    raise exception 'PERIODO_INVALIDO';
  end if;

  if p_ate > p_de + interval '1 year' then
    raise exception 'PERIODO_LONGO_DEMAIS';
  end if;

  if p_duracao_min < 30 or p_duracao_min > 480 then
    raise exception 'DURACAO_INVALIDA';
  end if;

  for d in select generate_series(p_de, p_ate, interval '1 day')::date loop
    continue when extract(dow from d)::smallint <> p_dia_semana;

    -- O horário é o do clube (São Paulo), não o do servidor. Mesmo critério
    -- do resto do sistema desde o script 006.
    v_inicio := (d + p_hora) at time zone 'America/Sao_Paulo';

    begin
      insert into public.reservas (quadra_id, inicio, fim, origem,
                                   motivo_bloqueio, criado_por,
                                   preco_centavos, serie_id)
      values (p_quadra_id, v_inicio,
              v_inicio + make_interval(mins => p_duracao_min),
              'bloqueio', nullif(p_motivo, ''), eu, 0, v_serie);
      v_criados := v_criados + 1;
    exception
      -- ⚠️ Horário já ocupado NÃO derruba a série inteira: o clube pediu
      -- "toda terça", e uma terça com jogo marcado é exceção, não erro.
      -- Pular e CONTAR é mais útil que falhar tudo — e o número devolvido
      -- deixa o clube saber que aquelas datas ficaram de fora.
      when exclusion_violation then
        v_pulados := v_pulados + 1;
    end;
  end loop;

  return jsonb_build_object(
    'serie_id', v_serie,
    'criados', v_criados,
    'pulados', v_pulados
  );
end;
$fn$;

revoke all on function public.bloquear_recorrente(uuid, smallint, time, integer, date, date, text)
  from public, anon;
grant execute on function public.bloquear_recorrente(uuid, smallint, time, integer, date, date, text)
  to authenticated;


-- ============================================================
-- REMOVER A SÉRIE
-- ============================================================
-- Só o que ainda não aconteceu. Apagar bloqueio passado reescreveria o
-- histórico de ocupação do clube.

create or replace function public.remover_serie_bloqueio(p_serie_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  v_qtd integer;
begin
  with apagados as (
    update public.reservas r
    set status = 'cancelada'
    from public.quadras q
    join public.clubes c on c.id = q.clube_id
    where r.quadra_id = q.id
      and r.serie_id = p_serie_id
      and r.origem = 'bloqueio'
      and r.status = 'confirmada'
      and r.inicio > now()
      and c.dono_id = eu
    returning 1
  )
  select count(*) into v_qtd from apagados;

  return v_qtd;
end;
$fn$;

revoke all on function public.remover_serie_bloqueio(uuid) from public, anon;
grant execute on function public.remover_serie_bloqueio(uuid) to authenticated;


-- ============================================================
-- COMO CONFERIR
-- ============================================================
-- Crie uma série e veja quantos entraram e quantos foram pulados:
--     select public.bloquear_recorrente('<quadra>', 2::smallint, '08:00',
--            60, current_date, current_date + 60, 'aula fixa');
--
-- Se houver reserva em alguma dessas terças, ela aparece em "pulados" e a
-- reserva do cliente continua intacta.
