# CLAUDE.md — Contexto do Projeto
*Este arquivo fica na raiz do repositório. O Claude Code o lê automaticamente em toda sessão. Mantenha-o atualizado: ele é a memória do projeto.*

## O que estamos construindo
SaaS + aplicativo de padel para o mercado brasileiro (início: Novo Hamburgo/RS e Vale dos Sinos). Dois lados:
- **App do jogador (mobile-first):** encontrar parceiros do mesmo nível, partidas abertas, reserva de quadra com PIX dividido, ranking por categorias brasileiras.
- **Painel do clube (web):** agenda unificada MULTIESPORTE (padel, beach tennis, tênis, futebol society), reservas do app + balcão no mesmo calendário, relatórios, promoção de horários ociosos.

Fundador não programa: explique decisões técnicas em português simples, sem jargão desnecessário. Todas as interfaces, textos e commits em PT-BR.

## Posicionamento e regras de negócio inegociáveis
1. **Jogador NUNCA paga taxa de conveniência** (cunha contra o Playtomic).
2. **Agenda multiesporte, alma padel:** o painel do clube aceita quadras de qualquer esporte desde o dia 1; matchmaking/ranking/comunidade são 100% padel no lançamento.
3. **Categorias brasileiras:** 7 categorias (1ª = elite … 7ª = iniciante) × 3 níveis (Forte / Médio / Fraco) = 21 degraus. Nada de nível decimal.
4. **Rating:** motor interno tipo Elo/Glicko para duplas + índice de confiabilidade. Pesos: nível dos adversários; tipo de jogo (amistoso ranqueado 1x, liga 1,5x, torneio 2–3x); placar. Transparência total: após cada jogo, mostrar quanto mudou e por quê. Proteção de rebaixamento (janela de 10 partidas). Calibração: questionário + validação por 2 pares + 5 primeiras partidas com peso maior.
5. **Só partidas de 4 jogadores em modo competitivo afetam o rating.** Partidas com revezamento (5–8 jogadores) contam para estatísticas e conquistas, não para rating. **⚠️ Regra em reavaliação pelo fundador — ver "Ideias Futuras" abaixo. Vale continuar seguindo esta regra até uma decisão nova ser registrada aqui.**
6. **Partidas abertas:** faixa de categoria aceita; sexo do jogo (masculino/feminino/mista); 4 a 8 jogadores (5+ = modo revezamento, valor da quadra dividido entre todos); fila de substitutos automática quando alguém sai.
7. **Pagamentos:** PIX com split automático entre os jogadores via **gateway único contratado pela plataforma** (clubes entram como recebedores/subcontas dentro dele — não cada clube com seu próprio gateway; ver decisão em "Arquitetura de pagamento" abaixo); repasse direto ao clube; cobrança de pendentes via WhatsApp; políticas de cancelamento definidas por clube e exibidas ANTES do pagamento.
8. **Zero overbooking:** trava de concorrência na agenda em tempo real. Reserva editável dentro da política do clube.
9. **WhatsApp é canal nativo:** notificações push com fallback para WhatsApp.
10. **LGPD desde o dia 1:** consentimento, exportação e exclusão de dados.

## Stack (decidida — não trocar sem discutir)
- App do jogador: **PWA primeiro** (Next.js), Flutter só na fase de lojas (builds via Codemagic, nunca Android Studio local).
- Painel do clube: **Next.js**.
- Backend/banco/auth/realtime: **Supabase (PostgreSQL)** — banco sport-agnostic: toda quadra tem campo `esporte`; jogador poderá ter perfis por esporte no futuro. RLS ativado em todas as tabelas desde a primeira.
- Mapas: **OpenStreetMap + Leaflet** (decisão do fundador: gratuito, sem conta nem cartão). Google Maps fica como opção futura.
- Pagamentos: **arquitetura decidida, fornecedor ainda EM ABERTO.** Ver "Arquitetura de pagamento" logo abaixo.
- Mensageria: WhatsApp Business API via BSP (ex.: Z-API).
- Métricas: **PostHog (US Cloud)**. Deploy: **Vercel (deploy automático a cada push)**. Código: **GitHub — github.com/rodrigocunha-dev/padel-app**.

### Arquitetura de pagamento (decidido em 22/07/2026)
**Modelo:** gateway único contratado pela plataforma (não pelo clube). O clube entra como recebedor/subconta dentro dessa conta — é o mesmo modelo usado por Uber, iFood e a maioria dos marketplaces brasileiros. Isso permite que o jogador pague um PIX só, dividido automaticamente entre o clube e o spread da plataforma, sem fricção. Integrar múltiplos gateways (um por clube) foi avaliado e descartado por ora — ver "Ideias Futuras" abaixo.

**Fornecedor ainda não escolhido.** Favoritos em avaliação, por taxa percentual baixa (melhor para os valores pequenos do rateio, R$ 15–30/jogador) e split self-service (sem precisar negociar com time comercial para habilitar):
- **Iugu** — taxa PIX ~0,99%, split nativo desenhado para marketplace, API documentada em PT-BR.
- **Mercado Pago** — taxa PIX ~0,99%, marca já conhecida do jogador final (pode gerar mais confiança na hora de pagar).

Descartados por ora (taxa fixa pesa demais em valores pequenos, ou split trava em plano negociado): Asaas, Pagar.me. Taxas mudam com frequência — confirmar direto no site de cada um antes de decidir.

**Enquanto o fornecedor não é decidido:** Sprint 4 usa **PIX simulado** (mock) — mesma lógica de divisão, cobrança e confirmação, mas sem gateway real por trás. Ver Sprint 4 abaixo.

**Prazo a contar no planejamento:** a homologação do gateway pode levar alguns dias. Dimensionar o sprint do gateway real contando com essa espera, que não depende de nós.

## Restrições da máquina de desenvolvimento
Notebook i3 11ª gen, 8 GB RAM, pouco disco. Portanto: nada de emulador Android, nada de Docker pesado, preferir serviços na nuvem (Supabase remoto, não local). Testes mobile no celular real / navegador.

## Identidade visual (provisória)
Verde-quadra `#0E5C46` + amarelo-bola `#D6F455`, fontes Archivo (títulos) e Inter (texto). Existe uma segunda variante azul-quadra `#0B4F86` alternável na landing, criada para comparação — **pendente**: fundador decidir qual variante fica e remover a perdedora. Nome da marca ainda não decidido (finalistas: FaltaUm, Fechou) — todo texto do produto deve seguir neutro até a decisão, fácil de trocar.

## Fases (resumo)
- **Fase 1 (MVP, meses 1–4):** onboarding, mapa de quadras, partidas abertas, reserva + PIX split, resultados + rating + categorias, chat da partida, painel do clube com agenda multiesporte. Critério de pronto do MVP: jogador descobre clube → entra/cria partida → reserva e paga dividido → registra resultado → vê categoria evoluir; clube opera 100% da agenda sem caderno.
- **Fase 2 (5–10):** torneios com chaveamento automático, ligas/rachões, gamificação completa (temporadas trimestrais), Premium do jogador, comanda de bar, mensalistas, CRM, aulas. A **gestão avançada do clube** é estrategicamente importante: é onde o Gripo tem vantagem hoje — caprichar na experiência.
- **Fase 3 (11–18):** professores como vertical, beach tennis no lado do jogador, marketplace, vídeo, IA, expansão.

**O que está construído vs. o que falta**, em todas as fases, está no **`Status_Produto_Checklist.md`** (raiz do repositório). Ele traz no topo o **comando único de retomada**, que serve para abrir qualquer sessão — não existe mais um comando por sprint. O antigo `Comandos_de_Retomada_Sprints.md` foi absorvido por ele em 29/07/2026 e removido (motivo: era prescritivo e envelheceu mal — mandava construir o que já estava pronto e integrar um gateway já descartado).

## Ideias Futuras (banco de ideias — fora do escopo atual, não iniciar sem o fundador puxar)
*Categorizado por área. Cada ideia tem um status:*
- 💡 **Não convencido** — fundador ouviu o argumento, não descartou, mas também não está convencido da necessidade (ou, no caso de uma regra já existente, não está mais satisfeito com ela). Não iniciar sem revisitar com mais contexto.
- 🔍 **Em avaliação** — pesquisa ativa em andamento.
- ✅ **Aprovada** — decidido incluir, falta só definir a fase.
- ❌ **Descartada** — decidido não fazer, motivo registrado.

### Pagamentos
- 💡 **Não convencido** — Deixar cada clube escolher e contratar seu próprio gateway de pagamento, negociando sua própria taxa, em vez da plataforma usar um gateway único com clubes como recebedores. Prós levantados: mais autonomia financeira para o clube. Contras levantados: exigiria integrar e manter múltiplos gateways (APIs, webhooks e formatos de erro diferentes cada um), complicaria a cobrança automática do spread da plataforma, e quebraria a experiência de "um PIX só, dividido na hora" que é a promessa central do produto. Grandes marketplaces (Uber, iFood) usam o modelo de gateway único — mas o fundador ainda não está 100% convencido de que esse é o caminho certo pro seu caso e quer reavaliar com mais escala/contexto antes de decidir definitivamente contra.
- ✅ **Aprovada, falta a fase** — **Política de pagamento configurável por clube** (quando/como o dinheiro se acerta; ex.: pagar no balcão via clube-recebedor, modelo iFood/Uber de netear a taxa contra a conta do clube) → decisão do **sprint do gateway real**, quando o dinheiro for real e o spread entrar em jogo.
- 💡 **Não convencido** — **Bloqueio total do app por inadimplência** (jogador só vê o valor em aberto até pagar) → exige **revisão jurídica (CDC)**, porque a dívida costuma ser entre jogadores e não com a plataforma — e depende do gateway real.
- 🔍 **Em avaliação** — **MODELO DE PAGAMENTO, pacote de decisões do sprint do gateway real** (discutido a fundo em 23/07/2026; adiado para depois das entrevistas com clubes e jogadores). O mock do Sprint 4 já demonstra as mecânicas (dividir, pagar, ver quem pagou, cobrar, bloquear); o que falta decidir é a POLÍTICA, e os três pontos estão amarrados entre si:
  1. **Quem assume o risco do calote:** (A) organizador garante a quadra e o clube é feito inteiro; (B) clube absorve e recebe só o que entrou; (C) todos pagam antes. Define o fluxo do dinheiro.
  2. **Partida aberta com estranhos quebra o modelo A:** o organizador não conhece quem entrou, então não faz sentido ele bancar o calote de desconhecidos. Saída natural: em **partida aberta, cada jogador paga a própria parte para garantir a vaga** (pagar-ao-entrar — a quadra segue reservada na confiança; o que exige pagamento é a vaga entre estranhos, não a quadra). Provável desenho: **dois modos** — privada (conhecidos, acerta depois, modelo A) vs. aberta (estranhos, paga-ao-entrar). Isso simplifica o item 3: se todos pagam ao entrar, não existe "quem não pagou" entre os ativos; sobra só o não-comparecimento.
  3. **O que o clube vê sobre pagamentos:** por partida (quem não pagou) vs. só reputação de caloteiro recorrente. Depende do item 1 (se o clube absorve risco, é parte interessada) e conecta com "Reputação de conduta" abaixo.

### Partidas abertas e experiência do jogador (levantado nos testes do Sprint 4, 23/07/2026)
- ✅ **Aprovada** — **Filtros no feed de partidas abertas**: além de "compatível comigo", filtrar por esporte, quadra, categoria, dia, cidade, etc. Reaproveitar o padrão de filtros em cascata já feito no mapa de clubes (`Descobrir.tsx`). Falta só definir a fase.
- 🔍 **Em avaliação — o Descobrir virou gargalo do app (observado no teste da barra de navegação, 01/08/2026).** O fundador notou no celular que quase todo caminho termina no Descobrir. Investigado no código: **não é só falta de dados, é estrutural.** Criar partida só existe dentro da página do clube (`clubes/[id]/page.tsx`), reservar também, e o único jeito de escolher um clube é o mapa — então toda ação de "começar algo novo" passa por lá. Até o estado vazio do feed manda para o mapa. Com dados, parte melhora (o atalho "Reservar" vai direto ao último clube), mas criar partida nova continua exigindo o Descobrir sempre. **O "favoritar clubes" aprovado acima é o antídoto natural:** com 1–2 clubes fixos, reservar e criar viram atalho direto e o mapa volta a ser ferramenta de descobrir clube NOVO, não pedágio. O fundador quer analisar a UX dessa tela com calma — não mexer antes dessa conversa.
- 🔍 **Em avaliação (fundador vai pesquisar antes)** — **Repensar os filtros como um todo** (mapa de clubes + feed de partidas). O fundador acha que dá para melhorar a funcionalidade de filtros além de só replicar a atual, mas quer pesquisar referências primeiro para conversarmos e desenvolvermos juntos. Não implementar os filtros do feed no padrão atual sem antes ter essa conversa — ela pode mudar o desenho dos dois lugares.
  - **Hipótese levantada pelo fundador (01/08/2026): busca "invertida".** Em vez de escolher o clube primeiro (mapa → clube → reservar), o jogador informaria o que quer (dia, esporte, tipo de quadra) e o app mostraria direto os horários compatíveis, sem passar pela página do clube. O próprio fundador notou a limitação: a tela de lista do Descobrir já filtra por essas informações, então a única diferença seria reservar direto na lista — o que esbarra em cada clube ter vários horários livres diferentes, sem solução óbvia de layout (uma linha de lista não comporta um seletor de horário inteiro sem virar poluição visual). Também nota que "Jogar agora" e a busca por data futura já cobrem parte do que essa ideia propõe. Considerada **não essencial agora** — registrada aqui como uma hipótese concreta para quando o fundador for pesquisar referências, não para ser desenhada ainda.
- ✅ **Aprovada** — **Barra de navegação fixa** para o app do jogador (início, descobrir, partidas, perfil/sair) presente em todas as telas. Hoje o app não tem navegação consistente — o "Sair" só existe na tela inicial e o usuário vai e volta na mão. Resolve isso e melhora a UX geral. Conecta com o "botão de troca de modo (jogador ↔ clube)" das pendências.
- ✅ **Aprovada (refinada em 29/07/2026)** — **Partida privada (grupo de amigos), com ou sem vagas abertas.** O nome antigo era "grupo de amigos + vagas abertas" e induzia a erro: **a partida fechada é o caso principal, não uma variação.** Quatro amigos que jogam sempre juntos, sem nenhuma vaga para estranhos, são uma partida legítima e precisam contar. Deixar vagas abertas é opcional — aí vira híbrida (convidados = conhecidos; vagas restantes = estranhos que pagam ao entrar, conectando com a decisão privada-vs-aberta do modelo de pagamento).
  - **Convite exige ACEITE.** O organizador não "preenche" quem vai jogar — ele **convida**, e cada pessoa aceita ou recusa. Ninguém entra numa partida (e numa conta a pagar) sem dizer sim. Isso é uma máquina de estados (convidado → aceitou / recusou / expirou), não uma lista de nomes.
  - **Dependência escondida:** para aceitar, a pessoa precisa **saber** que foi convidada. Sem notificação, o convite só aparece se ela abrir o app e procurar. A forma completa desta ideia encosta no trilho de comunicação (chat/notificações), que foi adiado — considerar isso ao dimensionar o trabalho.
  - **Por que isso importa mais do que parece (descoberto em 29/07/2026):** hoje "Reservar quadra" e "Criar partida aberta" produzem coisas diferentes no banco. A reserva grava só `reservas`, com **um único jogador** — não sabe quem jogou, então **nunca poderá registrar resultado nem afetar o rating**. No padel brasileiro boa parte dos jogos é com o mesmo grupo fixo, e esse pessoal usa "Reservar quadra", não "Criar partida aberta". Sem partida privada, o motor de rating enxerga só os jogos feitos com desconhecidos — ponto cego grande para um produto cuja cunha é justamente o rating.
  - **Decidir JUNTO com a regra nº 5**, na mesma conversa: as duas perguntas são a mesma família — *que jogos contam para o rating?* Uma pergunta se revezamento conta; a outra, se jogo de grupo fixo conta. Decidir separado é desenhar o motor duas vezes.
- ✅ **Aprovada** — **Editar partida aberta**: só o organizador edita. Se ainda não tem outros jogadores, a edição vale na hora; se já tem jogadores, a mudança é uma SOLICITAÇÃO que precisa ser aprovada por TODOS os jogadores da partida. (Sprint 4 não tinha edição — levantado no teste de 26/07/2026.)
- ✅ **FEITA (26/07/2026, extensão do Sprint 4)** — **Seção "Minhas partidas"** (`/app/partidas/minhas`): lista as partidas em que o jogador é/foi jogador ativo (exceto canceladas), com **status da partida** (Futura / Jogada) e **status de pagamento** (Paga / Aguardando / Inadimplente) bem visíveis + filtros por ambos. Fechou o buraco do inadimplente não achar a dívida — ciclo ver→pagar→desbloquear testado de ponta a ponta.
- 💡 **Sobre uma seção "Financeira" separada (fundador não convencido — e o Claude concorda):** não fazer uma seção financeira à parte agora. Os valores são pequenos e esporádicos; a informação "o que devo" é por-partida e pertence à própria partida. "Minhas partidas" filtrada por "Inadimplente" JÁ é a visão financeira, sem peso de navegação extra. Uma seção financeira dedicada só se justifica no futuro se houver complexidade real (carteira, recibos, estornos, vários tipos de pagamento) — o que hoje não existe.

### Perfil e Navegação (levantado em conversa sobre a tela de Início, 30/07/2026)
- ✅ **Aprovada, falta a fase** — **Favoritar clubes.** Jogador marca 1–2 clubes onde joga com frequência (estrela/coração na página do clube). Motivação: no padel, o jogador tende a girar entre os mesmos 1–2 clubes fixos — favoritar dá um atalho de 1 toque para reservar/entrar em partida sem passar pelo mapa. Barato de construir (lista de IDs de clube por jogador, sem lógica de matchmaking nova). Local sugerido: atalho na tela de Início + botão na página do clube. Conecta com a ideia futura de notificar "seu clube favorito abriu horário ocioso" (usa o botão de promoção de ociosidade do painel do clube).
- 💡 **Nova ideia, não iniciar** — **Reservas mensais (mensalista) visíveis e canceláveis pelo jogador no Perfil.** Depende de o mensalista existir primeiro do lado do clube (Módulo 2.5, Fase 2, ainda não construído) — hoje mensalista é um combinado direto entre clube e jogador, fora do app. Cancelar um mensalista é diferente de cancelar uma partida avulsa: é **encerrar um vínculo recorrente**, não um jogo pontual — por isso não deve entrar em "Minhas partidas" quando existir.

### Rating e Categorias
- 💡 **Não convencido** — (23/07/2026) O fundador quer reconsiderar a regra nº 5 ("só partidas de 4 jogadores em modo competitivo afetam o rating"), que hoje exclui partidas com revezamento (5–8 jogadores) do cálculo. Ainda sem direção definida de como mudar. Ponto técnico a considerar quando essa conversa avançar: partidas com revezamento têm menos jogo por pessoa e mais entra-e-sai, o que deixa o resultado "menos limpo" para atribuir a uma dupla específica — incluir essas partidas no rating provavelmente exige uma lógica própria (ex.: peso menor, ou considerar só os sets que cada dupla específica jogou dentro da partida maior), não é só remover a trava atual. **Até essa ideia virar decisão, a regra nº 5 continua valendo como está.** ⚠️ **Desde 29/07/2026 esta decisão é BLOQUEIO DE INÍCIO do Sprint 5** — ver "Sprint atual".
  - **⚠️ Observação de campo que muda o enquadramento (30/07/2026).** Perguntado o quanto "revezamento" é comum nos clubes-piloto, o fundador respondeu que **não chama aquilo de revezamento**: o que existe de verdade são **grupos de amigos de 5–6 pessoas e grupos fixos com horário toda semana**, acima de 4 jogadores. Isso **não é o caso que a regra nº 5 cobre** — a regra fala de partida ABERTA com revezamento. O caso real passa por **"Reservar quadra"**, que grava só um jogador em `reservas` e nunca vira partida rastreável. Consequência: **mesmo resolvendo a regra nº 5 por inteiro, os jogos que o fundador mais joga no dia a dia continuariam invisíveis para o rating**, porque nem viram "partida" no banco. A regra nº 5 sozinha resolve o caso menos frequente.
  - **Ordem de prioridade decidida para a conversa de destravamento do Sprint 5:** (1) **primeiro** decidir se/como a partida com amigos fixos (feita via reserva) vira uma **partida rastreável com jogadores identificados** — pela leitura do fundador, essa é a maior fatia do jogo real hoje; (2) **só depois** o peso e a fórmula de quem entra e quanto conta. Inverter essa ordem é otimizar a fórmula de um conjunto de jogos que quase não existe.
- ✅ **Aprovada, falta a fase** — **Reputação de conduta** (paga? aparece? comportamento tóxico/violento?) via múltiplos indicadores, incluindo avaliação entre jogadores — estava no escopo inicial do fundador. É um **eixo SEPARADO do rating de habilidade** (nunca misturar: o índice de confiabilidade do rating mede só a certeza do NÍVEL de jogo, não o caráter). Amarrar ao módulo de resultados/rating (Sprint 5+).

## Sprint atual

**Sprint 0 — Landing + lista de espera: ✅ CONCLUÍDO (19/07/2026).**
Site no ar em https://padel-app-liart.vercel.app/. Formulário salva no Supabase (tabela `lista_espera`, RLS só-INSERT) e dispara evento `cadastro_lista_espera` no PostHog.

**Sprint 1 — Contas e Onboarding: ✅ CONCLUÍDO (20/07/2026), testado pelo fundador no celular.**
Implementado: login por telefone/OTP com máscara `(DD) 99999-9999` (fase A com número de teste `5551999998888`/código `123456` até 31/10/2026); onboarding do jogador em /app (nome, foto no Storage, cidade, questionário de calibração com teto de sugestão na 2ª, selo "em calibração", posição, disponibilidade dia×turno, raio); painel do clube em /clube (clube + quadras multiesporte com piso compatível por esporte + preços por faixa horária em centavos, com trava dupla contra sobreposição — tela e trigger no banco). Rotas protegidas por proxy com sessão em cookies. Scripts SQL: `002` e `003`. Documentação técnica em `/docs/interno/` (autenticacao, perfil-jogador, clube-quadras), artigos de cliente em `/docs/jogadores/` e `/docs/clubes/`, eventos PostHog em todos os passos-chave.

**Sprint 2 — Descoberta, Mapa e Painel do Clube v0: ✅ CONCLUÍDO (20/07/2026), testado pelo fundador no celular.**
Implementado:
- **Mapa e descoberta (/app/descobrir):** Leaflet + OpenStreetMap. Pin mostra o menor preço/h. Alternador **Mapa | Lista**. Filtros: esporte e tipo de quadra em multi-seleção **com opções em cascata** (só aparece o que existe nos clubes); só cobertas; preço máx.; cidade ("onde estou" por GPS, ou qualquer cidade com clube); distância de 1 a 50 km. **"Jogar agora"** = clubes com 1h contínua livre nas próximas 3h. **Busca por data futura** (data + janela de horário + "só clubes com horário livre nesse período").
- **Página do clube (/app/clubes/[id]):** fotos, descrição, esportes/quadras, horário de funcionamento derivado das faixas de preço, mini-mapa com rota, telefone, política de cancelamento, avaliações 1–5 com comentário e botão de WhatsApp.
- **Painel do clube:** edição de informações (nome, telefone, descrição, política de cancelamento), **cidade não editável — sempre derivada do endereço no mapa** (proteção descoberta no teste: "NH" vs "Novo Hamburgo" quebrava o filtro), localização com busca de endereço e pin ajustável, upload de várias fotos de uma vez.
- **Agenda (/clube/agenda):** visões **Dia | Semana | Mês** com seletor de calendário; dia = grade quadra×hora com reserva de balcão (nome, WhatsApp, duração) e cancelamento; semana/mês = mapa de calor de ocupação com cada dia clicável levando à agenda daquele dia. **Zero overbooking garantido pelo banco** (exclusion constraint, testado por fora da interface) e reservas de terceiros invisíveis para jogadores (LGPD).
- Scripts SQL: `004` (coordenadas, fotos, avaliações, reservas) e `005` (descrição e política de cancelamento). Documentação técnica em `/docs/interno/` (descoberta-mapa, agenda-clube), artigos de cliente em `/docs/jogadores/` e `/docs/clubes/`, eventos PostHog em todos os passos-chave.

**Sprint 3 — Módulo 1.4 (parte 1): Agenda em Tempo Real: ✅ CONCLUÍDO (22/07/2026), testado pelo fundador no celular.**
Implementado:
- **Reserva pelo app em 3 toques** (`/app/clubes/[id]/reservar`): "Reservar quadra" → toca no horário livre → confirma. Dia (Hoje/Amanhã/calendário), quadra e duração (1h/1h30/2h) com grade de horários e preço em cada um.
- **Zero overbooking comprovado:** duas reservas idênticas disparadas no mesmo instante — uma entrou, a outra recusada pelo banco (`23P01`). Também recusa sobreposição parcial, horário fora do funcionamento e horário no passado. A garantia é a exclusion constraint + a função `reservar_quadra` (valida funcionamento, calcula preço e grava de uma vez).
- **Tempo real** (Supabase Realtime): a grade do jogador e a agenda do clube se atualizam sozinhas, sem recarregar a página (verificado).
- **LGPD:** o jogador nunca lê reservas alheias. Para saber o que está ocupado, lê `agenda_publica` — espelho mantido por gatilho com **só quadra, início e fim** (4 colunas, sem dado pessoal).
- **Política de cancelamento que o sistema faz valer:** clube escolhe "cancelamento livre até X horas antes" (padrão 12h) + texto livre de detalhes. O jogador vê o prazo exato; passado o prazo, cancelar/remarcar é bloqueado **no servidor** (gatilho). O dono do clube não é limitado pela política.
- **Minhas reservas** (`/app/reservas`): próximos jogos, cancelar e **remarcar**. Remarcar move a MESMA reserva (não cria outra). Testado: 14:00→16:00–17:30 com preço recalculado de R$150 para R$225, sem duplicar; e mover para horário que encosta no atual (16:00–17:30 → 17:00–18:00), que é justamente o caso que quebraria se remarcar fosse "criar nova + cancelar antiga".
- Agenda do clube mostra reservas do app com 📱 e o **nome do jogador**.
- Scripts SQL `006` (política em horas, espelho público, preço na reserva, `reservar_quadra`, realtime) e `007` (`remarcar_reserva`) — **ambos já rodados no Supabase**. Eventos PostHog em todos os passos-chave.
- **Documentação em dia (22/07/2026):** doc técnica em `/docs/interno/reserva-app.md` + os artigos de cliente dos Sprints 0–3 em `/docs/jogadores/` e `/docs/clubes/` (13 artigos, todos 9/10+ na rubrica e aprovados na revisão final do fundador).

**Contas de teste (Supabase → Auth → Phone → Test Numbers, válidas até 31/10/2026):**
- `5551999998888` / código `123456` — "Rodrigo Teste", **dono do Clube Teste** (usar para o painel `/clube`).
- `5551999997777` / código `654321` — "Carlos Teste", jogador comum de Porto Alegre (usar para testar o que é exclusivo do jogador, como o bloqueio da política de cancelamento — o dono é isento no servidor).

**Pendências acumuladas dos Sprints 0–3 (não bloqueiam o Sprint 4, mas têm prazo):**
- Decidir variante de cor (verde vs. azul) e remover a perdedora.
- Política de privacidade LGPD quando a marca for decidida.
- Elaborar perguntas de calibração melhores (as atuais são provisórias).
- ⚠️ **Fase B da autenticação (Twilio real) antes de 31/10/2026** — o número de teste expira nessa data; sem isso, ninguém mais consegue logar. Credenciais do Twilio são SECRETAS: nunca colar no chat nem commitar — sempre em variável de ambiente, e o próprio fundador cadastra a chave direto no painel da hospedagem (Vercel), sem passar pelo Claude Code.
- Definir o escopo do Premium do jogador (Fase 2). Candidata já identificada pelo fundador: busca de quadra por cidade + data futura ("planejando viagem"), hoje liberada para todos.
- **Rodapé dos artigos de cliente está com `[DEFINIR]`** no lugar do WhatsApp de suporte (13 artigos). Quando o número existir, substituir em todos.
- **Evoluir a agenda do clube** (ideias para adiante): bloqueios recorrentes/mensalistas, arrastar para remarcar, filtro por esporte/quadra.
- **Botão de troca de modo (jogador ↔ painel do clube)** para donos e funcionários de clube, que hoje precisam navegar entre `/app` e `/clube` na mão. Ligado a isto: na tela do jogador a política de cancelamento vale para todos, inclusive o dono (no servidor o dono é isento). Decisão de 22/07/2026: **manter assim**; se mudar, tratar junto com o botão de troca de modo.
- **Decidir o fornecedor do gateway de pagamento** (Iugu vs. Mercado Pago são os favoritos atuais) antes de trocar o PIX simulado do Sprint 4 pelo real.

**Sprint 4 — Partidas abertas + PIX simulado: ✅ CONCLUÍDO (23/07/2026), testado de ponta a ponta e testado pelo fundador no celular (27/07/2026), incluindo a extensão "Minhas partidas".**
Gateway de pagamento ainda não decidido → **PIX simulado** (mock isolado para troca fácil — a "costura" fica em `src/lib/pagamentos/`: `tipos.ts` = contrato, `index.ts` = chave de troca por env, `simulado.ts` = peça descartável, endpoint `/api/pagamentos/confirmar` = o mesmo que o gateway real vai chamar). Implementado:
- **Partidas abertas:** criar (faixa de categoria, competitiva/amistosa, sexo do jogo, 4–8; competitiva só com 4 — regra nº 5), feed de compatíveis, entrar em 1 toque, **fila de substitutos com promoção automática** (testado com 5 contas: 5º vira substituto; ao sair um jogador, o 1º da fila sobe).
- **Reserva na confiança:** quadra confirmada na hora (reusa Sprint 3); o pagamento é um "caderninho" por cima que NÃO trava a reserva. A partida carrega horário/quadra/preço próprios (script 009) porque a reserva é privada (LGPD) e o feed alheio precisa ler esses dados.
- **Split sem taxa** (regra nº 1): divisão igual, sobra de centavos nos primeiros. Tela mostra quem pagou; botão de WhatsApp por jogador para o organizador cobrar (só o organizador puxa o contato).
- **Privacidade:** telefone do jogador fechado por column privileges (script 008), volta só via `contato_jogadores_partida` para o organizador. Split visível só para jogadores ativos (script 011) — nem substitutos, nem clube, nem quem só visita.
- **Bloqueio do caloteiro:** inadimplente = jogou, passou 24h do fim, não pagou → não cria nem entra em nova partida. Partida futura nunca conta; pagou → desbloqueia na hora. Testado nos dois sentidos. As 24h são provisórias (validar com clubes/jogadores).
- Scripts `008` (partidas, sexo, telefone privado), `009` (dados públicos da partida), `010` (pagamentos, split, inadimplente), `011` (split só p/ jogadores), `012` (correções: cancelar partida sem bater na política + inadimplente não reserva quadra) e `013` (cancelar só partida futura — trava no servidor, fecha o furo de cancelar partida vencida para apagar a dívida) — **todos rodados**. Doc técnica em `/docs/interno/partidas-abertas.md` + 4 artigos de cliente (criar/entrar partida, dividir pagamento, minhas partidas), todos 10/10 na rubrica. Eventos PostHog em todos os passos.

**Contas de teste adicionadas neste sprint** (Supabase, até 31/10/2026): `5551999996666`=`111111` (Bruno), `5551999995555`=`222222` (Diego), `5551999994444`=`333333` (Eduardo) — jogadores comuns masculinos, para testar 4+ jogadores e a fila.

**Conta de teste adicionada em 31/07/2026** (para o teste da barra de navegação): `5551999992222`=`555555` — perfil **"Novo Teste Barra"**, 4ª Médio, Novo Hamburgo. Criada porque nenhuma das outras contas serve para testar o fluxo de cadastro: todas já têm perfil e pulam o onboarding. **Se precisar testar o onboarding de novo, é preciso outro número — este agora também já tem perfil.**

**⚠️ Dados de teste no banco** (limpar antes do lançamento): jogadores Bruno/Diego/Eduardo, **Novo Teste Barra**, e os clubes de teste. Há um script único `supabase/sql/seed_dados_teste.sql` que **limpa** reservas/partidas/pagamentos, deixa o **Bruno inadimplente** (partida de 3 dias atrás não paga) e cria clubes de teste. **⚠️ o passo de limpeza apaga TODAS as reservas — só rodar em teste.**

**Clubes de teste** (criados pelo seed): Clube Teste (Novo Hamburgo, dono Rodrigo) · Arena Padel Sinos (Novo Hamburgo, dono Carlos) · Padel Club Porto Alegre (Porto Alegre, dono Diego) · Vale Padel (São Leopoldo, dono Eduardo). Nota: as contas de jogador viram donas de clube só para ter mais clubes no mapa — quando a navegação/troca de modo evoluir, revisar.

**⚠️ A numeração dos sprints divergiu do plano original (auditado no código em 29/07/2026).** O Sprint 4 executado absorveu parte do que o plano antigo chamava de Sprint 5 (criar partida, feed, entrar em 1 toque) e o primeiro item do Sprint 6 (fila de substitutos). Em compensação, deixou para trás o que era o próprio Sprint 4: gateway real, repasse ao clube e reembolso. Registrado aqui para ninguém reconstruir o que já existe.

**Sprint 5 — 🔜 PRÓXIMO. Escopo decidido em 29/07/2026: Resultados + Rating + Categorias + barra de navegação fixa.**

> 🔒 **BLOQUEIO DE INÍCIO — resolver antes de abrir o sprint:** a **regra nº 5** ("só partidas de 4 jogadores em modo competitivo afetam o rating") está em reavaliação pelo fundador. Ela **define a arquitetura da função de cálculo** — partidas com revezamento entram ou não? Não desenhar o motor sem essa decisão; fazer isso no meio do sprint é retrabalho garantido. Incluir revezamento não é remover uma trava: exige lógica própria (peso menor, ou considerar só os sets de cada dupla). Enquanto não houver decisão nova registrada aqui, a regra vale como está.
>
> **Decidir na mesma conversa:** a **partida privada (grupo de amigos)** — ver "Ideias Futuras". Hoje quem reserva quadra direto não vira partida, então esses jogos nunca poderiam entrar no rating. As duas perguntas são a mesma: *que jogos contam?* Se a resposta incluir jogo de grupo fixo, o escopo do Sprint 5 cresce.
>
> **Ordem da conversa (decidida em 30/07/2026, depois de olhar o jogo real dos clubes-piloto):** (1) primeiro, a partida com amigos fixos vira partida rastreável com jogadores identificados? (2) só depois, peso e fórmula. Motivo: o que os clubes-piloto têm não é "revezamento em partida aberta" — são grupos fixos de 5–6 pessoas que passam por "Reservar quadra". Resolver só a regra nº 5 deixaria o jogo mais comum de fora do rating. Detalhe completo em "Ideias Futuras → Rating e Categorias".

**Por que chat e notificações ficaram para depois (decisão consciente, não esquecimento):** o critério de pronto do MVP acima termina em "registra resultado → vê categoria evoluir" — chat não está nele. O rating é a cunha contra o Playtomic (categorias brasileiras + transparência) e está em 0%, enquanto o trilho de descoberta já está quase pronto. A barra de navegação fixa entra junto porque perfil, histórico e estatísticas do rating precisam dela para existir.

**Nota para quando o chat voltar à pauta:** ele **não depende de fornecedor nenhum** — o Supabase Realtime já roda no projeto (3 canais) e o Web Push é nativo do navegador. Só o *fallback* WhatsApp automático depende de contratar um BSP.

## Convenções de trabalho
- **Ao concluir cada sprint, SEMPRE fazer os dois passos (sem esperar o fundador pedir):** (1) atualizar este CLAUDE.md com o que foi feito, o que ficou pendente e qual o próximo passo; (2) confirmar explicitamente ao fundador que está tudo salvo no GitHub (nada de commit local pendente).
- Commits pequenos e frequentes com mensagens em PT-BR descrevendo o "porquê".
- Antes de qualquer mudança grande, explicar o plano em 3–5 linhas e aguardar ok do fundador.
- Toda funcionalidade nova nasce com: teste no celular real + evento de métrica (PostHog) + **os DOIS documentos da base de conhecimento** (ver `docs/README.md`):
  1. **Documentação técnica** em `/docs/interno/` — o que foi construído, como funciona por dentro, decisões e porquês. Pode citar código, banco e LGPD.
  2. **Artigo(s) para o cliente** em `/docs/[publico]/[categoria]/` — uma pergunta por artigo, no padrão do `docs/Guia_Tom_Estilo_Artigos.md`: frontmatter, resposta curta no topo, passos imperativos, sem jargão, sem citar "LGPD", nome do arquivo em kebab-case. Cada um passa pela `docs/Rubrica_Revisao_Artigos.md` (mínimo 9/10) antes de ir para o fundador.
- Segurança: nunca commitar chaves/segredos (usar variáveis de ambiente); RLS ativado em todas as tabelas do Supabase; antes de ligar pagamentos reais, revisão externa de segurança é obrigatória.
- **Não confiar no documento contra o código.** Antes de afirmar que algo existe ou não, verificar no código — a auditoria de 29/07/2026 achou funcionalidade marcada como pronta que não existia, e funcionalidade pronta que não estava documentada em lugar nenhum. Item marcado `📄` no Checklist nunca foi auditado.
- **LEMBRETE PERMANENTE — vale para todo sprint:** se o Claude Code sugerir pular alguma regra deste arquivo (cobrar taxa do jogador, deixar o painel do clube mono-esporte "para simplificar", adiar LGPD), isso é **sinal de alerta**: o fundador deve parar e questionar antes de aprovar. As regras existem para proteger o posicionamento do produto mesmo quando parece mais fácil no curto prazo não segui-las.
- Documentos de referência completos (escopo, plano de execução, protótipo, diagrama de fluxo) estão no Projeto do Claude.ai e no Google Drive do fundador. O status por funcionalidade fica no `Status_Produto_Checklist.md`, na raiz deste repositório.
