# Perfil do jogador e calibração inicial (Módulo 1.1)

## O que é
Após o primeiro login, o jogador monta o perfil em passos curtos no celular: nome e cidade → foto (opcional) → **questionário de calibração** → categoria → posição → disponibilidade e raio de deslocamento.

## Onde fica no código
- Fluxo: `src/app/app/onboarding/page.tsx` + `src/components/OnboardingJogador.tsx`
- Regras do questionário: `src/lib/calibracao.ts`
- Tela inicial do jogador: `src/app/app/page.tsx`
- Tabela: `jogadores` (script `supabase/sql/002_contas_onboarding.sql`)

## Calibração (regra de negócio nº 4)
- 5 perguntas: tempo de jogo, frequência, torneios, outros esportes de raquete, autoavaliação. Cada resposta pontua; a soma (0–14) sugere a categoria de largada.
- **Teto da sugestão é a 2ª** — ninguém "entra elite" por formulário; a 1ª se conquista em quadra.
- O jogador pode ajustar a sugestão (fica registrado que ajustou, e para qual).
- O perfil nasce com o selo **"⚖️ Em calibração"**. O selo sai quando houver validação por 2 pares + 5 partidas com peso maior (módulos futuros). As respostas ficam guardadas em `calibracao_respostas` para alimentar o motor de rating.

## Outros campos
- Posição: esquerda / direita / ambas.
- Disponibilidade: grade dia da semana × turno (manhã/tarde/noite), salva como lista JSON.
- Raio: 5–50 km (usado pelo matchmaking no futuro).
- Foto: enviada ao Supabase Storage (bucket `fotos`, pasta por usuário). Se o upload falhar, o cadastro segue sem foto — não trava.

## Segurança
RLS: qualquer jogador logado pode VER perfis (necessário para matchmaking); cada um só cria/edita o PRÓPRIO perfil; visitantes sem login não veem nada.

## Métricas
- `onboarding_iniciado`, `calibracao_concluida` (pontos + categoria sugerida), `onboarding_concluido` (sugerida × escolhida, se ajustou, cidade, raio, tem foto)
