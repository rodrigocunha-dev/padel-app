# Painel do clube — cadastro e quadras multiesporte (Módulo 1.1)

## O que é
Em `/clube`, o dono cadastra o clube e gerencia quadras de **qualquer esporte** (regra de negócio nº 2: agenda multiesporte, alma padel): padel, beach tennis, tênis e futebol society.

## Onde fica no código
- Página: `src/app/clube/page.tsx`
- Cadastro do clube: `src/components/clube/CadastroClube.tsx`
- Quadras e preços: `src/components/clube/GerenciarQuadras.tsx`
- Tabelas: `clubes`, `quadras`, `quadra_precos` (script `supabase/sql/002_contas_onboarding.sql`)

## Como funciona
1. **Clube:** nome e endereço obrigatórios; telefone opcional. Um clube por dono nesta fase.
   - **A cidade nunca é digitada:** vem sempre do endereço buscado no mapa (OpenStreetMap), e é reconfirmada toda vez que a localização é salva. Isso existe porque um clube cadastrou "NH" em vez de "Novo Hamburgo" e sumiu do filtro por cidade do jogador — com a cidade derivada do mapa, o nome é sempre o oficial.
2. **Quadras:** nome, esporte, tipo de piso (filtrado por esporte: padel → vidro/alvenaria; beach tennis → areia; tênis → saibro/grama; society → grama sintética) e coberta ou não.
3. **Preços por faixa horária:** cada faixa tem dias da semana, horário (das/até) e valor por hora. Os valores são gravados **em centavos** (evita erro de arredondamento — padrão para dinheiro em software). Ex.: Ter e Qui, 18:00–23:00, R$ 140/h.

## Decisões e porquês
- Preço por faixa (e não um preço fixo) prepara o terreno para a promoção de horários ociosos (Fase 1) sem mudar o banco.
- Dias como lista (0=domingo…6=sábado) permite faixas tipo "seg a sex" numa linha só.

## Segurança
RLS: só o dono do clube cria/edita/apaga suas quadras e preços; jogadores logados podem ver (vão precisar para reservar); sem login, nada aparece.

## Métricas
- `clube_criado` (cidade), `quadra_criada` (esporte, tipo, coberta), `preco_quadra_criado` (valor)
