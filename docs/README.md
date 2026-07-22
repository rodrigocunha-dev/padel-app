# Base de conhecimento

Dois tipos de documento convivem aqui, com propósitos diferentes:

- **Artigos para o cliente** (`/jogadores/`, `/clubes/`) — respondem UMA pergunta em linguagem simples, no padrão do guia de tom e estilo. São o que o usuário lê e o que a futura IA de atendimento vai aprender.
- **Documentação técnica interna** (`/interno/`) — explicam o que foi construído, como funciona por dentro e por que decidimos assim. Servem ao fundador e a quem for programar.

A convenção do projeto (ver `CLAUDE.md`) é: **todo sprint gera os dois**.

## Como escrever e revisar artigos

Releia antes de escrever ou revisar qualquer artigo:

- [Guia de tom e estilo](Guia_Tom_Estilo_Artigos.md) — o padrão de todo artigo: resposta curta no topo, linguagem de padelista, passos numerados, privacidade implícita e frontmatter obrigatório.
- [Rubrica de revisão](Rubrica_Revisao_Artigos.md) — os 10 critérios da auto-revisão feita **antes** de mandar qualquer artigo para aprovação, com a régua de nota.
- [Checklist de fim de sprint](Checklist_Sprint_Artigos.md) — o ritual antes de fechar um sprint.

---

## Artigos para jogadores

### Começando
- [Como entrar no app sem senha](jogadores/comecando/como-entrar-no-app.md)
- [Como criar meu perfil de jogador](jogadores/comecando/como-criar-meu-perfil.md)
- [O que significa estar "em calibração"](jogadores/comecando/o-que-significa-em-calibracao.md)
- [Como encontrar um clube perto de mim](jogadores/comecando/como-encontrar-um-clube.md)
- [Como ver quais clubes têm quadra livre agora](jogadores/comecando/como-jogar-agora.md)

### Reservas e pagamentos
- [Como reservar uma quadra](jogadores/reservas-pagamentos/como-reservar-uma-quadra.md)
- [Como remarcar um jogo sem perder a reserva](jogadores/reservas-pagamentos/como-remarcar-jogo.md)
- [Como cancelar uma reserva](jogadores/reservas-pagamentos/como-cancelar-uma-reserva.md)

## Artigos para clubes

### Começando
- [Como cadastrar meu clube e aparecer no mapa](clubes/comecando/como-cadastrar-meu-clube.md)
- [Como cadastrar minhas quadras e preços](clubes/comecando/como-cadastrar-quadras-e-precos.md)

### Agenda
- [Como anotar uma reserva de balcão](clubes/agenda/como-anotar-reserva-de-balcao.md)
- [Como acompanhar a ocupação das minhas quadras](clubes/agenda/como-acompanhar-a-ocupacao.md)
- [Como definir a política de cancelamento do meu clube](clubes/agenda/como-definir-politica-de-cancelamento.md)

---

## Documentação técnica interna

- [Lista de espera (Sprint 0)](interno/lista-espera.md) — landing que coleta interessados antes do lançamento.
- [Autenticação (Sprint 1)](interno/autenticacao.md) — login por telefone/OTP, sem senha.
- [Perfil do jogador e calibração (Sprint 1)](interno/perfil-jogador.md) — onboarding, questionário e selo.
- [Painel do clube e quadras (Sprint 1)](interno/clube-quadras.md) — clube, quadras multiesporte e preços.
- [Descoberta e mapa (Sprint 2)](interno/descoberta-mapa.md) — mapa, filtros, "Jogar agora" e página do clube.
- [Agenda do clube (Sprint 2)](interno/agenda-clube.md) — reservas de balcão e zero overbooking pelo banco.
- [Reserva pelo app (Sprint 3)](interno/reserva-app.md) — reserva em 3 toques, tempo real e política de cancelamento.

---

*Os artigos de cliente usam `[DEFINIR]` no rodapé de contato até o WhatsApp de suporte existir. Ao definir, substituir em todos de uma vez.*
