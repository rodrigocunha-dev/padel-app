// Questionário de calibração inicial (regra de negócio nº 4 do CLAUDE.md).
// Pontua a experiência do jogador e sugere uma categoria de largada.
// A sugestão NUNCA é 1ª (elite se prova em quadra); o jogador pode ajustar,
// e o selo "em calibração" fica até validação por pares + 5 partidas.

export type Pergunta = {
  id: string;
  titulo: string;
  opcoes: { rotulo: string; pontos: number }[];
};

export const PERGUNTAS: Pergunta[] = [
  {
    id: "tempo_jogo",
    titulo: "Há quanto tempo você joga padel?",
    opcoes: [
      { rotulo: "Estou começando agora", pontos: 0 },
      { rotulo: "Menos de 1 ano", pontos: 1 },
      { rotulo: "De 1 a 3 anos", pontos: 2 },
      { rotulo: "Mais de 3 anos", pontos: 3 },
    ],
  },
  {
    id: "frequencia",
    titulo: "Com que frequência você joga?",
    opcoes: [
      { rotulo: "De vez em quando", pontos: 0 },
      { rotulo: "1x por semana", pontos: 1 },
      { rotulo: "2 a 3x por semana", pontos: 2 },
      { rotulo: "4x ou mais", pontos: 3 },
    ],
  },
  {
    id: "torneios",
    titulo: "Você já jogou torneios?",
    opcoes: [
      { rotulo: "Nunca", pontos: 0 },
      { rotulo: "Torneio interno / entre amigos", pontos: 1 },
      { rotulo: "Torneios regionais", pontos: 2 },
      { rotulo: "Torneios estaduais ou maiores", pontos: 3 },
    ],
  },
  {
    id: "outros_esportes",
    titulo: "Você veio de outro esporte de raquete (tênis, beach tennis, squash)?",
    opcoes: [
      { rotulo: "Não", pontos: 0 },
      { rotulo: "Joguei por lazer", pontos: 1 },
      { rotulo: "Joguei competitivamente", pontos: 2 },
    ],
  },
  {
    id: "autoavaliacao",
    titulo: "Como você avalia seu jogo hoje?",
    opcoes: [
      { rotulo: "Iniciante — aprendendo as regras e golpes", pontos: 0 },
      { rotulo: "Intermediário — troco bola e me posiciono", pontos: 1 },
      { rotulo: "Avançado — domino saída de vidro e bandeja", pontos: 2 },
      { rotulo: "Competitivo — jogo em alto nível", pontos: 3 },
    ],
  },
];

export const PONTUACAO_MAXIMA = PERGUNTAS.reduce(
  (total, p) => total + Math.max(...p.opcoes.map((o) => o.pontos)),
  0
); // 14

// Faixas de pontos → categoria sugerida (7ª = iniciante ... 2ª = teto da sugestão)
export function sugerirCategoria(pontos: number): number {
  if (pontos <= 1) return 7;
  if (pontos <= 3) return 6;
  if (pontos <= 6) return 5;
  if (pontos <= 9) return 4;
  if (pontos <= 11) return 3;
  return 2;
}
