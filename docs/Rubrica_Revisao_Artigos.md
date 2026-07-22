# RUBRICA DE REVISÃO PARA ARTIGOS
### Auto-revisão que o Claude Code faz antes de enviar para aprovação
*Salvo no repositório em `/docs/Rubrica_Revisao_Artigos.md`. Releia antes de cada revisão.*

---

## Como usar esta rubrica

**Para o Claude Code:** antes de listar os artigos para o fundador, passe cada um por este checklist e marque se passou ✅ ou não ⚠️. Se não passou, refaz o artigo antes de mostrar.

**Para o fundador (revisão final):** quando recebe os artigos aqui no chat, esta rubrica é a **lente** para ler rápido. Se o Claude Code já passou pela auto-revisão, sua revisão final é mais superficial — só confirma que está pronto.

---

## RUBRICA — 10 critérios

### 1. ✅ Frontmatter completo
- [ ] `titulo:` — pergunta clara, máx 60 caracteres
- [ ] `publico:` — um de: jogadores | clubes | professores | parceiros | interno
- [ ] `categoria:` — coerente com a pasta `/docs/[publico]/[categoria]/`
- [ ] `atualizado:` — data em YYYY-MM-DD
- [ ] `palavras-chave:` — 3–5 palavras separadas por vírgula

❌ **Reprovado se:** falta qualquer campo, ou `titulo` é vago tipo "Guia de Uso" ou "FAQ".

---

### 2. ✅ Título H1 idêntico ao frontmatter
```markdown
# [Exatamente igual ao titulo: acima]
```

❌ **Reprovado se:** título e frontmatter não batem, ou há múltiplos H1.

---

### 3. ✅ Resposta curta (negrito, isolada, 2–3 linhas máx.)
Deve responder à pergunta do título **sem** exigir que o leitor continue lendo.

✅ **Bom:**
```markdown
**Resposta curta:** na tela "Minhas reservas", toque "Remarcar".
Escolha o novo horário — o preço recalcula sozinho.
```

❌ **Ruim:**
```markdown
**Resposta:** existem várias formas de remarcar um jogo.
**Resposta:** leia abaixo para mais detalhes.
**Resposta:** [nada aqui, e o parágrafo seguinte já é texto solto]
```

❌ **Reprovado se:** resposta curta falta, é muito longa (>3 linhas), ou é vaga ("depende de vários fatores").

---

### 4. ✅ Sem jargão técnico
Traduz ou explica qualquer termo que um padelista leigo não entende.

✅ **Bom:**
```markdown
- Sua data de validade de categoria (calculada a cada semana conforme seus últimos 10 jogos).
```

❌ **Ruim:**
```markdown
- Rating Elo com índice de confiabilidade (RD) recalculado via Glicko-2.
```

❌ **Reprovado se:** há 2+ termos técnicos não explicados (query, token, trigger, endpoint, etc.).

---

### 5. ✅ Passos numerados, concretos, em linguagem imperativa
Cada passo é uma **ação** que o leitor faz AGORA, começando com verbo.

✅ **Bom:**
```markdown
1. Abra o app e toque em "Minhas reservas".
2. Procure o jogo que quer remarcar.
3. Toque **"Remarcar"** (não é cancelar).
4. Escolha a nova data e horário.
5. Confirme.
```

❌ **Ruim:**
```markdown
1. O app tem uma seção "Minhas reservas".
2. A tela mostra todos os seus jogos agendados.
3. Cada jogo tem um botão "Remarcar".
4. O usuário seleciona um novo horário.
5. O sistema processa a mudança.
```

❌ **Reprovado se:** há passos vagos ("você vai..."), voz passiva ("é possível..."), ou mais de 8 passos (divide em artigos).

---

### 6. ✅ Nomes de botões em negrito
Qualquer UI text que o leitor deve procurar, fica destacado.

✅ **Bom:**
```markdown
Toque **"Remarcar"** (não é cancelar).
```

❌ **Ruim:**
```markdown
Toque no botão "Remarcar" — não é cancelar.
Toque "Remarcar", que é diferente de cancelar.
```

❌ **Reprovado se:** nenhum botão/label está em negrito, ou tem negrito em coisa que não é UI (ex.: **importante**, **atenção** — esses usam seções estruturadas tipo "## E se...?").

---

### 7. ✅ Sem URLs internas — só nomes de artigos
Links relacionados são listados pelo NOME, não pela URL. A base de conhecimento linka automaticamente.

✅ **Bom:**
```markdown
## Perguntas relacionadas
- Como cancelar uma reserva?
- Qual é a política de cancelamento do meu clube?
```

❌ **Ruim:**
```markdown
Veja também: [Como cancelar](../cancelar.md)
Para mais info: https://docs/politica-cancelamento.md
```

❌ **Reprovado se:** há URLs `.md` ou `http://` em perguntas relacionadas.

---

### 8. ✅ Privacidade implícita, sem frase explícita "conforme LGPD"
Se o artigo mexe com dados (fotos, reservas, categoria, localização), deixa claro o que é visível/privado. Mas **nunca** escreve "conforme LGPD" ou "Política de Privacidade" — só mostra o comportamento.

✅ **Bom:**
```markdown
Sua categoria fica visível quando você está em uma partida aberta.
Outros jogadores não veem quando você reservou a quadra — só que está ocupada.
```

❌ **Ruim:**
```markdown
Conforme a LGPD, seus dados são tratados de acordo com nossa política de privacidade.
Ao usar o app, você concorda com os termos de serviço.
```

❌ **Reprovado se:** menciona "LGPD", "termos de serviço" ou "política de privacidade" explicitamente — ou falta privacidade quando deveria estar presente (ex.: artigo sobre "minha categoria" sem mencionar visibilidade).

---

### 9. ✅ Perguntas relacionadas — 2–3 itens, coerentes
Aponta artigos que o leitor pode precisar depois, sem ser óbvio (não repete o mesmo artigo em vários lugares).

✅ **Bom:**
```markdown
## Perguntas relacionadas
- Como cancelar uma reserva?
- Por que a política de cancelamento existe?
```

❌ **Ruim:**
```markdown
## Perguntas relacionadas
- Como remarcar (este artigo)
- Como usar o app
- O que é uma partida
```

❌ **Reprovado se:** faltam perguntas relacionadas, ou lista artigos que não existem (seções sem contrapartida).

---

### 10. ✅ Contato padrão no rodapé
Todos os artigos terminam com isto:

```markdown
## Ainda com dúvida?

Fale com a gente no WhatsApp: [LINK_QUE_O_FUNDADOR_FORNECE]
```

❌ **Reprovado se:** falta contato, ou é diferente do padrão.

---

## Fluxo de auto-revisão (para o Claude Code)

```
Para cada artigo:
1. Passa por cada critério da rubrica acima (1–10).
2. Marca ✅ se passou, ⚠️ se não.
3. Se 9/10 ou 10/10: aprova para envio.
4. Se <9/10: refaz o artigo e retesta.
5. Depois que passou: marque a data de revisão no frontmatter (atualizado: YYYY-MM-DD com a data de agora).

Quando TODOS os artigos passarem:
- Liste-os com: caminho, frontmatter, conteúdo, score (X/10).
- Envie para o fundador com resumo: "X artigos prontos. Y refizeram passagem de auto-revisão."
```

---

## Scoring rápido

Use isto para comunicar ao fundador:

- **10/10** → ✅ pronto para produção
- **9/10** → ✅ pronto, com nota (ex.: "9/10 — uma palavra técnica não explicada, mas contexto deixa claro")
- **7–8/10** → ⚠️ reescrever (Claude Code refaz)
- **<7/10** → ❌ bloqueado (reescrever inteira)

---

## Exemplos de artigos que passariam em 10/10

*(Quando os Sprints 4+ chegarem, estes serão referência real do produto. Por enquanto, use a estrutura acima como guia.)*

- `como-dividir-pix.md` (Sprint 3+)
- `como-remarcar-jogo.md` (Sprint 3+)
- `minha-categoria-nao-ta-correta.md` (Sprint 5+)

---

## Revisão final (para o fundador aqui no chat)

Quando o Claude Code mandar os artigos pra você me passar, você já sabe:
- Cada um passou por auto-revisão (já tem score).
- Não há jargão técnico pendente.
- Passos estão concretos.
- Privacidade está implícita.

Sua revisão final é rápida: "OK, tudo 10/10, manda pro backup" ou "vejo que o artigo 3 ficou 9/10 — deixa assim mesmo ou refaz?"

---

*Última revisão: 22/07/2026. Próxima: após o Sprint 4, com exemplos reais de artigos que passaram nesta rubrica.*
