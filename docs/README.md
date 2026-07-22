# Base de conhecimento

Cada funcionalidade do produto tem um artigo aqui explicando **o que faz, como funciona e por quê**, em linguagem simples. A convenção do projeto (ver `CLAUDE.md`) é: toda funcionalidade nova nasce com um artigo correspondente nesta pasta.

## Como escrever e revisar artigos

Estes três documentos definem o padrão. **Releia antes de escrever ou revisar qualquer artigo:**

- [Guia de tom e estilo](Guia_Tom_Estilo_Artigos.md) — o padrão que todo artigo segue: resposta curta no topo, linguagem de padelista (nada de jargão), passos numerados, privacidade implícita e frontmatter obrigatório.
- [Rubrica de revisão](Rubrica_Revisao_Artigos.md) — os 10 critérios da auto-revisão que o Claude Code faz **antes** de mandar qualquer artigo para aprovação, com a régua de nota (10/10 pronto, abaixo de 7 reescreve).
- [Checklist de fim de sprint](Checklist_Sprint_Artigos.md) — o ritual antes de fechar um sprint: conferir se toda funcionalidade entregue tem artigo e listá-los para aprovação.

> ⚠️ Os artigos abaixo foram escritos **antes** deste padrão existir: são documentação técnica interna (o que foi construído e por quê), não artigos voltados ao cliente no formato do guia. Ver pendência no `CLAUDE.md`.

## Artigos

- [Lista de espera (Sprint 0)](lista-espera.md) — landing page que coleta interessados antes do lançamento.
- [Autenticação (Módulo 1.1)](autenticacao.md) — login por WhatsApp/OTP, sem senha.
- [Perfil do jogador e calibração (Módulo 1.1)](perfil-jogador.md) — onboarding, questionário e selo "em calibração".
- [Painel do clube e quadras (Módulo 1.1)](clube-quadras.md) — clube, quadras multiesporte e preços por faixa horária.
- [Descoberta e mapa (Sprint 2)](descoberta-mapa.md) — mapa com preços, filtros, "Jogar agora" e página do clube.
- [Agenda do clube v0 (Sprint 2)](agenda-clube.md) — reservas de balcão com zero overbooking garantido pelo banco.
- [Reserva pelo app (Sprint 3)](reserva-app.md) — reserva em 3 toques, tempo real, cancelamento e remarcação dentro da política do clube.
