# Web Push e PWA

*Construído em 12/08/2026. Script `031`. Decisão de produto no CLAUDE.md, "Partida privada → notificar virou requisito da Decisão 1".*

O push existe por causa de uma regra: **"quem não contestar em 24h concordou"**. Isso só é justo se a pessoa teve **chance real de saber**. O aviso dentro do app alcança quem abre o app; o push alcança quem não abriu.

---

## O achado que mudou o tamanho da tarefa

O projeto **não tinha nada de PWA** — sem manifesto, sem ícones, sem service worker. O "PWA primeiro" da seção de stack era intenção, não código.

E isso importa porque **no iPhone o Web Push exige o app instalado na tela de início**: sem isso o Safari não deixa nem *pedir* permissão. Confirmado em 12/08/2026 ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Notificare](https://notificare.com/blog/2024/09/16/web-push-in-ios-add-to-home-screen/)); vale desde o iOS 16.4 e alcança também Chrome e Edge no iPhone, que usam o mesmo motor.

Logo, a entrega foi *tornar instalável* **+** *ligar o push*.

⚠️ **O ícone e o nome são provisórios.** A marca (FaltaUm ou Fechou) e a cor (verde ou azul) não estão decididas, e o PWA põe as duas na tela de início do usuário — essas pendências deixaram de ser invisíveis.

---

## Onde está cada coisa

| Peça | Arquivo |
|---|---|
| Manifesto (o que torna instalável) | `public/manifest.webmanifest` |
| Ícones | `public/icone-192.png`, `icone-512.png`, `apple-touch-icon.png` |
| Service worker | `public/sw.js` |
| Meta tags e link do manifesto | `src/app/layout.tsx` |
| Pedir permissão e inscrever | `src/components/AtivarNotificacoes.tsx` |
| Navegar ao tocar na notificação | `src/components/IrPelaNotificacao.tsx` |
| Disparar o envio | `src/lib/push.ts` |
| Enviar | `src/app/api/push/enviar/route.ts` |
| Inscrições e pendências | script `031` |

### Os ícones são PNG gerados na mão

Sem dependência: um script escreve o PNG usando só o `zlib` do Node. Um pacote de imagem só para desenhar um círculo não se justificava. O gerador está no scratchpad, não no repositório — os ícones são o artefato.

---

## Variáveis de ambiente

| Nome | Onde | O que é |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel + `.env.local` | identifica nosso servidor para o navegador. Pública por natureza — vai no código do cliente |
| `VAPID_PRIVATE_KEY` | só Vercel | assina o envio. **Secreta** |
| `SUPABASE_SERVICE_ROLE_KEY` | só Vercel | **ignora todas as travas do banco.** Necessária porque o envio cruza avisos e inscrições de várias pessoas |

⚠️ A chave de serviço **nunca** pode ter o prefixo `NEXT_PUBLIC_` — isso a mandaria para o navegador de todo mundo. E nenhuma das duas secretas passa pelo chat: as chaves VAPID foram geradas pelo próprio fundador com `npx web-push generate-vapid-keys`, e só a pública foi compartilhada.

Sem as chaves, o envio **não quebra**: a rota responde `{"configurado": false}` e o aviso dentro do app segue funcionando.

---

## Como o envio funciona

A rota `/api/push/enviar` **não recebe "para quem enviar"**. Ela pergunta ao banco quais avisos ainda não viraram push e manda esses. Isso a torna **idempotente** — chamar duas vezes não envia duas, porque a primeira marcou `avisos.push_enviado_em`.

É o que permite chamá-la de vários lugares sem medo. Hoje quem chama é o próprio app, logo depois de registrar um set, contestar ou avisar a votação. Amanhã um agendamento pode chamar a mesma rota sem mudar nada.

Qualquer pessoa logada pode disparar a varredura, e isso é seguro de propósito: a rota não devolve dado de terceiros e só envia o que já estava pendente.

### O que `push_pendentes` filtra, e por quê

- `push_enviado_em is null` — não repetir. Notificação repetida é o jeito mais rápido de alguém desligar a permissão e nunca mais voltar.
- `lido_em is null` — quem já viu dentro do app não precisa ser incomodado.
- `criado_em > now() - 24h` — aviso velho não vira notificação: o prazo provavelmente já passou e chegaria como notícia inútil.
- `invalidado_em is null` — inscrição morta não recebe.

### Inscrição morta

Quando o serviço de push responde **404 ou 410**, a inscrição acabou (app desinstalado, permissão revogada). O endpoint marca `invalidado_em` em vez de apagar — assim dá para ver quanta gente desinstalou, que é dado de produto.

---

## Quando pedir a permissão

O botão fica no **Perfil**, não na Início, e **não aparece no primeiro acesso**.

Pedir permissão antes de a pessoa entender para quê é o jeito mais rápido de levar um "não" — e o navegador guarda esse "não" para sempre, sem segunda chance. O componente também trata:

- **iPhone fora da tela de início** → mostra como instalar. Sem esse ramo, o botão daria erro silencioso e ninguém entenderia por quê.
- **Permissão já negada** → explica que a escolha ficou guardada e como reverter nos ajustes.
- **Sem suporte** → não mostra nada.

---

## Tocar na notificação

Com o app **fechado**, abre direto no destino.

Com o app **aberto em segundo plano**, o caminho óbvio (`aba.navigate()`) recarrega a página inteira — e no iPhone o efeito é ruim: o sistema restaura o app na tela onde a pessoa estava e só alguns segundos depois pula para o jogo. Foi o que o fundador viu no primeiro teste.

Agora o service worker **pede à própria página que navegue por dentro**, via `postMessage`, o que é quase instantâneo. Rede de segurança: ele espera 500 ms por uma confirmação e, se não vier (versão antiga em cache), cai no recarregamento antigo. Mais lento, mas a pessoa **sempre** chega ao lugar certo.

---

## O service worker NÃO faz cache

De propósito. Cache offline é outro assunto, com outros riscos — tela velha, dado desatualizado, gente vendo um placar que já mudou. Misturar as duas coisas numa entrega só é como se erra feio em PWA.

---

## Como foi verificado

- **Local:** manifesto servido, meta tags corretas, service worker registrando, rota respondendo `configurado: false` sem as chaves.
- **Produção, com um aviso real:** um set de fato contestado gerou um aviso de votação para o fundador; a rota respondeu `{"enviados":1,"inscricoes_invalidadas":0,"configurado":true}` e a notificação **chegou no iPhone** e abriu a página do jogo.

⚠️ O primeiro teste falhou por um motivo bobo e instrutivo: **o commit não tinha sido publicado**. O manifesto dava 404 em produção e o iPhone salvou um atalho sem nome nem ícone. Vale lembrar: PWA só se testa depois do deploy.

---

## Quem dispara o envio (script `033`)

Antes, quem pedia o envio era o **navegador de quem agiu**. Se essa pessoa fechasse o app antes, a notificação ficava esperando alguém fazer outra ação. Agora quem pede é o **banco**, por dois caminhos:

**1. Gatilho, no instante em que avisos são criados.** É o mecanismo principal — a notificação sai em segundos. Medido: 6 segundos entre a promoção e o `push_enviado_em` preenchido, sem ninguém chamar a rota.

É um gatilho **por comando, não por linha**: `registrar_set` cria três avisos de uma vez, e um gatilho por linha faria três chamadas idênticas. A rota é idempotente, então não geraria notificação repetida — mas seria desperdício.

**2. Varredura a cada 15 minutos.** Rede de segurança. O `pg_net` é *dispara e esquece*: **não tenta de novo**. Se a rota estiver fora do ar naquele segundo (um deploy acontecendo, por exemplo), sem a varredura aquele aviso **nunca** viraria notificação — não seria atraso, seria perda silenciosa e permanente. E se o `pg_net` não estiver disponível no projeto, a varredura deixa de ser rede e vira o mecanismo.

⚠️ **15 minutos e não uma vez por dia**: o limite diário é da Vercel, não do agendador do Postgres. Um push sobre um prazo de 24h que chega 20h depois avisa que sobraram 4 horas — quase inútil.

### A rota aprendeu a reconhecer o banco

Além da sessão de usuário, ela aceita um **segredo no cabeçalho** (`x-push-secret`). A comparação é em tempo constante: comparar segredo com `===` vaza, pelo tempo de resposta, quantos caracteres iniciais estavam certos.

O segredo e o endereço moram em `push_config`, com RLS ligada e **nenhuma política** — inalcançável pelo app, só pelo SQL Editor e pelas funções `security definer`. O mesmo valor vai na Vercel como `PUSH_SECRET`; se os dois não baterem, o banco chama e a rota recusa **em silêncio**.

### Como conferir

```sql
-- avisos esperando push (deve ficar perto de zero)
select count(*) from public.avisos
where push_enviado_em is null and lido_em is null
  and criado_em > now() - interval '24 hours';

-- as últimas chamadas HTTP que o banco fez
select id, created, status_code from net._http_response order by created desc limit 10;

-- a varredura está agendada?
select jobname, schedule, active from cron.job;
```

## Quando o aviso deixa de aparecer

A marcação de "lido" acontece na **chegada** à página do jogo, e é **por partida** — não por set.

⚠️ Era por set até 12/08/2026, e isso escondia um defeito: o aviso de promoção não tem set, então nunca era encontrado e o bloco ficava na tela para sempre. Marcar por partida cobre os três tipos e não quebra quando surgir um quarto.

## O que ainda não existe

- **Fallback por WhatsApp** para quem não instala o app no iPhone. Decisão de produto em aberto, com prazo de beta.
- **Aviso de convite recebido.** Hoje só resultado registrado, votação aberta e promoção viram push.
