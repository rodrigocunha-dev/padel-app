-- Sprint 5 (privacidade) — quem PODE VER uma partida
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- O QUE ESTE SCRIPT MUDA
-- ============================================================
-- Até aqui, `partidas` e `partida_jogadores` eram legíveis por QUALQUER
-- pessoa logada (`using (true)`, script `008`). Na época estava certo:
-- só existia partida aberta, e partida aberta é pública por definição —
-- o feed precisa mostrá-la para quem ainda não está nela.
--
-- Depois do script `014` passou a existir a SESSÃO PRIVADA, e a mesma
-- regra virou vazamento: qualquer pessoa logada conseguia listar todas as
-- sessões privadas do app e ver quem foi convidado para o quê.
--
-- É o último pedaço da mesma pergunta que rendeu os scripts `017`, `021` e
-- `022`: *"isto vale para quem só foi convidado?"*. Os anteriores trataram
-- de AGIR (entrar, pagar, cobrar). Este trata de VER.
--
-- ============================================================
-- A REGRA, EM UMA FRASE
-- ============================================================
--   Você vê uma partida se ela é ABERTA, ou se você tem QUALQUER vínculo
--   com ela.
--
-- "Qualquer vínculo" = ter uma linha em `partida_jogadores`, seja qual for
-- o estado. Deliberadamente NÃO é uma lista de estados.
--
-- Por que não listar estados: a lista teria de ser revisitada a cada estado
-- novo (o 'saiu' já nasceu depois, no `018`), e foi exatamente esse tipo de
-- lista desatualizada que produziu os furos dos scripts `017` a `022`.
-- Além disso, os dois casos que uma lista tenderia a excluir precisam ficar
-- de fora do corte:
--   · quem RECUSOU está olhando a tela no instante em que recusa — perder o
--     acesso no meio do clique vira erro na cara da pessoa;
--   · quem DESISTIU tem pagamento naquela partida (decisão de 04/08/2026).
-- Nenhum dos dois é risco: os dois foram convidados e já sabiam do jogo.
--
-- O organizador não precisa de caso especial — `criar_partida` e
-- `criar_sessao` já gravam a linha dele como 'aceito'. A checagem por
-- `organizador_id` abaixo é só cinto de segurança.

-- ============================================================
-- 1) A FUNÇÃO ÚNICA QUE RESPONDE A PERGUNTA
-- ============================================================
-- Uma função só, usada pelas DUAS políticas. Se a regra mudar um dia, muda
-- aqui e vale nos dois lugares — não há como as duas divergirem.
--
-- Ela é `security definer` de propósito, e isso é o que evita um LOOP: a
-- política de `partidas` precisa consultar `partida_jogadores`, e a de
-- `partida_jogadores` precisa consultar `partidas`. Se cada política
-- consultasse a outra tabela diretamente, uma chamaria a política da outra
-- para sempre. Rodando como dona das tabelas, a função lê as duas sem
-- disparar política nenhuma, e o ciclo não chega a existir.
create or replace function public.posso_ver_partida(p_partida_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $fn$
  select exists (
    select 1
    from public.partidas p
    where p.id = p_partida_id
      and (
        p.tipo = 'aberta'
        or p.organizador_id = (select auth.uid())
        or exists (
          select 1
          from public.partida_jogadores pj
          where pj.partida_id = p.id
            and pj.jogador_id = (select auth.uid())
        )
      )
  );
$fn$;

revoke all on function public.posso_ver_partida(uuid) from public, anon;
grant execute on function public.posso_ver_partida(uuid) to authenticated;


-- ============================================================
-- 2) AS DUAS POLÍTICAS DE LEITURA
-- ============================================================
drop policy if exists "partidas_leitura_autenticada" on public.partidas;
create policy "partidas_leitura_quem_pode_ver"
  on public.partidas for select to authenticated
  using (public.posso_ver_partida(id));

drop policy if exists "partida_jogadores_leitura_autenticada" on public.partida_jogadores;
create policy "partida_jogadores_leitura_quem_pode_ver"
  on public.partida_jogadores for select to authenticated
  using (public.posso_ver_partida(partida_id));

-- A escrita continua como estava: só pelas funções `security definer`
-- (entrar, sair, convidar, responder, desistir, remover). Nada aqui afrouxa
-- ou aperta escrita.


-- ============================================================
-- O QUE NÃO MUDA, E POR QUÊ
-- ============================================================
-- · O FEED de partidas abertas continua inteiro: partida aberta é pública
--   pela primeira condição, para quem está nela e para quem não está.
-- · A AGENDA do clube não usa estas tabelas — ela lê `reservas`, e o que o
--   jogador enxerga de ocupação vem de `agenda_publica` (script `006`),
--   que tem só quadra, início e fim. Nada aqui mexe nisso.
-- · O TEMPO REAL passa a respeitar a mesma regra de brinde: o Realtime
--   aplica RLS, então mudanças de uma sessão privada deixam de ser
--   entregues a quem não é dela.
--
-- ============================================================
-- O QUE ESTE SCRIPT NÃO RESOLVE (registrado de propósito)
-- ============================================================
-- A tabela `jogadores` continua legível por qualquer pessoa logada, e isso
-- é NECESSÁRIO hoje: é assim que a busca por nome acha alguém para
-- convidar. Não é furo, é uma decisão de privacidade em aberto — para ser
-- olhada junto com o "nome de usuário (@)" do banco de ideias, não aqui.
