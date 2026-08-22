-- ============================================================
-- 048 — CONSERTA O PAGAMENTO, QUEBRADO PELO SCRIPT 038
-- ============================================================
-- O fundador testou "Pagar minha parte" e recebeu "Não conseguimos gerar o
-- PIX". REPRODUZIDO no banco, com sessão real: o gravação do pagamento
-- devolve 403.
--
-- ⚠️ A CULPA É DO SCRIPT 038, NÃO DO GATEWAY. Lá eu revoguei a tabela
-- `pagamentos` e liberei coluna a coluna, para o CPF e o telefone da
-- fotografia do pagador não ficarem visíveis para os outros jogadores da
-- partida. A intenção estava certa e as travas funcionam — mas eu liberei
-- UPDATE só nas colunas que a tela ALTERA, e esqueci das duas que ela também
-- ENVIA no mesmo pedido: `partida_id` e `jogador_id`.
--
-- O app grava o pagamento com "cria ou atualiza" (upsert). Nesse comando o
-- Postgres exige UPDATE em TODAS as colunas do pedido, inclusive as que
-- servem de chave e cujo valor não muda. Faltando duas, o comando inteiro é
-- negado.
--
-- ⚠️ POR QUE ISSO PASSOU: depois do 038 eu conferi que as TELAS continuavam
-- carregando — Início, Minhas partidas, partida. Todas LEEM pagamento;
-- nenhuma ESCREVE. Verifiquei o caminho da leitura e declarei o trabalho
-- feito. Revogação de tabela mexe em ler E escrever, e eu só testei metade.

grant update (partida_id, jogador_id) on public.pagamentos to authenticated;

-- Isto NÃO afrouxa a privacidade: quem decide se a linha pode ser gravada
-- continua sendo a política de RLS (`pagamentos_gerencia_proprio`, corrigida
-- no script 022), que exige que a linha seja SUA e que você esteja na
-- partida. E as colunas da fotografia — pagador_nome, pagador_telefone,
-- pagador_cpf, pagador_email — seguem fechadas, que era o objetivo do 038.


-- ============================================================
-- COMO CONFERIR
-- ============================================================
-- Depois de rodar, o "Pagar minha parte" volta a funcionar.
--
-- E a trava do 038 continua de pé — isto ainda tem de dar 403 para um
-- jogador comum:
--     select pagador_cpf from public.pagamentos limit 1;
