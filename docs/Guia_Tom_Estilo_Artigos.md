# GUIA DE TOM E ESTILO PARA ARTIGOS DA BASE DE CONHECIMENTO
### Padrão que todos os artigos devem seguir — para clientes usarem + IA de atendimento aprender
*Salvo no repositório em `/docs/Guia_Tom_Estilo_Artigos.md`. Releia antes de cada sprint.*

---

## Princípios fundamentais

1. **Resposta curta no topo.** O leitor humano quer saber a resposta já. A IA de atendimento precisa dela para dar uma resposta curta e depois oferecer o link completo.
2. **Linguagem de padelista, não de documentação.** "Dividir o PIX", não "processar split de transação financeira".
3. **Passos numerados e testáveis.** Cada passo é um clique ou ação real, não uma ideia abstrata.
4. **LGPD é invisível, mas onipresente.** Nunca mencione explicitamente "conforme LGPD" — só implemente: dados que o usuário inseriu, ele pode exportar ou deletar; dados de terceiros ele não vê.
5. **Cada artigo é uma resposta a UMA pergunta.** Se tem "E se..." e "Mas e quando...", quebra em artigos separados e linke-os.

---

## Estrutura obrigatória de cada artigo

### 1. Frontmatter (metadados)
```
---
titulo: [Pergunta que o artigo responde — 60 chars máx.]
publico: [jogadores | clubes | professores | parceiros | interno]
categoria: [comecando | partidas | reservas-pagamentos | ranking-categorias | agenda | financeiro | etc.]
atualizado: [YYYY-MM-DD]
palavras-chave: [palavra1, palavra2, palavra3, ...]
---
```

**Exemplo real:**
```
---
titulo: Como remarcar um jogo sem perder a reserva
publico: jogadores
categoria: reservas-pagamentos
atualizado: 2026-07-22
palavras-chave: remarcar, reserva, horário, mudança
---
```

### 2. Título H1
Repita o titulo do frontmatter, palavra por palavra.
```markdown
# Como remarcar um jogo sem perder a reserva
```

### 3. Resposta curta (obrigatória, em negrito)
Máximo 2–3 linhas. Responde a pergunta SEM os passos. Deve fazer sentido sozinha se o leitor só ler até aqui.

```markdown
**Resposta curta:** na tela "Minhas reservas", toque "Remarcar" no jogo que quer mover. 
Escolha o novo horário e confirme — o dinheiro recalcula sozinho.
```

❌ **NUNCA faça assim:**
```markdown
**Resposta:** leia abaixo
**Resposta:** é complicado, depende de vários fatores
```

### 4. Seção principal (opcional, depende da resposta)
Se a resposta curta foi suficiente, pule direto para "Perguntas relacionadas". Se precisa de contexto ou passos, use uma seção com título claro:

```markdown
## Passo a passo

1. Abra o app e toque em "Minhas reservas".
2. Procure o jogo que quer remarcar.
3. Toque "Remarcar" (não é cancelar).
4. Escolha a nova data e horário na grade.
5. Confirme — o preço recalcula, se mudar.
```

**Regras dos passos:**
- Cada passo começa com um **verbo** ("Abra", "Toque", "Escolha", não "A tela mostra").
- Máximo 5–7 passos (se tiver mais, divida em artigos).
- Se for escolher entre opções, use **negrito**: toque **"Remarcar"** (não toque "Remarcar").
- Se houver screenshot, descreva-o em itálico abaixo do passo: *A tela mostra a lista com opção "Remarcar" em verde.*

### 5. Seções opcionais (use só se relevante)

#### "E se...?" → Cenários comuns
```markdown
## E se o novo horário tiver preço diferente?

Se o novo horário é mais caro, o diferença é cobrado no PIX na hora.
Se é mais barato, a diferença volta na sua conta.
```

#### "Quando isso não funciona" → Bloqueios conhecidos
```markdown
## Quando não consigo remarcar?

- Faltam menos de 12 horas para o jogo original (política de cancelamento).
- O novo horário já tem outra reserva.
- O clube desativou o jogo (manutenção, fechado).
```

#### "Privacidade" → LGPD implícito
Só use se o artigo mexe com dados pessoais ou de terceiros:

```markdown
## Privacidade

Suas reservas ficam invisíveis para outros jogadores — eles só veem 
que o horário está ocupado, sem saber quem reservou.
```

### 6. Perguntas relacionadas (obrigatória)
Lista 2–3 artigos que o leitor pode precisar depois. Format: `- [Pergunta]` (sem URL — a base de conhecimento linka automaticamente).

```markdown
## Perguntas relacionadas

- Como cancelar uma reserva?
- Por que a política de cancelamento existe?
- Como funciona a divisão de PIX entre 4 jogadores?
```

### 7. Contato (obrigatória, padrão para todos)
```markdown
## Ainda com dúvida?

Fale com a gente no WhatsApp: [LINK QUE O FUNDADOR FORNECE]
```

---

## Regras de linguagem

### ✅ Sim
- "Toque no botão verde" (localiza visualmente)
- "Você recebe uma mensagem no WhatsApp" (voz ativa, pessoal)
- "Máximo 12h antes" (específico)
- "Revise a política de cancelamento do clube" (claro o que fazer)

### ❌ Não
- "Acione o botão" (formal demais)
- "Uma notificação é enviada ao usuário" (voz passiva, genérico)
- "Cancelamento sujeito a políticas aplicáveis" (vago)
- "Consulte a documentação de cancelamento" (sem ação concreta)

### Números e unidades
- Sempre em numerais: "12 horas", não "doze horas"
- Abreviaturas conhecidas: "R$ 50" (not "cinquenta reais")
- Horários: "19h30", "8h" (não "19:30" em formal)

### Pontuação
- Frases curtas. Período no final de cada sentença.
- Sem ponto-e-vírgula (excepto em listas).
- "—" para interrupções ou exemplos (não hífens simples).

---

## Estrutura por público

### Artigos para **Jogadores**
Foco: "como eu uso isso agora?"
- Resposta curta super direta.
- Passos curtos (máximo 5).
- Menção de "próximos passos" (ex: "depois toque em 'Confirmar'").
- Privacidade relevante (ex: "outros não veem quem reservou").

**Exemplo:**
- `como-dividir-pix.md`
- `como-remarcar-jogo.md`
- `como-calcular-meu-rating.md`

### Artigos para **Clubes**
Foco: "como gerencio isto para meus clientes?"
- Resposta curta sobre impacto no negócio.
- Passos de configuração ou monitoramento.
- Relatórios e números.
- Política clara do que o dono controla.

**Exemplo:**
- `como-definir-politica-cancelamento.md`
- `como-consultar-ocupacao-das-quadras.md`
- `como-promover-horario-vazio.md`

### Artigos para **Interno** (funcionários, embaixadores, IA de atendimento)
Foco: "como eu respondo a esta pergunta?"
- Respostas de diferentes públicos compiladas.
- Exemplos de objeções e contrarrespostas.
- Tom de voz para comercial, suporte, etc.

**Exemplo:**
- `/docs/interno/respostas-comercial-clube.md`
- `/docs/interno/respostas-suporte-jogador.md`
- `/docs/interno/tom-de-voz.md`

---

## Checklist antes de enviar para aprovação

Para cada artigo novo, o Claude Code deve:

- [ ] Frontmatter completo (titulo, publico, categoria, atualizado, palavras-chave).
- [ ] Resposta curta em negrito, isolada, máximo 3 linhas.
- [ ] Título H1 = titulo do frontmatter.
- [ ] Se tem passos, máximo 7 e cada um começa com verbo.
- [ ] Nenhum jargão técnico ("token", "query", "trigger" → traduz ou explica).
- [ ] Perguntas relacionadas: 2–3 itens.
- [ ] Contato padrão no rodapé.
- [ ] Sem links internos com URL — só nomes de artigos ("Como remarcar" not "[Como remarcar](url)").
- [ ] Nenhuma menção explícita a LGPD ou siglas obscuras sem explicação.
- [ ] Arquivo nomeado em kebab-case: `como-dividir-pix.md` (não "Como Dividir PIX.md").

---

## Exemplos de artigos a escrever

Quando os sprints chegarem, esses artigos serão exemplos de padrão correto e ficarão em `/docs/` como referência:
- 🔜 `como-jogar-agora.md` (Sprint 2)
- 🔜 `como-criar-partida.md` (Sprint 5+)
- 🔜 `como-remarcar-jogo.md` (Sprint 3)

Copie o tom, a estrutura e o nível de detalhe deles.

---

## Reescrita rápida (quando o fundador diz "reescreva")

Se o fundador pedir reescrever, observe:
- **"Muito técnico"** → traduz jargão, simplifica.
- **"Faltam passos"** → adiciona numeração e ações concretas.
- **"Ambíguo"** → especifica: "próximos 3 horas", not "em breve".
- **"Sem privacidade"** → adiciona linha sobre dados pessoais.

O Claude Code faz a reescrita na mesma sessão; refaz na hora — não precisa esperar sprint novo.

---

*Última revisão: 22/07/2026. Próxima: após o Sprint 4, com exemplos reais de artigos aprovados do produto.*
