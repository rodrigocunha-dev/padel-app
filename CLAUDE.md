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
5. **Só partidas de 4 jogadores em modo competitivo afetam o rating.** Partidas com revezamento (5–8 jogadores) contam para estatísticas e conquistas, não para rating.
6. **Partidas abertas:** faixa de categoria aceita; sexo do jogo (masculino/feminino/mista); 4 a 8 jogadores (5+ = modo revezamento, valor da quadra dividido entre todos); fila de substitutos automática quando alguém sai.
7. **Pagamentos:** PIX com split automático entre os jogadores via gateway (Asaas ou Pagar.me); repasse direto ao clube; cobrança de pendentes via WhatsApp; políticas de cancelamento definidas por clube e exibidas ANTES do pagamento.
8. **Zero overbooking:** trava de concorrência na agenda em tempo real. Reserva editável dentro da política do clube.
9. **WhatsApp é canal nativo:** notificações push com fallback para WhatsApp.
10. **LGPD desde o dia 1:** consentimento, exportação e exclusão de dados.

## Stack (decidida — não trocar sem discutir)
- App do jogador: **PWA primeiro** (Next.js), Flutter só na fase de lojas (builds via Codemagic, nunca Android Studio local).
- Painel do clube: **Next.js**.
- Backend/banco/auth/realtime: **Supabase (PostgreSQL)** — banco sport-agnostic: toda quadra tem campo `esporte`; jogador poderá ter perfis por esporte no futuro. RLS ativado em todas as tabelas desde a primeira.
- Mapas: **OpenStreetMap + Leaflet** (decisão do fundador: gratuito, sem conta nem cartão). Google Maps fica como opção futura.
- Pagamentos: **Asaas ou Pagar.me** (split de PIX).
- Mensageria: WhatsApp Business API via BSP (ex.: Z-API).
- Métricas: **PostHog (US Cloud)**. Deploy: **Vercel (deploy automático a cada push)**. Código: **GitHub — github.com/rodrigocunha-dev/padel-app**.

## Restrições da máquina de desenvolvimento
Notebook i3 11ª gen, 8 GB RAM, pouco disco. Portanto: nada de emulador Android, nada de Docker pesado, preferir serviços na nuvem (Supabase remoto, não local). Testes mobile no celular real / navegador.

## Identidade visual (provisória)
Verde-quadra `#0E5C46` + amarelo-bola `#D6F455`, fontes Archivo (títulos) e Inter (texto). Existe uma segunda variante azul-quadra `#0B4F86` alternável na landing, criada para comparação — **pendente**: fundador decidir qual variante fica e remover a perdedora. Nome da marca ainda não decidido (finalistas: FaltaUm, Fechou) — todo texto do produto deve seguir neutro até a decisão, fácil de trocar.

## Fases (resumo)
- **Fase 1 (MVP, meses 1–4):** onboarding, mapa de quadras, partidas abertas, reserva + PIX split, resultados + rating + categorias, chat da partida, painel do clube com agenda multiesporte. Critério de pronto do MVP: jogador descobre clube → entra/cria partida → reserva e paga dividido → registra resultado → vê categoria evoluir; clube opera 100% da agenda sem caderno.
- **Fase 2 (5–10):** torneios com chaveamento automático, ligas/rachões, gamificação completa (temporadas trimestrais), Premium do jogador, comanda de bar, mensalistas, CRM, aulas.
- **Fase 3 (11–18):** professores como vertical, beach tennis no lado do jogador, marketplace, vídeo, IA, expansão.

Todos os comandos de retomada, sprint a sprint e módulo a módulo, estão no documento **Comandos_de_Retomada_Sprints.md** (Projeto do Claude.ai e Drive do fundador). Use-os para abrir cada sessão.

## Sprint atual

**Sprint 0 — Landing + lista de espera: ✅ CONCLUÍDO (19/07/2026).**
Site no ar em https://padel-app-liart.vercel.app/. Formulário salva no Supabase (tabela `lista_espera`, RLS só-INSERT) e dispara evento `cadastro_lista_espera` no PostHog.

**Sprint 1 — Contas e Onboarding: ✅ CONCLUÍDO (20/07/2026), testado pelo fundador no celular.**
Implementado: login por telefone/OTP com máscara `(DD) 99999-9999` (fase A com número de teste `5551999998888`/código `123456` até 31/10/2026); onboarding do jogador em /app (nome, foto no Storage, cidade, questionário de calibração com teto de sugestão na 2ª, selo "em calibração", posição, disponibilidade dia×turno, raio); painel do clube em /clube (clube + quadras multiesporte com piso compatível por esporte + preços por faixa horária em centavos, com trava dupla contra sobreposição — tela e trigger no banco). Rotas protegidas por proxy com sessão em cookies. Scripts SQL: `002` e `003`. Artigos em /docs e eventos PostHog em todos os passos-chave.

**Sprint 2 — Descoberta, Mapa e Painel do Clube v0: ✅ CONCLUÍDO (20/07/2026), testado pelo fundador no celular.**
Implementado:
- **Mapa e descoberta (/app/descobrir):** Leaflet + OpenStreetMap. Pin mostra o menor preço/h. Alternador **Mapa | Lista**. Filtros: esporte e tipo de quadra em multi-seleção **com opções em cascata** (só aparece o que existe nos clubes); só cobertas; preço máx.; cidade ("onde estou" por GPS, ou qualquer cidade com clube); distância de 1 a 50 km. **"Jogar agora"** = clubes com 1h contínua livre nas próximas 3h. **Busca por data futura** (data + janela de horário + "só clubes com horário livre nesse período").
- **Página do clube (/app/clubes/[id]):** fotos, descrição, esportes/quadras, horário de funcionamento derivado das faixas de preço, mini-mapa com rota, telefone, política de cancelamento, avaliações 1–5 com comentário e botão de WhatsApp.
- **Painel do clube:** edição de informações (nome, telefone, descrição, política de cancelamento), **cidade não editável — sempre derivada do endereço no mapa** (proteção descoberta no teste: "NH" vs "Novo Hamburgo" quebrava o filtro), localização com busca de endereço e pin ajustável, upload de várias fotos de uma vez.
- **Agenda (/clube/agenda):** visões **Dia | Semana | Mês** com seletor de calendário; dia = grade quadra×hora com reserva de balcão (nome, WhatsApp, duração) e cancelamento; semana/mês = mapa de calor de ocupação com cada dia clicável levando à agenda daquele dia. **Zero overbooking garantido pelo banco** (exclusion constraint, testado por fora da interface) e reservas de terceiros invisíveis para jogadores (LGPD).
- Scripts SQL: `004` (coordenadas, fotos, avaliações, reservas) e `005` (descrição e política de cancelamento). Artigos em /docs e eventos PostHog em todos os passos-chave.

**Pendências acumuladas (não bloqueiam o próximo sprint, mas têm prazo):**
- Decidir variante de cor (verde vs. azul) e remover a perdedora.
- Política de privacidade LGPD quando a marca for decidida.
- Elaborar perguntas de calibração melhores (as atuais são provisórias).
- ⚠️ **Fase B da autenticação (Twilio real) antes de 31/10/2026** — o número de teste expira nessa data; sem isso, ninguém mais consegue logar. Credenciais do Twilio são SECRETAS: nunca colar no chat nem commitar — sempre em variável de ambiente, e o próprio fundador cadastra a chave direto no painel da hospedagem (Vercel), sem passar pelo Claude Code.
- Definir o escopo do Premium do jogador (Fase 2). Candidata já identificada pelo fundador: busca de quadra por cidade + data futura ("planejando viagem"), hoje liberada para todos.
- **Evoluir a agenda do clube** (ideias para adiante): bloqueios recorrentes/mensalistas, arrastar para remarcar, filtro por esporte/quadra.
- **Botão de troca de modo (jogador ↔ painel do clube)** para donos e funcionários de clube, que hoje precisam navegar entre `/app` e `/clube` na mão. Ligado a isto: na tela do jogador a política de cancelamento vale para todos, inclusive o dono (no servidor o dono é isento). Decisão de 22/07/2026: **manter assim**; se mudar, tratar junto com o botão de troca de modo.

**Sprint 3 — Módulo 1.4 (parte 1): Agenda em Tempo Real: ✅ CÓDIGO PRONTO E TESTADO (21/07/2026) — falta o teste do fundador no celular.**
Implementado:
- **Reserva pelo app em 3 toques** (`/app/clubes/[id]/reservar`): "Reservar quadra" → toca no horário livre → confirma. Dia (Hoje/Amanhã/calendário), quadra e duração (1h/1h30/2h) com grade de horários e preço em cada um.
- **Zero overbooking comprovado:** duas reservas idênticas disparadas no mesmo instante — uma entrou, a outra recusada pelo banco (`23P01`). Também recusa sobreposição parcial, horário fora do funcionamento e horário no passado. A garantia é a exclusion constraint + a função `reservar_quadra` (valida funcionamento, calcula preço e grava de uma vez).
- **Tempo real** (Supabase Realtime): a grade do jogador e a agenda do clube se atualizam sozinhas, sem recarregar a página (verificado).
- **LGPD:** o jogador nunca lê reservas alheias. Para saber o que está ocupado, lê `agenda_publica` — espelho mantido por gatilho com **só quadra, início e fim** (4 colunas, sem dado pessoal).
- **Política de cancelamento que o sistema faz valer:** clube escolhe "cancelamento livre até X horas antes" (padrão 12h) + texto livre de detalhes. O jogador vê o prazo exato; passado o prazo, cancelar/remarcar é bloqueado **no servidor** (gatilho). O dono do clube não é limitado pela política.
- **Minhas reservas** (`/app/reservas`): próximos jogos, cancelar e **remarcar** (move a mesma reserva — preço recalculado no servidor, permite mover para horário encostado, e se o novo horário for tomado a reserva original continua de pé).
- Agenda do clube mostra reservas do app com 📱 e o **nome do jogador**.
- Scripts SQL: `006` (política em horas, espelho público, preço na reserva, `reservar_quadra`, realtime) e **`007` (remarcar) — ⚠️ ainda não rodado pelo fundador**. Artigo em `/docs/reserva-app.md` e eventos PostHog.

**Para fechar o Sprint 3 (depende do fundador):**
1. Rodar o script `supabase/sql/007_remarcar_reserva.sql` — sem ele o botão "Remarcar" não funciona.
2. Autorizar o push (commits prontos localmente).
3. Testar no celular.
4. **Testar o bloqueio da política exige uma segunda conta**: hoje a conta de teste é dona do clube, e o dono é isento da política de propósito. Para ver o bloqueio, adicionar outro número de teste no Supabase (ex.: `5551999997777` = `654321`) e entrar como jogador comum.

**Sprint 4 — 🔜 PRÓXIMO.** Comando de abertura no Comandos_de_Retomada_Sprints.md. Pelo plano de fases, o caminho natural é reserva com **PIX dividido** (regra nº 7) e/ou partidas abertas.

## Convenções de trabalho
- **Ao concluir cada sprint, SEMPRE fazer os dois passos (sem esperar o fundador pedir):** (1) atualizar este CLAUDE.md com o que foi feito, o que ficou pendente e qual o próximo passo; (2) confirmar explicitamente ao fundador que está tudo salvo no GitHub (nada de commit local pendente).
- Commits pequenos e frequentes com mensagens em PT-BR descrevendo o "porquê".
- Antes de qualquer mudança grande, explicar o plano em 3–5 linhas e aguardar ok do fundador.
- Toda funcionalidade nova nasce com: teste no celular real + evento de métrica (PostHog) + **artigo correspondente na base de conhecimento em `/docs`** (ver `docs/README.md`).
- Segurança: nunca commitar chaves/segredos (usar variáveis de ambiente); RLS ativado em todas as tabelas do Supabase; antes de ligar pagamentos reais, revisão externa de segurança é obrigatória.
- Documentos de referência completos (escopo, plano de execução, protótipo, diagrama de fluxo, comandos de retomada) estão no Projeto do Claude.ai e no Google Drive do fundador.
