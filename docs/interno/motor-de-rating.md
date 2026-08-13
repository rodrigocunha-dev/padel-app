# Motor de rating (Glicko-1)

*Construído entre 08 e 12/08/2026. Scripts `025` a `030`. Regras de produto no CLAUDE.md, bloco "Motor de rating".*

O motor lê os sets que a Entrega A grava e devolve, para cada jogador, um **rating**, uma **incerteza** e a **categoria que aparece na tela**. É a cunha do produto contra o Playtomic: categorias brasileiras e transparência total.

---

## Em uma frase

**A conta é refeita do zero, em ordem cronológica, em blocos de um dia — e cada bloco fica guardado com a explicação de quanto mudou e por quê.**

---

## Onde está cada coisa

| Peça | Arquivo |
|---|---|
| Parâmetros ajustáveis | tabela `rating_parametros` (uma linha só) |
| Rating de cada jogador | tabela `rating_jogadores` |
| Trilha do "quanto mudou" | tabelas `rating_blocos` e `rating_bloco_sets` |
| O cálculo | função `recalcular_ratings()` |
| Quais sets entram | função `sets_para_rating()` |
| Leitura para a tela | `src/lib/rating.ts` |
| A barra de progresso | `src/components/rating/BarraDeProgresso.tsx` |
| A trilha | `src/app/app/perfil/rating/page.tsx` |

---

## A escala: 21 degraus de largura igual

Degrau 0 = 7ª Fraco … degrau 20 = 1ª Forte. `rating = 1000 + 50 × degrau`, então a escala vai de 1000 a 2000 e o centro (1500) cai exatamente em **4ª Médio** — consequência de larguras iguais, não escolha.

**A largura de 50 pontos não é cosmética: é a alavanca do anti-farming.** Com ela, uma categoria de distância dá ~70% de chance de vitória e três categorias dão ~94% — ou seja, vencer quem está muito abaixo rende quase nada. Faixa mais larga protegeria mais, mas faria um 4ª x 5ª parecer mais desequilibrado do que é na quadra. **É o número que a conversa das âncoras vai calibrar antes do beta.**

Medido, jogador estabelecido (4ª Médio) contra adversário a três categorias abaixo: **vitória +1,5 · derrota −18,7**. Precisaria de 33 vitórias dessas para subir um degrau, e uma única derrota já custa 40% dele.

---

## Por que refazer do zero

Um set **não fica pronto quando é registrado**. Ele vira válido 24h depois, ou quando uma votação resolve — e a votação pode **trocar o placar**. Logo os resultados ficam prontos **fora de ordem**.

Somando pontos conforme cada um fica pronto, o número de uma pessoa passaria a depender de *quando* os outros resolveram suas disputas. Refazendo do zero, o resultado é sempre o mesmo — **verificado**: duas execuções seguidas devolveram ratings idênticos.

Barato no volume que teremos por anos, e mata a classe inteira de bugs de ordem.

### A armadilha do ponto de partida

O motor **parte da categoria do cadastro** e **escreve na categoria de exibição**. Se escrevesse por cima da mesma coluna, o recálculo seguinte partiria de um lugar já movido e deixaria de ser reproduzível.

Por isso a categoria do cadastro é congelada em `categoria_inicial` / `nivel_inicial`, **por gatilho** (`congelar_categoria_inicial`) — para não depender de a tela lembrar de preencher, hoje ou daqui a um ano.

---

## Bloco de um dia, não jogo a jogo

O Glicko foi definido para atualizar em blocos, usando o nível que cada um tinha no **início do período**. Quatro motivos para o bloco diário:

1. É como o padel acontece — a sessão é uma noite, não quatro eventos separados.
2. Resolve sozinho a variância de "muitos sets seguidos entre duplas parelhas".
3. **Jogo a jogo nunca foi possível** — o set só vale 24h depois, então não existe o momento "acabou o set, olha seu rating".
4. A transparência fica melhor: *"nesta sessão você subiu 12 pontos"* é legível; quatro micro-mudanças não.

Dentro do dia, todos os sets são julgados contra o estado congelado do início — é o que impede o set 1 da noite de "engordar" você antes do set 2.

---

## Os pesos

| Contexto do set | Peso |
|---|---|
| Sessão privada / grupo | 1,0 (a base) |
| Partida aberta competitiva | 1,0 |
| Partida aberta amistosa | **0 — não conta** |
| Liga | 1,5 |
| Torneio | 2,0 a 3,0 |

Multiplicam em camadas: `contexto × margem do placar × calibração`, com **teto de 8,0**. O teto fica acima de toda combinação legítima (a mais alta hoje é 7,8) — existe para pegar engano futuro, não para limitar caso normal. **O freio de verdade é o próprio Glicko:** quanto mais certeza ele tem do seu nível, menos qualquer resultado isolado te move.

Liga e torneio ainda não existem como tipo de partida; os parâmetros já estão lá.

### O placar

| Placar | Fator |
|---|---|
| 6x0 | 1,30 |
| 6x1 | 1,20 |
| 6x2 | 1,10 |
| 6x3 | 1,00 |
| 6x4 · 7x5 | 0,90 |
| 7x6 | 0,80 |

⚠️ **Esta parte é extensão nossa, não Glicko publicado** — o algoritmo é desenhado para vitória/derrota. É o ponto do motor onde mais podemos errar a mão, e por isso a faixa é estreita.

⚠️ **Armadilha evitada:** tratar 6x4 como "60% de uma vitória". Isso faria ganhar apertado de alguém muito mais fraco **derrubar** o rating — venceu e caiu. Já quebrou sistemas de ranking reais. Aqui quem ganhou vale vitória cheia sempre; o placar mexe só na intensidade, para os dois lados.

---

## A força da dupla

A expectativa sai de `(eu + parceiro)` contra `(adversário 1 + adversário 2)`, e o ajuste é aplicado a cada um individualmente, com a incerteza de cada um.

Medido — eu 4ª Médio contra dois 4ª Médio, vencendo:

| Parceiro | Era esperado ganhar | Vitória | Derrota |
|---|---|---|---|
| 1ª Forte | 80% | +3,9 | −16,1 |
| 4ª Médio | 50% | +9,9 | −9,9 |
| 7ª Fraco | 20% | +16,1 | −3,9 |

Carregar parceiro fraco vale ~4x mais que ser rebocado por parceiro forte. Além de correto, **fecha o vetor de pendurar-se num parceiro melhor para subir de graça**.

### A média ponderada (parâmetro `peso_do_mais_fraco`, hoje em 0,5)

A média simples superestima a dupla desigual: um 7ª Fraco com um 1ª Forte dá "1500", igual a dois 4ª Médio. **Na quadra isso é falso — todo mundo joga na bola do mais fraco.** O parâmetro permite pender a conta para o elo fraco (0,6 derruba a chance daquela dupla de 50% para 36%).

**Nasce em 0,5, ou seja, desligado.** Mexer nisso muda todos os números e não temos evidência para escolher 0,6 — seria palpite. Fica pronto para quando o beta mostrar como duplas desiguais se comportam.

---

## Calibração e incerteza

A incerteza (`rd`) responde **"quanta evidência nós temos"**. Ela começa alta, cai com jogos e volta a subir com o tempo parado.

⚠️ **O questionário NÃO reduz a incerteza inicial.** Questionário é **alegação**, não evidência. Usar alegação para baixar a incerteza seria erro de categoria — e faria quem mente ser corrigido *mais devagar*, por ter mentido mais.

### Por que os números não são os clássicos do Glicko

Os valores de fábrica (RD inicial 350) foram medidos aqui **antes** de escrever o motor, e davam resultado absurdo. Dois motivos:

1. **A escala é estreita.** O Glicko nasceu no xadrez, onde os ratings se espalham por ~1800 pontos; nós empacotamos 21 degraus em 1000. RD 350 nessa escala atirava a pessoa duas categorias numa noite, e um cadastro muito errado jogava o número **para fora da escala** (−1467 e +2752 nos testes). Baixado para **150**.
2. **O multiplicador de calibração contava a mesma coisa duas vezes.** "Os primeiros jogos valem mais" **já é** o que a incerteza alta faz — é nativo do Glicko. Multiplicar o peso por 2 além disso aplicava a ideia sobre ela mesma. Nasce **desligado** (1,0); o `peso_acumulado` continua gravado porque responde "já saiu da calibração?" e alimenta a proteção de queda.

Depois da correção, medido: **uma noite de 3 sets move ~2,5 degraus** e um cadastro grosseiramente errado se corrige em **~3 noites**, sem sair da escala.

### Inatividade

`RD(t) = min(raiz(RD² + c² × dias), rd_maximo)`, com `c = 6,5`: quem estava bem estabelecido (RD 50) volta a ser incerto (RD 100, metade do teto) depois de ~180 dias parado.

⚠️ Isto é ponto de partida, **não referência de mercado** — a velocidade de decaimento é escolha de cada sistema conforme o ritmo do esporte. E ⚠️ **o decaimento por inatividade é do Glicko ORIGINAL**, não do Glicko-2; o que o 2 acrescenta é volatilidade, que é outro fenômeno.

---

## Proteção de rebaixamento

**Subir é imediato. Cair abre um período de prova.**

Enquanto o rating segue abaixo da faixa exibida, um contador soma o peso de cada bloco. Chegando a **5**, a categoria cai de verdade. Se o rating voltar para dentro da faixa, o contador **zera** e a categoria nunca mudou.

### Por que 5 e não 20

Medido: jogador calibrado move ±7 a ±10 pontos por set, e um degrau tem 50 — ou seja, ~5 a 7 sets cruzam um degrau. **Peso 20 seriam 3 a 4 degraus de movimento.** O estrago não seria ser generoso: a categoria exibida ficaria muito atrasada, com a pessoa aparecendo como 4ª Fraco enquanto já joga como 5ª Fraco, atraindo adversários pela categoria errada.

Peso 20 continua sendo o alvo da **calibração**, que responde outra pergunta ("quanto preciso jogar para te conhecer?"). Mesma unidade, perguntas diferentes.

### A queda pode pular degrau — e isso é da calibração

Quando a queda confirma, ela vai direto ao degrau real, que pode estar mais de um abaixo. Medido, jogador na linha perdendo sempre:

| Fase | Incerteza | Degraus pulados |
|---|---|---|
| recém-chegado | 150 | 4,3 |
| meio da calibração | 100 | 2,5 |
| **calibrado** | 60 | **1,0** |
| muito estabelecido | 50 | 0,8 |

Para quem já está calibrado, o peso 5 dá **exatamente um degrau** — foi assim que ele foi dimensionado. O salto grande só acontece com quem ainda está sendo descoberto, e ali ele é desejável.

💡 **Mecanismo B, registrado e não implementado:** olhar a proporção da janela recente abaixo da linha, em vez de contador que liga e zera. Mais preciso, mas exige um parâmetro a mais e é mais difícil de explicar. Reavaliar com dados do beta.

---

## Privacidade do número

O rating numérico é **privado**. `rating_jogadores` só é legível pelo dono; a trilha guarda **degrau** de adversários e parceiro, nunca o rating deles.

**Isso não depende de disciplina:** `src/lib/rating.ts` é o único lugar que enxerga o rating bruto e devolve apenas categoria, nível e porcentagens. Ele importa `criarClienteServidor`, que usa `next/headers` — **qualquer componente de cliente que tentar importá-lo quebra na compilação**. Verificado no HTML entregue ao navegador: nenhum rating aparece.

O que o jogador vê: **categoria + barra de progresso dentro da faixa**, sem número absoluto. A barra é só dele; terceiros veem apenas categoria e nível.

---

## A trilha (regra nº 4)

Um item por dia, com o placar, o resultado, a categoria do parceiro e a da dupla adversária, e **quanto cada set moveu**.

**A variação do dia se decompõe exatamente por set.** Na fórmula do bloco, `variação = (q / denominador) × Σ[ g × (resultado − esperado) × peso ]`, o `(q / denominador)` é um só para o dia; o que muda entre sets é apenas o termo de cada um. Guardar esse termo dá números que **somam exatamente** o total do dia — não é rateio nem estimativa. Se fosse aproximação, a soma não fecharia e a tela mentiria.

O placar é **gravado**, não lido de `sets`: quando uma votação resolve uma contestação, o placar que vale pode não ser o registrado, e a tela mostraria algo diferente do que o motor usou.

---

## Como rodar

O recálculo é **manual**, no SQL Editor:

```sql
select public.recalcular_ratings();
```

Devolve quantos blocos (jogador × dia) foram gerados. Zero significa que nenhum set está válido ainda.

A função é `security definer` e está **revogada de `public`, `anon` e `authenticated`** — ninguém dispara um recálculo completo de dentro do app.

⚠️ **Lição do script `026`:** neste banco, `revoke ... from public, anon` **não basta** — o papel `authenticated` recebe permissão por outro caminho e precisa ser citado explicitamente. O `025` não citava, e qualquer jogador logado conseguia disparar o recálculo de todo mundo.

---

## Como isto foi verificado

- **A fórmula bate com o exemplo publicado por Glickman**: jogador 1500 / RD 200 contra 1400, 1550 e 1700 devolve 1464,1 e 151,4, idêntico ao artigo. Conferido **antes** de escrever o SQL.
- **Um bloco refeito à mão** bateu com o banco no detalhe (1541,6 e incerteza 137).
- **Reprodutibilidade**: duas execuções seguidas devolveram ratings idênticos — o que também prova que o congelamento da categoria do cadastro está segurando.
- **Proteção de queda**, com dados reais: o Diego teve três noites seguradas e a queda confirmou na quarta; o Carlos ficou segurado com a mensagem apontando o degrau certo; o Bruno acumulou 5,8 de prova e caiu de verdade.
- **Previsão antes do fato**: antes de criar os jogos do último teste, simulei o resultado por fora e previ 1404 (Carlos) e 1387 (Bruno). O recálculo devolveu exatamente esses números.

⚠️ Com contas de teste dá para provar que a conta está **correta**. Não dá para provar que está **justa** — isso só o beta responde, e é por isso que todos os números moram em `rating_parametros`.

---

## O que ainda não existe

- **Quando o recálculo roda.** Hoje é chamada manual. Agendar é peça própria e depende de decidir a frequência — que por sua vez depende do bloco diário: não adianta recalcular de hora em hora se o bloco é de um dia.
- **Liga e torneio** como tipo de partida.
- **Índice de confiabilidade na tela.** Existe por dentro; decisão reversível de não mostrar.
- **Validação por pares.** Proposta registrada e não aprovada — a resposta do adversário tende a seguir o placar, que o motor já leu. Decidir depois do beta.
- **As faixas definitivas.** A conversa das âncoras (jogadores de nível conhecido nos clubes-piloto) decide a largura dos degraus, e com ela a força do anti-farming.

## Scripts

| Script | O que trouxe |
|---|---|
| `025` | escala, parâmetros, tabelas, `recalcular_ratings()` |
| `026` | correção: a função não estava trancada e quebrava no `DELETE` sem `WHERE` |
| `027` | força da dupla, privacidade do número, proteção de queda, congelamento do cadastro |
| `028` | `peso_do_mais_fraco` (em 0,5, desligado) |
| `029` | variação por set na trilha |
| `030` | placar de cada set na trilha |
