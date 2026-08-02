# Sessões em grupo, convite com aceite, sets e contestação (Sprint 5, Entrega A)

## O que é
A reserva de quadra passa a poder virar uma **sessão**: um jogo com participantes identificados, que aceitaram o convite. Dentro dela, **cada set é um mini-resultado** entre duas duplas, que pode ser contestado e resolvido por votação do grupo.

Isso existe por um motivo específico: até aqui, "Reservar quadra" gravava **um único jogador**. O sistema não sabia quem jogou, então aquele jogo **nunca poderia registrar resultado nem afetar o rating** — e é justamente por ali que passa o grupo fixo de amigos, que é a maior fatia do padel real. Sem sessão, o motor de rating enxergaria só os jogos feitos com desconhecidos.

**Nada aqui calcula rating.** O motor é o próximo passo e lê o que isto grava.

## Onde fica no código
- Banco: `supabase/sql/014_sessoes_e_sets.sql`
- Montar o jogo: botão em `src/components/reservas/MinhasReservas.tsx`
- Tela da sessão: `src/app/app/partidas/[id]/page.tsx` (ramo `tipo === 'privada'`)
- Convite e aceite: `src/components/partidas/ConvidarParticipantes.tsx`
- Sets, contestação e votação: `src/components/partidas/SetsDaSessao.tsx`
- Avisos e convites pendentes: `src/app/app/partidas/minhas/page.tsx`

## Modelo de dados — e por que não criei uma tabela `sessoes`
`partidas` ganhou um campo **`tipo`** (`aberta` | `privada`) em vez de existir uma tabela separada.

Motivo: a partida privada **pode ter vagas abertas** (o caso híbrido já aprovado). Com duas tabelas, o híbrido ficaria metade em cada uma. Com um tipo, ele é só uma partida privada com vaga sobrando — e os sets e o rating leem de um lugar só.

**Categoria e sexo do jogo viraram opcionais**, porque numa sessão privada não há estranho para filtrar. Mas continuam **obrigatórios na partida aberta**, garantidos pela trava `aberta_exige_filtros` no banco. Tornar a coluna aceitável como vazia é uma coisa; permitir criar uma partida aberta sem ela é outra — só a primeira aconteceu.

`partida_jogadores` ganhou **`estado`** (`convidado` → `aceito` / `recusado`), mais `telefone` e `jogador_id` opcional. Os dois últimos não são usados ainda: preparam a Entrega B (convite por telefone de quem não tem conta) para não virar migração de tabela com dados vivos.

## Conta obrigatória — onde a regra passa a viver
Até este sprint, **ninguém era adicionado por terceiros**: `partida_jogadores` não tem política de inserção (o RLS bloqueia) e todas as funções usam `auth.uid()`, ou seja, cada pessoa só se adicionava.

O convite é a **primeira** função que adiciona outra pessoa. Por isso a regra mora nela: `convidar_participante` recusa com `PRECISA_TER_CONTA` se não houver perfil.

## Os quatro portões para um set contar
Calculados por `situacao_do_set`, **na leitura** — não em estado gravado. Assim não é preciso uma tarefa agendada virando estados quando as 24h passam.

| Portão | Bloqueia rating | Bloqueia histórico e gamificação |
|---|---|---|
| Declaração competitiva (na criação, congelada no início) | Sim | Não |
| Set completo (6-0…6-4, 7-5, 7-6) | Sim | Não |
| Não contestado em 24h, ou vencedor da votação | Sim | Não |
| **Origem no app** | Sim | **Sim** — exceção suprema |

Sets incompletos **podem ser gravados**: viram histórico, só não contam. A Decisão 1 diz que eles "nunca contam, mesmo que confirmados", o que implica que existem.

## A inversão: silêncio vale como concordância
A primeira versão exigia confirmação ativa. O fundador achou o furo: assim **quem perde ganha ficando quieto**, e entre estranhos não existe pressão social para corrigir.

Invertido: o set **conta se ninguém contestar em 24h**. O abuso muda de lugar (contestar de má-fé), mas contestar é uma **ação registrada** e sumir não é — dá para medir e alimentar a reputação de conduta, o que com a inação era impossível.

**Contestar exige propor outro placar.** Dois ganhos: corrige erro honesto de digitação, e obriga a má-fé a se comprometer com uma alegação específica e verificável, em vez de um "discordo" não auditável.

**Votação:** votam os participantes menos os dois em disputa. Vence quem tiver **mais de 50% dos ELEGÍVEIS** — não dos votos dados, senão a abstenção decidiria. Sessão de 4 → 2 elegíveis, ambos precisam concordar. Sessão de 8 → 6 elegíveis, mínimo 4. É o que impede um amigo de plantão de virar o resultado.

**Consequência aceita:** na partida de 4, a votação raramente resolve. O desfecho vira "nenhum dos dois conta" — seguro, mas o mecanismo serve mais às sessões maiores. Afrouxar o percentual reabriria a brecha do amigo.

## Teto de sets
**1 set a cada 20 minutos** de reserva (2h = 6). Não é regra de rating — a Decisão 2 dispensou limite de repetição entre as mesmas duplas. É plausibilidade física: ninguém joga 20 sets em 2 horas.

## Avisos
O aviso **dentro do app existe sempre**, independente do canal externo. Ele não é conforto: "silêncio vale como concordância" só é justo se a pessoa teve chance real de saber. Sem aviso, a inversão viraria "quem não abre o app concorda com tudo".

Dois gatilhos: resultado registrado envolvendo você, e votação em que você é elegível. O botão de avisar a votação dispara para **todos de uma vez**, com cooldown de **6h por votação** — o individual permitiria metralhar uma pessoa específica.

**Web Push entra em seguida**, antes do beta. Ele se liga neste mesmo dado, sem redesenho.

## Onde a regra mora
A tela **não replica** a lógica dos portões. Até "ainda dá para contestar" vem do servidor (`motivo === 'AGUARDANDO_JANELA'`), não do relógio do navegador — se as duas divergissem, a tela ofereceria um botão que o banco recusaria.

## Correção feita no caminho
A consulta de "Minhas partidas" não filtrava por estado. Com o convite passando a existir, **um convite ainda não aceito apareceria como se a pessoa já estivesse jogando** — o oposto exato da regra do aceite. Agora filtra `estado = 'aceito'`, e os convites pendentes viraram um bloco próprio.

## Como foi testado (02/08/2026, 4 contas, via API)
Convite e aceite: conta obrigatória recusada; convite não conta como participação (1 aceito + 3 convidados); aceite muda o estado; responder duas vezes recusado; só o organizador convida.

Ciclo do set: registrar 6x4 → aviso chega → dentro das 24h não conta → quem registrou não contesta → contestação com 4x6 → os dois em disputa não votam → 2 elegíveis → **1 voto de 2 não resolve** → 2 de 2 resolvem e passa a contar → cooldown do aviso.

Nas telas (navegador, tamanho de celular, 2 contas): montar o jogo, buscar, convidar, ver "Convidado", entrar com a outra conta, aceitar, virar "2 confirmados".

Para exercitar os sets às 2h da manhã foi aberta uma faixa de horário temporária numa quadra de teste, **removida ao fim**. Todos os dados de teste foram cancelados.

## O que ainda não existe
- **Motor de rating** — próximo passo; lê o que isto grava
- **Entrega B** — convite por telefone com link de cadastro (o banco já está pronto)
- **Sets em partida aberta** — a Decisão 2 diz que revezamento também gera sets a 0,5x; a tela de partida aberta ainda não tem essa área
- **Web Push** — logo em seguida, antes do beta

## Métricas
`sessao_criada`, `participante_convidado`, `convite_aceito`, `convite_recusado`, `set_registrado`, `set_contestado`, `set_votado`, `votacao_avisada`
