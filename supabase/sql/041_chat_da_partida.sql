-- ============================================================
-- 041 — CHAT DA PARTIDA
-- ============================================================
-- Entrega 4, e o último item do Módulo 1.6 que faltava. Não depende de
-- fornecedor nenhum: o Supabase Realtime já roda no projeto desde o
-- Sprint 3 (a agenda usa três canais).
--
-- Vale para os DOIS tipos de partida. A conversa de "quem leva as bolas" e
-- "vou atrasar 10 minutos" é a mesma, seja com amigos ou com desconhecidos.


-- ============================================================
-- 1) AS MENSAGENS
-- ============================================================
-- Sem editar e sem apagar, de propósito. Chat de grupo em que dá para
-- reescrever o passado é chat em que ninguém confia no combinado — e o
-- combinado ("levo eu as bolas") é justamente para o que ele serve aqui.

create table if not exists public.mensagens (
  id         uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.partidas (id) on delete cascade,
  autor_id   uuid not null references auth.users (id) on delete cascade,
  texto      text not null check (length(trim(texto)) between 1 and 500),
  criado_em  timestamptz not null default now()
);

create index if not exists idx_mensagens_partida
  on public.mensagens (partida_id, criado_em);

alter table public.mensagens enable row level security;


-- ============================================================
-- 2) QUEM PARTICIPA DA CONVERSA
-- ============================================================
-- ⚠️ É MAIS ESTREITO que `posso_ver_partida` (script 023), e isso é a
-- decisão. Aquela função responde "posso VER esta partida?" — e quem só
-- olha uma partida aberta no feed pode ver. Conversar é outra coisa: entra
-- quem está DENTRO do jogo.
--
-- Fora ficam: quem só visita, quem foi convidado e ainda não aceitou, quem
-- recusou, quem saiu, e o substituto na fila. O substituto entra na conversa
-- no instante em que for promovido a jogador — sem nada a mais, porque a
-- regra olha o estado atual, não um registro à parte.

create or replace function public.estou_na_conversa(p_partida_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $fn$
  select exists (
    select 1 from public.partida_jogadores pj
    where pj.partida_id = p_partida_id
      and pj.jogador_id = (select auth.uid())
      and pj.papel = 'jogador'
      and pj.estado = 'aceito'
  );
$fn$;

revoke all on function public.estou_na_conversa(uuid) from public, anon;
grant execute on function public.estou_na_conversa(uuid) to authenticated;

drop policy if exists "mensagens_leitura" on public.mensagens;
create policy "mensagens_leitura"
  on public.mensagens for select to authenticated
  using (public.estou_na_conversa(partida_id));

-- Escrever exige as duas coisas: estar na conversa E ser você mesmo. Sem a
-- segunda, um participante poderia gravar mensagem no nome de outro.
drop policy if exists "mensagens_escrita" on public.mensagens;
create policy "mensagens_escrita"
  on public.mensagens for insert to authenticated
  with check (
    public.estou_na_conversa(partida_id)
    and autor_id = (select auth.uid())
  );


-- ============================================================
-- 3) TEMPO REAL
-- ============================================================
-- A mensagem aparece na tela de quem está com o app aberto, sem recarregar.
-- Mesmo mecanismo da agenda do clube.
--
-- A RLS continua valendo no Realtime: quem não passa na política acima não
-- recebe o evento.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'mensagens'
  ) then
    alter publication supabase_realtime add table public.mensagens;
  end if;
end $$;


-- ============================================================
-- 4) QUANTAS NÃO LI
-- ============================================================
-- Guarda até onde cada pessoa leu, por partida. Um marcador por pessoa, e
-- não um "lido" por mensagem: com 6 jogadores e 200 mensagens seriam 1.200
-- linhas para responder uma pergunta que o marcador responde com uma.

create table if not exists public.leitura_chat (
  partida_id uuid not null references public.partidas (id) on delete cascade,
  jogador_id uuid not null references auth.users (id) on delete cascade,
  lido_ate   timestamptz not null default now(),
  primary key (partida_id, jogador_id)
);

alter table public.leitura_chat enable row level security;

drop policy if exists "leitura_chat_propria" on public.leitura_chat;
create policy "leitura_chat_propria"
  on public.leitura_chat for all to authenticated
  using (jogador_id = (select auth.uid()))
  with check (jogador_id = (select auth.uid()));

create or replace function public.marcar_chat_lido(p_partida_id uuid)
returns void
language sql
security definer
set search_path = public
as $fn$
  insert into public.leitura_chat (partida_id, jogador_id, lido_ate)
  values (p_partida_id, (select auth.uid()), now())
  on conflict (partida_id, jogador_id)
  do update set lido_ate = now();
$fn$;

revoke all on function public.marcar_chat_lido(uuid) from public, anon;
grant execute on function public.marcar_chat_lido(uuid) to authenticated;

-- Quantas mensagens não lidas eu tenho, por partida. Uma consulta só para a
-- lista inteira de "Minhas partidas".
create or replace function public.meus_nao_lidos()
returns table (partida_id uuid, nao_lidas bigint)
language sql
security definer
set search_path = public
stable
as $fn$
  select m.partida_id, count(*)
  from public.mensagens m
  join public.partida_jogadores pj
    on pj.partida_id = m.partida_id
   and pj.jogador_id = (select auth.uid())
   and pj.papel = 'jogador'
   and pj.estado = 'aceito'
  left join public.leitura_chat l
    on l.partida_id = m.partida_id
   and l.jogador_id = (select auth.uid())
  where m.autor_id <> (select auth.uid())
    and (l.lido_ate is null or m.criado_em > l.lido_ate)
  group by m.partida_id;
$fn$;

revoke all on function public.meus_nao_lidos() from public, anon;
grant execute on function public.meus_nao_lidos() to authenticated;


-- ============================================================
-- ⚠️ O QUE ESTE SCRIPT NÃO FAZ, E POR QUÊ
-- ============================================================
-- NÃO manda push a cada mensagem. Push por mensagem transforma uma conversa
-- de 20 linhas em 20 vibrações no bolso de 5 pessoas — e o caminho de volta
-- disso é a pessoa desligar as notificações do app inteiro, perdendo junto
-- os avisos que importam (resultado registrado, votação aberta).
--
-- Hoje a mensagem chega em tempo real para quem está com o app aberto, e o
-- contador de não lidas mostra o resto. Se o beta mostrar que falta aviso,
-- o caminho é um resumo espaçado ("3 mensagens novas no seu jogo de hoje"),
-- não um push por mensagem — e isso é decisão de produto, não ajuste.


-- ============================================================
-- COMO CONFERIR
-- ============================================================
-- Quem NÃO está na partida não pode ler nem escrever:
--     select * from public.mensagens where partida_id = '<partida alheia>';
--     -- deve voltar vazio, mesmo logado
--
-- Contador de não lidas:
--     select * from public.meus_nao_lidos();
