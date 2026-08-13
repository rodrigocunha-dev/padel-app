-- Web Push — onde ficam as inscrições dos aparelhos
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- POR QUE ISTO EXISTE
-- ============================================================
-- A Decisão 1 inverteu a confirmação de resultado: **quem não contestar em
-- 24h concordou**. Isso só é justo se a pessoa teve **chance real de
-- saber** — senão vira "quem não abre o app concorda com tudo", que é uma
-- arapuca para quem usa o app com menos frequência.
--
-- O aviso DENTRO do app já existe (Início e Minhas partidas). O push é o
-- que alcança quem não abriu o app naquele dia.
--
-- ⚠️ CONFIRMADO EM 12/08/2026, e muda o alcance: **no iPhone o Web Push só
-- funciona se a pessoa adicionou o app à tela de início.** Não dá nem para
-- PEDIR permissão no Safari do iOS sem isso. Vale desde o iOS 16.4 e
-- alcança também Chrome e Edge no iPhone, que usam o mesmo motor. No
-- Android e no computador não há essa exigência.
--
-- Consequência de produto ainda EM ABERTO: o que fazer com quem não
-- instala. Decidir com o número real de alcance na mão, antes do beta.

-- ============================================================
-- 1) UMA LINHA POR APARELHO
-- ============================================================
-- A mesma pessoa pode ter o app no celular e no computador, e cada um tem
-- a sua inscrição. Por isso a chave é o `endpoint` (o endereço que o
-- navegador dá), não o jogador.
create table if not exists public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  jogador_id uuid not null references auth.users (id) on delete cascade,

  -- O endereço para onde o navegador quer receber. É único por aparelho e
  -- pode mudar sozinho — quando muda, o navegador reinscreve e a linha
  -- antiga vira lixo (ver limpeza no endpoint de envio).
  endpoint text not null unique,

  -- As duas chaves que criptografam a mensagem. Sem elas o envio falha.
  p256dh text not null,
  auth text not null,

  criado_em timestamptz not null default now(),
  -- Quando o serviço de push responde que a inscrição morreu (404/410),
  -- marcamos aqui em vez de apagar — assim dá para ver quanta gente
  -- desinstalou, que é dado de produto.
  invalidado_em timestamptz
);

create index if not exists push_por_jogador
  on public.push_inscricoes (jogador_id) where invalidado_em is null;

alter table public.push_inscricoes enable row level security;

-- Cada um gerencia só as próprias inscrições. Ninguém lê a de ninguém: o
-- endpoint é um endereço de entrega, e com ele daria para mandar
-- notificação para o aparelho de outra pessoa.
drop policy if exists "push_proprio" on public.push_inscricoes;
create policy "push_proprio"
  on public.push_inscricoes for all to authenticated
  using (jogador_id = (select auth.uid()))
  with check (jogador_id = (select auth.uid()));


-- ============================================================
-- 2) O AVISO PASSA A LEMBRAR SE JÁ FOI ENVIADO
-- ============================================================
-- Sem isto, cada varredura reenviaria tudo e a pessoa receberia o mesmo
-- aviso várias vezes — o jeito mais rápido de alguém desligar a permissão
-- e nunca mais voltar.
alter table public.avisos
  add column if not exists push_enviado_em timestamptz;

create index if not exists avisos_pendentes_de_push
  on public.avisos (push_enviado_em) where push_enviado_em is null;


-- ============================================================
-- 3) O QUE O SERVIDOR PRECISA PARA MONTAR A MENSAGEM
-- ============================================================
-- Devolve os avisos que ainda não foram enviados, já com o texto pronto e
-- os dados de entrega. É `security definer` porque precisa cruzar avisos,
-- sets e partidas de VÁRIAS pessoas — algo que nenhum jogador pode fazer.
--
-- Só é chamada pelo endpoint de envio, com a chave de serviço; está
-- revogada de todo mundo do lado do app.
create or replace function public.push_pendentes(p_limite integer default 200)
returns table (
  aviso_id uuid,
  inscricao_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  titulo text,
  corpo text,
  url text,
  tag text
)
language sql
security definer
set search_path = public
stable
as $fn$
  select a.id, i.id, i.endpoint, i.p256dh, i.auth,
         case a.tipo
           when 'set_registrado' then 'Registraram um resultado do seu jogo'
           when 'votacao_aberta' then 'Há um placar em disputa'
           else 'Novidade no app'
         end,
         case a.tipo
           when 'set_registrado' then 'Confira. Se não estiver certo, você tem 24h para contestar.'
           when 'votacao_aberta' then 'Você estava lá. Toque para dizer qual placar está certo.'
           else 'Toque para ver.'
         end,
         '/app/partidas/' || s.partida_id,
         a.tipo
  from public.avisos a
  join public.sets s on s.id = a.set_id
  join public.push_inscricoes i on i.jogador_id = a.jogador_id
  where a.push_enviado_em is null
    and a.lido_em is null          -- já leu dentro do app: não incomoda
    and i.invalidado_em is null
    -- Aviso velho não vira notificação: se ficou parado, o prazo de 24h
    -- provavelmente já passou e o push chegaria como notícia inútil.
    and a.criado_em > now() - interval '24 hours'
  order by a.criado_em
  limit p_limite;
$fn$;

revoke all on function public.push_pendentes(integer) from public, anon, authenticated;


-- ============================================================
-- 4) MARCAR COMO ENVIADO / INVALIDAR INSCRIÇÃO MORTA
-- ============================================================
create or replace function public.push_marcar_enviados(p_avisos uuid[])
returns void
language sql
security definer
set search_path = public
as $fn$
  update public.avisos set push_enviado_em = now()
  where id = any(p_avisos) and push_enviado_em is null;
$fn$;

create or replace function public.push_invalidar(p_inscricoes uuid[])
returns void
language sql
security definer
set search_path = public
as $fn$
  update public.push_inscricoes set invalidado_em = now()
  where id = any(p_inscricoes) and invalidado_em is null;
$fn$;

revoke all on function public.push_marcar_enviados(uuid[]) from public, anon, authenticated;
revoke all on function public.push_invalidar(uuid[]) from public, anon, authenticated;
