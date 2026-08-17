-- ============================================================
-- 037 — O MOTOR DE RATING PASSA A RODAR SOZINHO
-- ============================================================
-- Até aqui `recalcular_ratings()` só rodava quando o fundador executava o
-- comando à mão no SQL Editor. Na prática isso deixava o motor inerte: um
-- jogador registrava o set, esperava as 24h da janela de contestação, e a
-- categoria dele NÃO mudava até alguém lembrar de rodar.
--
-- Não é bug do motor — ele nunca foi agendado. Este script fecha isso.
--
-- Reusa o mesmo mecanismo do script 033 (pg_cron), que já está rodando em
-- produção para as notificações.


-- ============================================================
-- 1) O REGISTRO DE CADA EXECUÇÃO
-- ============================================================
-- Existe para responder UMA pergunta com dado, e não com palpite: "a hora em
-- hora ainda dá conta?".
--
-- A conta é refeita do ZERO a cada vez (decisão do item 10 do motor, que é o
-- que a torna reproduzível). Isso é barato hoje e vai encarecendo conforme
-- os sets se acumulam. Sem medir cada rodada, o dia de mudar a frequência
-- chegaria como surpresa — provavelmente na forma de execuções se atropelando.

create table if not exists public.rating_execucoes (
  id           bigint generated always as identity primary key,
  rodou_em     timestamptz not null default now(),
  duracao_ms   integer,
  blocos       integer,     -- quantos blocos-dia a conta processou
  jogadores    integer,     -- quantos jogadores têm rating ao fim
  origem       text not null default 'agendado',
  erro         text         -- preenchido só quando a rodada falha
);

comment on table public.rating_execucoes is
  'Uma linha por recálculo de rating. Serve para decidir a frequência do agendamento com dado medido, não por estimativa.';

-- Dado operacional, não dado de jogador: ninguém no app lê isto.
-- RLS ligada sem política nenhuma = fechado para todo mundo, exceto quem
-- roda como dono (o agendador) — que é exatamente o desejado.
alter table public.rating_execucoes enable row level security;

revoke all on public.rating_execucoes from anon, authenticated;


-- ============================================================
-- 2) A CHAMADA AGENDADA
-- ============================================================
-- Envolve o recálculo para cronometrar e registrar. O `exception` é o ponto
-- importante: uma rodada que falha NÃO pode derrubar o agendamento nem
-- passar despercebida — ela grava o erro e devolve o controle.

create or replace function public.recalcular_ratings_agendado(
  p_origem text default 'agendado'
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_inicio timestamptz := clock_timestamp();
  v_blocos integer;
begin
  v_blocos := public.recalcular_ratings();

  -- `epoch` devolve o intervalo inteiro em segundos (com fração), então
  -- × 1000 dá o total em milissegundos. Não usar `milliseconds` + `seconds`
  -- somados: no Postgres os dois se sobrepõem (`milliseconds` já inclui os
  -- segundos), e a soma contaria o mesmo tempo duas vezes.
  insert into public.rating_execucoes (duracao_ms, blocos, jogadores, origem)
  values (
    (extract(epoch from (clock_timestamp() - v_inicio)) * 1000)::integer,
    v_blocos,
    (select count(*) from public.rating_jogadores),
    p_origem
  );

  return v_blocos;
exception
  when others then
    -- Grava a falha e segue. Sem isto, um erro numa rodada só apareceria
    -- como "a categoria de todo mundo parou de mudar", dias depois.
    insert into public.rating_execucoes (duracao_ms, origem, erro)
    values (
      (extract(epoch from (clock_timestamp() - v_inicio)) * 1000)::integer,
      p_origem,
      sqlerrm
    );
    return -1;
end;
$fn$;

-- Mesma trava do `recalcular_ratings` (lição do script 026): `revoke ... from
-- public, anon` NÃO alcança `authenticated` neste banco, e sem nomear
-- `authenticated` qualquer pessoa logada consegue mandar o motor recalcular.
revoke all on function public.recalcular_ratings_agendado(text)
  from public, anon, authenticated;


-- ============================================================
-- 3) O AGENDAMENTO
-- ============================================================
-- DE HORA EM HORA, e não uma vez por dia.
--
-- Motivo: o set vira válido 24h depois de registrado. Com uma rodada diária,
-- alguém que jogou às 21h esperaria até DOIS dias para ver a categoria mexer
-- — as 24h da janela mais o tempo até a próxima rodada. Isso briga com a
-- regra nº 4 (transparência: mostrar quanto mudou e por quê), que só vale
-- se a mudança aparecer perto do jogo.
--
-- De hora em hora, a espera extra é de no máximo 1 hora.
--
-- ⚠️ Isto NÃO muda o resultado da conta: o bloco continua sendo o DIA
-- (item 11 do motor). Rodar mais vezes só faz o mesmo resultado aparecer
-- mais cedo — nunca produz números diferentes.
--
-- Se a linha abaixo falhar dizendo que `cron` não existe, ligue `pg_cron`
-- em Database → Extensions e rode esta seção de novo.
create extension if not exists pg_cron;

select cron.unschedule('rating-recalculo')
where exists (select 1 from cron.job where jobname = 'rating-recalculo');

select cron.schedule(
  'rating-recalculo',
  '7 * * * *',   -- aos 7 minutos de cada hora
  $$ select public.recalcular_ratings_agendado('agendado'); $$
);

-- Por que aos :07 e não aos :00 — a varredura do push roda a cada 15 min,
-- batendo em :00, :15, :30 e :45. Fora desses minutos, as duas tarefas não
-- disputam o banco à toa.


-- ============================================================
-- 4) UMA PRIMEIRA RODADA AGORA
-- ============================================================
-- Para não esperar até a virada da hora e já deixar uma linha medida.
select public.recalcular_ratings_agendado('primeira-execucao');


-- ============================================================
-- COMO CONFERIR DEPOIS
-- ============================================================
-- Está agendado?
--     select jobname, schedule, active from cron.job;
--
-- As últimas rodadas (o que interessa: `erro` vazio e `duracao_ms` estável):
--     select rodou_em, duracao_ms, blocos, jogadores, origem, erro
--     from public.rating_execucoes order by rodou_em desc limit 20;
--
-- Alguma rodada falhou nas últimas 24h?
--     select count(*) from public.rating_execucoes
--     where erro is not null and rodou_em > now() - interval '24 hours';
--
-- ⚠️ QUANDO MUDAR A FREQUÊNCIA: se `duracao_ms` passar de uns poucos
-- segundos, a hora em hora deixa de ser confortável. A saída não é
-- necessariamente rodar menos — é o recálculo deixar de refazer tudo do
-- zero, o que é uma decisão de arquitetura (ver item 10 do motor) e não
-- um ajuste de agenda.
