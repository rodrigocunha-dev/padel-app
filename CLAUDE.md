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
- Backend/banco/auth/realtime: **Supabase (PostgreSQL)** — banco sport-agnostic: toda quadra tem campo `esporte`; jogador poderá ter perfis por esporte no futuro.
- Pagamentos: **Asaas ou Pagar.me** (split de PIX).
- Mensageria: WhatsApp Business API via BSP (ex.: Z-API).
- Mapas: Google Maps Platform. Métricas: PostHog. Deploy: Vercel. Código: GitHub.

## Restrições da máquina de desenvolvimento
Notebook i3 11ª gen, 8 GB RAM, pouco disco. Portanto: nada de emulador Android, nada de Docker pesado, preferir serviços na nuvem (Supabase remoto, não local). Testes mobile no celular real / navegador.

## Fases (resumo)
- **Fase 1 (MVP, meses 1–4):** onboarding, mapa de quadras, partidas abertas, reserva + PIX split, resultados + rating + categorias, chat da partida, painel do clube com agenda multiesporte. Critério de pronto do MVP: jogador descobre clube → entra/cria partida → reserva e paga dividido → registra resultado → vê categoria evoluir; clube opera 100% da agenda sem caderno.
- **Fase 2 (5–10):** torneios com chaveamento automático, ligas/rachões, gamificação completa (temporadas trimestrais), Premium do jogador, comanda de bar, mensalistas, CRM, aulas.
- **Fase 3 (11–18):** professores como vertical, beach tennis no lado do jogador, marketplace, vídeo, IA, expansão.

## Sprint atual
**Sprint 0 — Landing + lista de espera.** Objetivo: página no ar (Vercel) coletando nome, WhatsApp, cidade, clube onde joga e categoria, salvando no Supabase. Identidade provisória: verde-quadra `#0E5C46` + amarelo-bola `#D6F455`, fontes Archivo (títulos) e Inter (texto). Nome da marca ainda não decidido (finalistas: FaltaUm, Fechou) — usar textos neutros e fáceis de trocar.

## Convenções de trabalho
- Commits pequenos e frequentes com mensagens em PT-BR descrevendo o "porquê".
- Antes de qualquer mudança grande, explicar o plano em 3–5 linhas e aguardar ok do fundador.
- Toda funcionalidade nova nasce com: teste no celular real + evento de métrica (PostHog) + **artigo correspondente na base de conhecimento em `/docs`** (ver `docs/README.md`).
- Segurança: nunca commitar chaves/segredos (usar variáveis de ambiente); RLS ativado em todas as tabelas do Supabase; antes de ligar pagamentos reais, revisão externa de segurança é obrigatória.
- Documentos de referência completos (escopo, plano de execução, protótipo) estão no Projeto do Claude.ai e no Google Drive do fundador.
