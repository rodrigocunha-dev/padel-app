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

## A divisão do valor da quadra (scripts 018 e 019)
Esta parte nasceu de um **bug caro achado no teste**, e vale entender o erro antes da regra.

Uma sessão de R$130 dividida por quem já tinha aceitado: Rodrigo e Carlos pagaram R$65 cada — quadra quitada. Quando o Diego aceitou, o divisor virou 3, e a tela passou a dizer que os dois tinham pago **R$43,33** e a cobrar mais R$43,33 por uma quadra já paga. Divisor que se mexe depois que o dinheiro andou deixa quem pagou sempre errado, e o total arrecadado passa do valor da quadra.

**A regra que ficou:**
- **Não existe número de vagas declarado.** O divisor é quantas pessoas estão na sessão, com **mínimo de 4** — abaixo disso não dá para fechar um jogo de padel.
- **Antes do 1º pagamento** recalcula à vontade: convite novo, recusa, tanto faz. Nada foi pago, o grupo ainda está se formando.
- **No 1º pagamento CONGELA.** Por gatilho na tabela `pagamentos`, não na tela — assim vale também quando o gateway real existir e o pagamento vier por outro caminho.
- **Quem recusa ou desiste depois libera exatamente 1 vaga**, pelo mesmo valor congelado. Sem recálculo geral.

**Dois consertos na tela, ligados ao mesmo bug:** a consulta nem buscava `valor_centavos` — mostrava sempre a parte calculada agora, e por isso quem pagou R$65 aparecia com R$43,33. E o divisor passou a vir do servidor (`divisor_da_partida`), em vez de a tela recalcular por conta própria.

**⚠️ O mínimo 4 está fixo (`minimo_de_jogadores`) e não pode ficar assim.** A reserva pelo app vale para todos os esportes do clube desde o dia 1. O mínimo tem de vir do esporte da quadra — com a nuance de que esporte sozinho não basta, porque tênis e beach tennis têm simples (2) e duplas (4). Registrado no CLAUDE.md como pendência.

## "Desistir" — a vaga fica disponível sem a pessoa sair
Situação real: alguém avisa que talvez não consiga ir, mas mantém a vaga se ninguém assumir.

Por isso desistir **não remove**: marca `desistiu_em`, a vaga passa a contar como aberta, e a pessoa só sai (estado `saiu`) quando alguém aceita no lugar dela. Dá para voltar atrás enquanto isso não acontece. Prazo: até o jogo começar.

**O pagamento de quem desistiu fica com ele.** A vaga segue quitada para o clube, e o acerto entre as duas pessoas é por fora — decisão do fundador, conectada com as variantes A1/A2 do modelo de pagamento no CLAUDE.md. Não há transferência de valor entre jogadores.

**Qual vaga o substituto assume:** com duas pessoas oferecendo a vaga, quem entra assumia sempre a de quem desistiu primeiro. Mas se foi o jogador B que achou o substituto, é a vaga de B que tem de ser preenchida — senão B continua no jogo contra a vontade e A sai sem ter arrumado ninguém. O convite passou a carregar `substitui_jogador_id`, e o organizador escolhe quando há mais de uma vaga aberta.

**Não deu para reaproveitar a fila de substitutos** da partida aberta: lá é promoção automática de quem se inscreveu sozinho, sem prazo e sem valor por vaga. Aqui é aviso + substituição manual pelo organizador, com a vaga carregando estado financeiro. Só o nome é parecido.

## Remover participante (script 020)
O organizador não tinha como tirar alguém convidado por engano. Agora tem — com uma trava: **quem já pagou não pode ser removido**, porque o dinheiro está naquela vaga e não existe estorno com PIX simulado. Na tela o ✕ nem aparece para quem pagou; a trava real continua no banco.

## Registro de set: 15 minutos (script 016)
O botão liberava assim que dava a hora da partida. Agora só a partir de **15 minutos do início** — ninguém joga um set em menos que isso, e é mais uma porta fechada para jogo fantasma.

Esperar não custa nada porque a janela de registro é de 24h após o fim: um set rápido é registrado alguns minutos depois.

**Atenção a dois números diferentes de propósito:** o teto usa 20 min por set (quantos *cabem* na reserva); a liberação usa 15 min (*quando* o primeiro pode ser registrado). Não "harmonizar" os dois.

## Avisos: um bloco por tipo, e eles somem
Correções vindas dos testes no celular:
- **Um bloco por TIPO, não um por aviso.** Com vários resultados registrados a tela virava pilha de blocos iguais; agora o bloco mostra a contagem e abre a lista.
- **Dizem de qual jogo são** (clube e data) e, dentro dele, **de qual set** (`Set 2 · 7x5`). Sem o set, dois avisos da mesma partida viravam duas linhas idênticas.
- **A linha da lista parece tocável** (`Abrir →`). Sem afordância, o cartão branco lia como texto e o fundador não percebeu que dava para abrir.
- **Estão nas duas telas** — Início e Minhas partidas, mesma consulta e mesmo componente. Só em Minhas partidas, a regra "quem não contestar em 24h concordou" dependia de a pessoa ir procurar.

### Quem marca como lido, e por que não é o toque
O aviso vira lido quando a **página do jogo abre** (`MarcarAvisosLidos`), não quando se toca no bloco. A primeira versão marcava no toque e tinha dois defeitos, os dois vistos no teste de 08/08/2026:

1. **Toque não é chegada.** Um toque que não abria o jogo apagava o aviso do mesmo jeito.
2. **Corrida com a navegação.** A gravação chamava `router.refresh()` ao terminar, disputando com o `<Link>` que ainda estava navegando. Às vezes o refresh ganhava e o toque não levava a lugar nenhum — só apagava. Tentando abrir cinco avisos, o fundador apagou os cinco e viu um resultado só.

Marcando na chegada não há corrida (a página já abriu, a marcação é um efeito solto) e "lido" passa a significar que a pessoa realmente esteve lá. O filtro é por `set_id` dos sets **daquela** partida: abrir um jogo não apaga o aviso de outro.

**Em aberto, para observar com uso real:** o aviso some ao *abrir* o jogo, mesmo sem contestar. Se a pessoa só der uma olhada e o prazo de 24h correr, nada a lembra de novo.

## Onde os erros aparecem
O erro era renderizado no fim da seção. No teste, o fundador tentou remover três vezes achando que nada acontecia — o erro já estava lá, fora da vista.

Agora existe `MensagemFlutuante`: presa logo acima da barra de navegação, sempre visível, com botão de fechar. **Camada 1050** — acima da barra (1000) e abaixo dos pop-up (1100), seguindo a regra de camadas de `BarraNavegacao.tsx`.

## O que ainda não existe
- **Motor de rating** — próximo passo; lê o que isto grava
- **Entrega B** — convite por telefone com link de cadastro (o banco já está pronto)
- **Sets em partida aberta** — a Decisão 2 diz que revezamento também gera sets a 0,5x; a tela de partida aberta ainda não tem essa área
- **Web Push** — logo em seguida, antes do beta

## Scripts de banco desta entrega
| Script | O que faz |
|---|---|
| `014` | Sessões, convite/aceite, sets, contestação, votação, avisos |
| `015` | Correção: reserva não atravessa a meia-noite (bug achado testando o 014) |
| `016` | Set só pode ser registrado 15 min depois do início |
| `017` | Convidado não vê a divisão do valor antes de aceitar |
| `018` | Divisor dinâmico até o 1º pagamento + "Desistir" |
| `019` | Divisor nunca menor que 4 |
| `020` | Remover participante + convite dizendo qual vaga preenche |

## Métricas
`sessao_criada`, `participante_convidado`, `participante_removido`, `convite_aceito`, `convite_recusado`, `desistiu_da_sessao`, `desistencia_cancelada`, `set_registrado`, `set_contestado`, `set_votado`, `votacao_avisada`
