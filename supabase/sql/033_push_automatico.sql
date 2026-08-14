-- Push automático: gatilho no instante do aviso + varredura de segurança
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ⚠️ ANTES DE RODAR, leia a seção 2: você precisa colar dois valores.
--
-- ============================================================
-- A FRESTA QUE ISTO FECHA
-- ============================================================
-- O aviso nasce no banco no instante certo. Mas quem PEDIA o envio da
-- notificação era o navegador de quem agiu — e se essa pessoa fechasse o
-- app antes, a notificação ficava esperando alguém fazer outra ação.
--
-- Agora quem pede é o próprio banco, por dois caminhos:
--
--  1. GATILHO — no instante em que avisos são criados. É o mecanismo
--     principal: a notificação sai em segundos.
--  2. VARREDURA a cada 15 min — rede de segurança. O `pg_net` é
--     "dispara e esquece": não tenta de novo. Se a rota estiver fora do ar
--     naquele segundo (um deploy acontecendo, por exemplo), sem a varredura
--     aquele aviso NUNCA viraria notificação. Não seria atraso: seria perda
--     silenciosa e permanente.
--
-- Os dois baterem na mesma rota é seguro porque ela é **idempotente**:
-- marca o que enviou (`avisos.push_enviado_em`) e não repete.
--
-- ⚠️ A varredura ignora avisos com mais de 24h, de propósito — push sobre
-- prazo vencido é barulho, não serviço.

create extension if not exists pg_net;

-- ============================================================
-- 1) ONDE MORAM O ENDEREÇO E O SEGREDO
-- ============================================================
-- RLS ligada e NENHUMA política: ninguém alcança esta tabela pelo app.
-- Só o SQL Editor (que roda como dono) e as funções `security definer`.
create table if not exists public.push_config (
  id boolean primary key default true check (id),
  url_base text not null,
  segredo text not null
);

alter table public.push_config enable row level security;

-- ============================================================
-- 2) ⚠️ VOCÊ PRECISA EDITAR ESTAS DUAS LINHAS ANTES DE RODAR
-- ============================================================
-- · url_base: o endereço do site, SEM barra no fim.
-- · segredo: invente uma senha longa e aleatória. Ela também vai na Vercel,
--   em Settings → Environment Variables, com o nome PUSH_SECRET. Os dois
--   valores têm de ser IDÊNTICOS — é assim que a rota reconhece o banco.
--
-- Não me mostre esse segredo, nem cole em chat nenhum.
insert into public.push_config (id, url_base, segredo)
values (true, 'https://padel-app-liart.vercel.app', 'COLE-AQUI-UM-SEGREDO-LONGO')
on conflict (id) do update
set url_base = excluded.url_base, segredo = excluded.segredo;

-- ============================================================
-- 3) A CHAMADA
-- ============================================================
-- Uma função só, usada pelo gatilho E pela varredura. Se a regra mudar,
-- muda num lugar e vale nos dois.
create or replace function public.push_chamar_envio()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  cfg public.push_config;
begin
  select * into cfg from public.push_config;
  if cfg.url_base is null or cfg.segredo is null then
    return;  -- sem configuração, não faz nada (e não quebra quem chamou)
  end if;

  perform net.http_post(
    url := cfg.url_base || '/api/push/enviar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', cfg.segredo
    ),
    body := '{}'::jsonb
  );
end;
$fn$;

revoke all on function public.push_chamar_envio() from public, anon, authenticated;

-- ============================================================
-- 4) O GATILHO — por COMANDO, não por linha
-- ============================================================
-- `registrar_set` cria três avisos de uma vez. Um gatilho por linha faria
-- três chamadas idênticas: a rota é idempotente, então não geraria
-- notificação repetida, mas seria desperdício. `for each statement` dispara
-- uma vez por operação.
create or replace function public.avisos_disparam_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.push_chamar_envio();
  return null;  -- gatilho AFTER: o retorno é ignorado
end;
$fn$;

drop trigger if exists trg_avisos_disparam_push on public.avisos;
create trigger trg_avisos_disparam_push
  after insert on public.avisos
  for each statement execute function public.avisos_disparam_push();

-- ============================================================
-- 5) A VARREDURA DE SEGURANÇA
-- ============================================================
-- A cada 15 minutos. Não é o mecanismo principal — é a garantia de que
-- nada fica esquecido de vez quando a chamada do gatilho não completa.
--
-- Se a próxima linha falhar dizendo que `cron` não existe, o agendador não
-- está habilitado no projeto: vá em Database → Extensions e ligue
-- `pg_cron`, depois rode esta seção de novo. O gatilho acima funciona
-- mesmo sem ela — você fica só sem a rede de segurança.
create extension if not exists pg_cron;

select cron.unschedule('push-varredura')
where exists (select 1 from cron.job where jobname = 'push-varredura');

select cron.schedule(
  'push-varredura',
  '*/15 * * * *',
  $$ select public.push_chamar_envio(); $$
);


-- ============================================================
-- COMO CONFERIR DEPOIS
-- ============================================================
-- Quantos avisos estão esperando push (deve ficar perto de zero):
--     select count(*) from public.avisos
--     where push_enviado_em is null and lido_em is null
--       and criado_em > now() - interval '24 hours';
--
-- As últimas chamadas HTTP que o banco fez:
--     select id, created, status_code from net._http_response
--     order by created desc limit 10;
--
-- A varredura está agendada?
--     select jobname, schedule, active from cron.job;
