# CHECKLIST DE ARTIGOS DO SPRINT
### Ritual de fechamento: garantir que toda funcionalidade tem documentação pronta para clientes e IA
*Salvo no repositório em `/docs/Checklist_Sprint_Artigos.md`. Cole o comando abaixo no Claude Code ao final de cada sprint, antes de marcar como "concluído".*

---

## Comando para o Claude Code

Cole isto quando o sprint estiver tecnicamente pronto (código testado, commits feitos):

> **Antes de marcar este sprint como concluído, vamos garantir a documentação.** Releia o `docs/README.md`, o `docs/Guia_Tom_Estilo_Artigos.md` e a `docs/Rubrica_Revisao_Artigos.md`. Agora, para cada funcionalidade implementada neste sprint, verifique se existe artigo em `/docs` e liste aqui:
>
> **Para cada artigo:**
> 1. Nome do arquivo (ex.: `/docs/jogadores/reservas-pagamentos/como-dividir-pix.md`)
> 2. Público-alvo (jogadores/clubes/professores/parceiros/interno)
> 3. Categoria (ex.: comecando, partidas, reservas-pagamentos)
> 4. Conteúdo COMPLETO do arquivo (cole tudo entre aspas triplas)
>
> Depois, me mostre o resumo: quantos artigos novos neste sprint? Algum incompleto ou que precise reescrever? Nenhum faltando? 
>
> **Só depois eu confirmo com o fundador que o sprint está pronto para fechar.**

---

## O que você faz quando o Claude Code responder

1. **Leia cada artigo** no chat — procure por:
   - ✅ Resposta curta **no topo** (antes dos passos).
   - ✅ Linguagem simples (sem jargão técnico).
   - ✅ Passos numerados e objetivos.
   - ✅ Links relacionados ou perguntas correlatas.
   - ✅ Menção a LGPD se relevante (dados pessoais, consentimento, exclusão).

2. **Aprove ou peça reescrever:**
   - Se estiver bom: "Aprovado" — o Claude Code já fará o commit.
   - Se não: "Reescreva [nome do artigo] focando em [o que faltou]" — ele refaz na hora.

3. **Salve aqui para backup:**
   - Copie cada artigo aprovado e me mande para eu salvar em `/mnt/user-data/outputs/docs/[categoria]/[nome].md`.
   - Isso cria um backup versionado e um histórico para a IA de atendimento aprender depois.

---

## Exemplo de como um artigo DEVE sair

```markdown
---
titulo: Como dividir o pagamento da quadra no PIX
publico: jogadores
categoria: reservas-pagamentos
atualizado: 2026-07-22
palavras-chave: pix, split, dividir, pagamento, cobrança
---

# Como dividir o pagamento da quadra no PIX

**Resposta curta:** ao reservar, escolha "Dividir entre os jogadores".
Você paga sua parte na hora; os demais recebem a cobrança no WhatsApp.

## Passo a passo
1. Na tela de reserva, escolha a quadra e horário.
2. Em "Forma de pagamento", toque "Dividir entre os 4 jogadores".
3. Confirme seu PIX — você recebe um QR code para pagar sua parte.
4. Os outros 3 recebem mensagem no WhatsApp com link para pagar a deles.
5. Quando todos pagarem, a reserva é confirmada.

## E se alguém não pagar?
Se faltarem 30 minutos para o jogo e alguém não pagou, a reserva é cancelada automaticamente. O dinheiro volta para quem pagou.

## Perguntas relacionadas
- Como cancelo uma reserva já paga?
- Posso remarcar o jogo sem perder o dinheiro?

## Ainda com dúvida?
Chame a gente no WhatsApp: [link]
```

---

## Checklist por sprint (copie para cada um)

### Sprint [X] — Artigos criados/revisados

- [ ] Artigo 1: `[nome]` — ✅ Aprovado | ⚠️ Reescrever | ❌ Faltando
- [ ] Artigo 2: `[nome]` — ✅ Aprovado | ⚠️ Reescrever | ❌ Faltando
- [ ] Artigo N: `[nome]` — ✅ Aprovado | ⚠️ Reescrever | ❌ Faltando

**Total de artigos:** X novos | Y revistos
**Status geral:** ✅ Todos aprovados | ⚠️ Alguns pendentes | ❌ Bloqueado

---

*Nota: Este checklist existe para garantir que a base de conhecimento cresce junto com o produto — sem ela, você fecha o sprint sem saber se os clientes conseguem usar a funcionalidade ou se a IA de atendimento tem material para aprender.*
