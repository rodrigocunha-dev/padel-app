# Convite por telefone e origem do cadastro (Entrega B)

*Construído em 15/08/2026. Scripts `034`, `035` e `036`. O banco já nascera preparado no `014`.*

A busca por nome só acha quem já está no app. Mas no jogo de grupo fixo sempre falta alguém que ainda não se cadastrou — e é justamente esse pessoal que precisa entrar para a sessão contar para o rating.

---

## Onde está cada coisa

| Peça | Arquivo |
|---|---|
| Formulário de convite | `src/components/partidas/ConvidarPorTelefone.tsx` |
| Convite genérico ("chamar um amigo") | `src/components/ConvidarParaOApp.tsx` |
| Guardar o código do link | `src/components/GuardarOrigem.tsx` |
| Vincular e registrar origem | `src/components/OnboardingJogador.tsx` |
| Regras | scripts `034` a `036` |

---

## As regras que sobreviveram ao caminho novo

**Vale só em sessão privada.** Partida aberta tem vaga e fila, não convite — um segundo caminho de entrada, com regras diferentes, seria furo futuro. A trava é no servidor (`SO_SESSAO_PRIVADA`).

**Criar conta não é dizer sim para um jogo.** Quando a pessoa se cadastra, o convite se liga à conta dela mas continua como **convidado**. Ela ainda precisa aceitar — a Decisão 1 diz que ninguém entra numa conta a pagar sem dizer sim, e isso não muda porque o convite chegou por outro caminho.

**Quem já tem conta não vira participante fantasma.** Se o telefone digitado já existe no app, o convite vira o normal, com `jogador_id`. Sem isso haveria duas linhas para a mesma pessoa: uma pelo telefone, outra pela conta.

**Sem envio automático.** O BSP de WhatsApp não foi contratado, então o app monta a mensagem e o organizador envia pelo WhatsApp dele. Quando o envio automático existir, muda só essa parte.

**Escolher da agenda é melhoria progressiva.** O botão só aparece onde o navegador suporta (na prática, Chrome no Android). No iPhone a API é experimental e o usuário teria de ligar na mão — então lá ele nem aparece, em vez de aparecer e falhar. Ver a ideia do app nativo no CLAUDE.md: é um dos ganhos que só o nativo destrava.

---

## Rastreamento de origem

⚠️ **Não tem tela, e isso é a decisão.** É dado para o dono do app, não informação que o produto mostre a alguém. O jogador não vê quem convidou quem. Se um dia houver campanha de recompensa, aí se decide o que exibir — e como dificultar fraude, provavelmente exigindo que o convidado **jogue**, não só que crie perfil.

Cada jogador tem um `codigo_convite` curto (o link é colado em WhatsApp; endereço gigante desanima antes de abrir). O código chega na URL, fica guardado no aparelho até o cadastro terminar — vários passos adiante — e é gravado **uma única vez**. Ninguém convida a si mesmo.

Duas consultas prontas para o fundador estão no fim do script `034`.

---

## ⚠️ Duas armadilhas deste projeto, que já pegaram duas vezes

### 1. `revoke` de coluna só funciona depois de revogar a tabela

No Postgres, permissão de tabela cobre **todas** as colunas. Então isto **não faz nada**:

```sql
revoke select (telefone) on public.partida_jogadores from authenticated;
```

O certo é revogar a tabela e devolver coluna a coluna, que é o que o `008` já fazia em `jogadores` desde o Sprint 4:

```sql
revoke select on public.partida_jogadores from anon, authenticated;
grant select (id, partida_id, jogador_id, papel, ordem, estado, ...) on public.partida_jogadores to authenticated;
```

O `034` errou isso, e o resultado foi o telefone do convidado ficar legível para todos os participantes da sessão — reabrindo o mesmo furo que o `022` tinha fechado do outro lado. Reproduzido com contas de teste antes de corrigir, no `035`.

**Ao revogar a tabela, confira que nada usa `select *`** nela: uma consulta assim passa a falhar inteira. Verificado — todas as consultas do app nomeiam colunas, e as seis telas principais continuaram respondendo.

### 2. Coluna nova em `jogadores` nasce fechada

Como `jogadores` tem a tabela revogada e as colunas liberadas uma a uma, **toda coluna nova é invisível para o app até ser liberada**. Já aconteceu com `categoria_inicial` no motor de rating e de novo com `codigo_convite` aqui.

Isso é bom por padrão (fecha por omissão), mas o sintoma é confuso: a consulta devolve `permission denied` para a tabela inteira, e não "esta coluna não existe".

Quando o dado é do jogador, libere por `grant`. Quando é nosso — `convidado_por`, `origem_cadastro` — deixe fechado. Quando precisa chegar ao app mas não pode ser lido de terceiros, devolva por função: foi o caso do `codigo_convite`, porque com `grant` qualquer pessoa leria o código de qualquer outra e daria para atribuir cadastros a quem não convidou ninguém.

### 3. O telefone tem dois formatos, e eles não batem sozinhos

O cadastro grava `+5551999998888` (13 dígitos, com o código do país); o organizador digita `(51) 99999-8888` (11). Comparando só os dígitos, **nunca batem** — o convite ficaria pendente para sempre, sem erro em lugar nenhum.

`telefone_canonico()` (script `036`) é a forma única usada nos dois lados: tira o que não é dígito e remove o `55` quando ele está lá. Assume Brasil conscientemente — quando houver outro país, é o único lugar a mudar.

---

## Como foi verificado

O ciclo inteiro, com um número que **nunca tinha existido** no app:

```
o número novo não tinha perfil        ← o teste é legítimo
convite pelo telefone → pendente
antes do cadastro: 0 vínculos
cria o perfil
convites vinculados: 1                ← o convite o encontrou sozinho
estado: "convidado"                   ← ainda precisa aceitar
aceita → "aceito"
```

E as travas, uma a uma: telefone e nome do convidado bloqueados para o grupo, o resto da tabela ainda legível, o organizador continuando a ver o que digitou, convite em partida aberta recusado, código de convite alheio bloqueado.

⚠️ Uma lição de método: no primeiro teste, o convite em partida aberta foi "recusado" — mas com `SO_O_ORGANIZADOR`, porque a partida escolhida não era do organizador. **O teste nunca chegou na trava que eu queria verificar.** Um teste que passa pelo motivo errado é pior que um que falha.

## O que ainda não existe

- **Envio automático** do convite (depende do BSP).
- **Expiração** de convite por telefone que nunca vira conta.
- **Apagar o próprio perfil**: não há caminho no app, e o `delete` falha em silêncio (0 linhas) por não haver política. Isso é pendência de LGPD, registrada no Módulo 1.8.
