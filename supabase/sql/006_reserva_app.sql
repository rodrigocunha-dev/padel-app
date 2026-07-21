-- Sprint 3 — Reserva pelo app, tempo real e política de cancelamento
-- Rode no Supabase: SQL Editor → New query → colar → Run.
-- (Pode rodar mais de uma vez sem estragar nada.)

-- ============================================================
-- 1) POLÍTICA DE CANCELAMENTO QUE O SISTEMA ENTENDE
-- O texto livre (politica_cancelamento) continua para detalhes;
-- este número é o que o sistema faz valer.
-- ============================================================
alter table public.clubes
  add column if not exists horas_limite_cancelamento smallint not null default 12
    check (horas_limite_cancelamento between 0 and 168);

-- ============================================================
-- 2) PREÇO GRAVADO NA RESERVA
-- Se o clube mudar a tabela de preços depois, o que foi combinado
-- com o jogador não muda.
-- ============================================================
alter table public.reservas
  add column if not exists preco_centavos integer;

-- ============================================================
-- 3) ESPELHO PÚBLICO DA AGENDA (LGPD + tempo real)
-- Cópia enxuta das reservas confirmadas: SÓ quadra e horário.
-- Nome e telefone de quem reservou NUNCA entram aqui. É esta tabela
-- que o app do jogador lê e acompanha em tempo real.
-- ============================================================
create table if not exists public.agenda_publica (
  reserva_id uuid primary key references public.reservas (id) on delete cascade,
  quadra_id uuid not null references public.quadras (id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null
);

create index if not exists agenda_publica_quadra_periodo
  on public.agenda_publica (quadra_id, inicio, fim);

alter table public.agenda_publica enable row level security;

drop policy if exists "agenda_publica_leitura_autenticada" on public.agenda_publica;
create policy "agenda_publica_leitura_autenticada"
  on public.agenda_publica for select
  to authenticated
  using (true);
-- Sem policy de escrita de propósito: só o gatilho abaixo escreve aqui.

create or replace function public.sincronizar_agenda_publica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    delete from public.agenda_publica where reserva_id = old.id;
    return old;
  end if;

  if (new.status = 'confirmada') then
    insert into public.agenda_publica (reserva_id, quadra_id, inicio, fim)
    values (new.id, new.quadra_id, new.inicio, new.fim)
    on conflict (reserva_id) do update
      set quadra_id = excluded.quadra_id,
          inicio = excluded.inicio,
          fim = excluded.fim;
  else
    -- cancelada: some do espelho, liberando o horário
    delete from public.agenda_publica where reserva_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists espelhar_agenda on public.reservas;
create trigger espelhar_agenda
  after insert or update or delete on public.reservas
  for each row execute function public.sincronizar_agenda_publica();

-- Preenche o espelho com o que já existe hoje
insert into public.agenda_publica (reserva_id, quadra_id, inicio, fim)
select r.id, r.quadra_id, r.inicio, r.fim
from public.reservas r
where r.status = 'confirmada'
on conflict (reserva_id) do nothing;

-- ============================================================
-- 4) RESERVA PELO APP — tudo validado no servidor, de uma vez só
-- Confere horário de funcionamento, calcula o preço e grava.
-- Se duas pessoas confirmarem o mesmo horário no mesmo instante,
-- a trava do banco (exclusion constraint) deixa só uma passar.
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

  if p_fim <= p_inicio then
    raise exception 'PERIODO_INVALIDO' using errcode = 'P0001';
  end if;

  if p_inicio < now() then
    raise exception 'HORARIO_PASSADO' using errcode = 'P0001';
  end if;

  -- O período precisa caber inteiro numa faixa de preço do dia da semana
  -- (faixa cadastrada = clube funcionando naquele horário).
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

revoke all on function public.reservar_quadra(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.reservar_quadra(uuid, timestamptz, timestamptz) to authenticated;

-- ============================================================
-- 5) JOGADOR EDITA/CANCELA A PRÓPRIA RESERVA
-- ============================================================
drop policy if exists "reservas_jogador_edita_propria" on public.reservas;
create policy "reservas_jogador_edita_propria"
  on public.reservas for update
  to authenticated
  using ((select auth.uid()) = jogador_id and origem = 'app')
  with check ((select auth.uid()) = jogador_id and origem = 'app');

-- ...mas só dentro da política do clube. A trava vale no servidor:
-- não adianta burlar a tela.
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
  -- Nada muda? Deixa passar.
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

  -- O clube (dono) e rotinas administrativas não são limitados pela
  -- política: ela existe para proteger o clube, não para travá-lo.
  if v_usuario is null or v_usuario = v_dono then
    return new;
  end if;

  if old.inicio - now() < make_interval(hours => coalesce(v_limite, 12)::int) then
    raise exception 'FORA_DO_PRAZO' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists reserva_respeita_politica on public.reservas;
create trigger reserva_respeita_politica
  before update on public.reservas
  for each row execute function public.checar_politica_reserva();

-- ============================================================
-- 6) TEMPO REAL
-- O app do jogador acompanha o espelho público (sem dados pessoais);
-- o painel do clube acompanha as próprias reservas (o RLS garante que
-- cada clube só recebe o que é dele).
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.agenda_publica;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.reservas;
  exception when duplicate_object then null;
  end;
end $$;
