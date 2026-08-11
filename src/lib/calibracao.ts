// Questionário de calibração inicial (regra de negócio nº 4 do CLAUDE.md).
//
// ============================================================
// COMO ISTO MUDOU EM 09/08/2026, E POR QUÊ
// ============================================================
// A versão anterior somava CINCO perguntas — incluindo a autoavaliação —
// num único total de pontos, sugeria uma categoria, e depois deixava o
// jogador escolher LIVREMENTE qualquer categoria de 2ª a 7ª. Dois problemas:
//
// 1. A autoavaliação era contada DUAS VEZES: somava pontos para a sugestão
//    e, logo em seguida, a pessoa podia sobrescrever essa sugestão. A mesma
//    opinião entrava por duas portas.
// 2. Como a escolha era livre, o questionário não decidia nada — ele
//    opinava. Quem respondia tudo de iniciante podia simplesmente tocar na
//    2ª e seguir.
//
// Agora cada pergunta tem um trabalho só:
//   · as QUATRO perguntas de fatos verificáveis (tempo de jogo, frequência,
//     torneios, outro esporte de raquete) definem o DEGRAU de largada;
//   · a autoavaliação virou o AJUSTE, limitado a ±2 degraus.
//
// Por que ±2: nos 21 degraus, dois para cada lado é exatamente "toda a sua
// categoria, mais um degrau para cada vizinha". Dá poder ao jogador onde ele
// sabe mais que o questionário — Forte ou Fraco dentro da própria categoria,
// nuance que quatro perguntas nunca capturam — e tira onde ele não deveria
// ter: saltar de categoria no cadastro.
//
// ⚠️ O rating NÃO usa estas respostas para reduzir a incerteza inicial.
// Incerteza significa "quanta evidência nós temos", e questionário é
// ALEGAÇÃO, não evidência. Quem exagera é corrigido rápido justamente
// porque todo mundo começa igualmente incerto. (Ver "Motor de rating" no
// CLAUDE.md, itens 19 a 21.)
//
// As perguntas em si continuam PROVISÓRIAS — melhorá-las é pendência
// registrada desde o Sprint 1.

export type Pergunta = {
  id: string;
  titulo: string;
  opcoes: { rotulo: string; pontos: number }[];
};

// Só fatos verificáveis. A autoavaliação saiu daqui de propósito.
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
    titulo:
      "Você veio de outro esporte de raquete (tênis, beach tennis, squash)?",
    opcoes: [
      { rotulo: "Não", pontos: 0 },
      { rotulo: "Joguei por lazer", pontos: 1 },
      { rotulo: "Joguei competitivamente", pontos: 2 },
    ],
  },
];

export const PONTUACAO_MAXIMA = PERGUNTAS.reduce(
  (total, p) => total + Math.max(...p.opcoes.map((o) => o.pontos)),
  0
); // 11

// ============================================================
// OS 21 DEGRAUS
// ============================================================
// Mesma escala do motor (script 025): degrau 0 = 7ª Fraco … 20 = 1ª Forte.
// Estas funções são a cópia em TypeScript de `degrau_de_categoria` e
// `categoria_do_degrau`. O banco continua sendo a autoridade — aqui é só
// para desenhar a tela.
export const NIVEIS = ["fraco", "medio", "forte"] as const;
export type Nivel = (typeof NIVEIS)[number];

export function degrauDe(categoria: number, nivel: Nivel): number {
  return (7 - categoria) * 3 + NIVEIS.indexOf(nivel);
}

export function categoriaDoDegrau(degrau: number): {
  categoria: number;
  nivel: Nivel;
} {
  const d = Math.max(0, Math.min(20, degrau));
  return { categoria: 7 - Math.floor(d / 3), nivel: NIVEIS[d % 3] };
}

const ROTULO_NIVEL: Record<Nivel, string> = {
  fraco: "Fraco",
  medio: "Médio",
  forte: "Forte",
};

export function rotuloDoDegrau(degrau: number): string {
  const { categoria, nivel } = categoriaDoDegrau(degrau);
  return `${categoria}ª ${ROTULO_NIVEL[nivel]}`;
}

// Teto do que se pode declarar no cadastro: 2ª Forte (degrau 17).
// A 1ª categoria é elite e se prova em quadra — regra que já valia antes,
// quando a lista de escolha ia só até a 2ª.
export const DEGRAU_MAXIMO_CADASTRO = 17;

// ============================================================
// PONTOS → DEGRAU SUGERIDO
// ============================================================
// Os 12 valores possíveis (0 a 11) se dividem igualmente entre as seis
// categorias declaráveis, e a sugestão sempre cai no MÉDIO da categoria —
// o Forte/Fraco é justamente o que o ajuste de ±2 existe para escolher.
export function sugerirDegrau(pontos: number): number {
  const categoria =
    pontos <= 1 ? 7
    : pontos <= 3 ? 6
    : pontos <= 5 ? 5
    : pontos <= 7 ? 4
    : pontos <= 9 ? 3
    : 2;
  return degrauDe(categoria, "medio");
}

// A janela de ajuste: dois degraus para cada lado, sem passar do teto do
// cadastro nem do fim da escala. Devolvida do mais forte para o mais fraco,
// que é como a lista aparece na tela.
export function janelaDeDegraus(sugerido: number): number[] {
  const menor = Math.max(0, sugerido - 2);
  const maior = Math.min(DEGRAU_MAXIMO_CADASTRO, sugerido + 2);
  const lista: number[] = [];
  for (let d = maior; d >= menor; d--) lista.push(d);
  return lista;
}
