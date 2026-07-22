# Autenticação — login por WhatsApp/OTP (Módulo 1.1)

## O que é
Login sem senha: o jogador digita o número de WhatsApp, recebe um código de 6 dígitos e entra. A sessão fica guardada em cookies e vale tanto para o app do jogador (`/app`) quanto para o painel do clube (`/clube`).

## Onde fica no código
- Tela de login: `src/app/entrar/page.tsx` + `src/components/LoginOtp.tsx`
- Proteção de rotas: `src/proxy.ts` (quem não está logado é redirecionado para `/entrar`)
- Clientes Supabase: `src/lib/supabase/client.ts` (navegador) e `server.ts` (servidor)
- Sair: `src/components/BotaoSair.tsx`

## Como funciona
1. O número digitado é convertido para o formato internacional (+55...).
2. O Supabase Auth gera e envia o código; ao confirmar, cria a sessão em cookies.
3. O `proxy.ts` valida a sessão **no servidor** a cada acesso às áreas protegidas (usa `getUser()`, que confere com o Supabase — não confia só no cookie).

## Fase atual: números de teste (fase A)
O envio real de mensagem ainda **não** está ativo. No painel do Supabase (Authentication → Providers → Phone) há um número de teste `5551999998888` com código fixo `123456`, válido até 31/10/2026. Os campos da Twilio estão preenchidos com valores fictícios de propósito.

## Fase B — antes do lançamento
Trocar os valores fictícios pelas credenciais reais da Twilio (Verify/WhatsApp) na mesma tela do painel. Custo estimado: centavos por login. As credenciais reais são SECRETAS — nunca colar em chats ou commits.

## Métricas
- `login_codigo_enviado` — pediu código
- `login_concluido` — entrou
