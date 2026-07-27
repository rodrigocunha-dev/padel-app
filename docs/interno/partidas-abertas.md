# Partidas abertas e pagamento simulado (Sprint 4)

## O que é
O jogador cria uma partida aberta num clube (faixa de categoria, competitiva/amistosa, sexo do jogo, 4 a 8 jogadores), outros jogadores compatíveis encontram no feed e entram em 1 toque. O valor da quadra é dividido entre os jogadores, com pagamento **simulado** (mock) e cobrança dos pendentes por WhatsApp.

## Onde fica no código
- Criar: `src/app/app/clubes/[id]/criar-partida/page.tsx` + `src/components/partidas/CriarPartida.tsx`
- Feed: `src/app/app/partidas/page.tsx` + `src/components/partidas/FeedPartidas.tsx`
- Tela da partida: `src/app/app/partidas/[id]/page.tsx` + `src/components/partidas/PartidaDetalhe.tsx`
- Pagamento: `src/components/partidas/PagamentoPartida.tsx`
- Regras compartilhadas: `src/lib/partidas.ts` (split, compatibilidade, rótulos)
- Completar perfil (sexo): `src/app/app/completar-perfil/` + `src/components/CompletarPerfil.tsx`
- **Costura do pagamento:** `src/lib/pagamentos/` + `src/app/api/pagamentos/confirmar/route.ts`
- Banco: `supabase/sql/008` (partidas, sexo, telefone privado), `009` (dados públicos da partida), `010` (pagamentos, split, inadimplente), `011` (leitura do split só para jogadores)

## Regras de negócio embutidas
- **Competitiva só com 4 jogadores** (regra nº 5): 5+ é revezamento (amistoso), não conta para o rating. A função `criar_partida` recusa competitiva com nº ≠ 4.
- **Compatibilidade:** o jogador só entra se a categoria dele está na faixa e o sexo bate com o sexo do jogo (mista aceita todos). Mesma regra no banco (`jogador_compativel`) e no feed (`jogadorCompativel`, para já filtrar na tela).
- **Fila de substitutos:** ao encher (nº de jogadores = máximo), quem entra vira `substituto`. Quando um jogador sai, o primeiro da fila é promovido automaticamente. O organizador não "sai" — ele cancela a partida.
- **Split sem taxa** (regra nº 1): valor da quadra dividido em partes iguais; a sobra de centavos vai para os primeiros da lista. O jogador nunca paga taxa de conveniência.

## Reserva na confiança (decisão de modelo)
A quadra é confirmada na hora (reusa `reservar_quadra` do Sprint 3, via `criar_partida`). O pagamento é um "caderninho" por cima que **NÃO trava a reserva**. A partida carrega o próprio horário/quadra/preço (colunas em `partidas`, script 009) porque a **reserva é privada** (LGPD) e o feed de outro jogador precisa ver esses dados — não dá para ler da reserva alheia.

## Privacidade (LGPD)
- **Telefone do jogador fechado** (script 008): ninguém lê a coluna `telefone` da tabela `jogadores` por consulta normal (column privileges). Volta só pela função `contato_jogadores_partida`, e **apenas para o organizador** da partida — é o que alimenta o botão de cobrança por WhatsApp.
- **Split visível só para jogadores ativos** (script 011): quem vê quem pagou são os jogadores que estão jogando — nem substitutos, nem quem só visita a partida, nem o clube. Verificado: jogador que saiu lê 0 linhas de pagamento.

## Bloqueio do caloteiro (regra decidida com o fundador)
Um jogador é inadimplente (`jogador_inadimplente`) se jogou uma partida que **já aconteceu**, passou **24h do fim** e não tem pagamento `pago`. Enquanto inadimplente, não cria nem entra em nova partida (`PENDENCIA`). **Partida futura nunca conta** — a pessoa pode ter vários jogos marcados e não pagos sem ser bloqueada. Pagou → desbloqueado na hora. Testado nos dois sentidos. As 24h são provisórias (validar com clubes/jogadores); a configuração por clube fica para o gateway real.

## A costura do pagamento (troca fácil de gateway)
Todo o app conversa só com o contrato em `src/lib/pagamentos/tipos.ts`. `index.ts` escolhe o gateway por variável de ambiente (`NEXT_PUBLIC_PAGAMENTO_PROVEDOR`, padrão `simulado`). `simulado.ts` é a única peça descartável (gera QR e copia-e-cola falsos). O endpoint `/api/pagamentos/confirmar` é **o mesmo** que o gateway real vai chamar quando o PIX cair; no mock, quem chama é o botão "Simular pagamento confirmado" (só aparece enquanto o gateway é o simulado). Trocar pelo real = escrever `iugu.ts`/`mercadopago.ts` no mesmo formato + apontar a env + ajustar a autorização do endpoint (hoje: sessão do jogador; no real: assinatura do webhook + chave de serviço).

## Minhas partidas (`/app/partidas/minhas`)
Lista as partidas em que o jogador é/foi **jogador ativo** (substituto que nunca jogou não entra), exceto canceladas. Cada item mostra dois status bem visíveis:
- **Status da partida:** Futura (fim > agora) ou Jogada (fim ≤ agora).
- **Status de pagamento:** Paga (tem pagamento pago) · Aguardando pagamento (ainda no prazo ou futura) · Inadimplente (passou fim + 24h sem pagar).

Tem filtros por esses dois status. Fecha um buraco real: antes, a partida vencida do inadimplente não aparecia em lugar nenhum — o jogador não conseguia achar nem pagar. Agora ele acha em "Minhas partidas", toca, e a tela da partida (mesma `PagamentoPartida`) deixa ele pagar e se desbloquear. Regras em `src/lib/partidas.ts` (`statusDaPartida`, `statusDoPagamento`); página em `src/app/app/partidas/minhas/` + `src/components/partidas/MinhasPartidas.tsx`.

**Decisão registrada (CLAUDE.md):** não haverá seção "Financeira" separada — "Minhas partidas" filtrada por "Inadimplente" já é a visão financeira.

## O que ficou para o sprint do gateway real
Ver "Ideias Futuras" no CLAUDE.md — o pacote do modelo de pagamento: quem assume o risco do calote, partida aberta com estranhos exigindo pagar-ao-entrar, e o que o clube vê sobre pagamentos.

## Métricas (PostHog)
`perfil_completado`, `partida_criada`, `partida_entrou`, `partida_saiu`, `partida_cancelada`, `pagamento_iniciado`, `pagamento_confirmado_simulado`, `cobranca_whatsapp_aberta`.
