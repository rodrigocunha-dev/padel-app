# Lista de espera (Sprint 0)

## O que é
Página única no ar (Vercel) que apresenta o produto e coleta interessados antes do lançamento: **nome, WhatsApp, cidade, clube onde joga (opcional) e categoria (1ª a 7ª, ou "não sei")**.

## Onde fica no código
- Página: `src/app/page.tsx`
- Formulário: `src/components/ListaEsperaForm.tsx`
- Alternador de variante de cor: `src/components/TemaToggle.tsx`
- Cores e fontes: `src/app/globals.css` + `src/app/layout.tsx`
- Conexão com o banco: `src/lib/supabase.ts`
- Criação da tabela: `supabase/sql/001_lista_espera.sql`

## Como funciona
1. O visitante preenche o formulário. O WhatsApp é normalizado (só dígitos) antes de salvar.
2. O registro vai direto do navegador para a tabela `lista_espera` no Supabase, usando a chave pública (anon).
3. **Segurança (RLS):** a tabela só aceita INSERT do público. Ninguém consegue LER a lista pelo site — os dados só são visíveis no painel do Supabase (Table Editor), acessado pelos fundadores.
4. **Duplicados:** o banco recusa o mesmo WhatsApp duas vezes (índice único). O site mostra "esse WhatsApp já está na lista" em vez de erro técnico.

## Decisões e porquês
- **Duas variantes de cor** (verde-quadra `#0E5C46` e azul-quadra `#0B4F86`, ambas com amarelo-bola `#D6F455`): botão no topo da página alterna entre elas para o fundador comparar e escolher. Ao decidir, remover a variante perdedora e o botão.
- **Textos neutros, sem nome de marca:** finalistas (FaltaUm / Fechou) ainda em decisão.
- **Sem backend próprio:** o formulário fala direto com o Supabase — menos peças para manter no Sprint 0.

## Como ver os cadastros
Supabase → projeto → **Table Editor** → tabela `lista_espera`. Dá para exportar CSV por lá.

## Pendências conhecidas
- Evento de métrica (PostHog) ainda não instalado — adicionar quando a conta for criada.
- LGPD: quando houver marca definida, adicionar link de política de privacidade na página.
