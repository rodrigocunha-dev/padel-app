// Rótulos e regras compartilhadas das partidas abertas (Sprint 4).

export const ROTULO_CATEGORIA: Record<number, string> = {
  1: "1ª",
  2: "2ª",
  3: "3ª",
  4: "4ª",
  5: "5ª",
  6: "6ª",
  7: "7ª",
};

export const ROTULO_SEXO_JOGO: Record<string, string> = {
  masculino: "Masculina",
  feminino: "Feminina",
  mista: "Mista",
};

// Faixa de categoria "3ª a 5ª", ou "5ª" quando min = max.
export function faixaCategoria(min: number, max: number): string {
  return min === max
    ? `${ROTULO_CATEGORIA[min]}`
    : `${ROTULO_CATEGORIA[min]} a ${ROTULO_CATEGORIA[max]}`;
}

// Divisão do valor da quadra entre os jogadores: partes iguais, e a sobra
// de centavos vai para os primeiros da lista (jogador nunca paga taxa —
// regra nº 1). Devolve um array com o valor de cada posição (1..total).
export function dividirValor(
  totalCentavos: number,
  quantidade: number
): number[] {
  if (quantidade <= 0) return [];
  const base = Math.floor(totalCentavos / quantidade);
  const sobra = totalCentavos - base * quantidade;
  return Array.from({ length: quantidade }, (_, i) =>
    i < sobra ? base + 1 : base
  );
}

// O jogador cabe na partida? (mesma regra do banco, para o feed já filtrar)
export function jogadorCompativel(
  partida: {
    categoria_min: number;
    categoria_max: number;
    sexo_jogo: string;
  },
  jogador: { categoria: number; sexo: string | null }
): boolean {
  if (
    jogador.categoria < partida.categoria_min ||
    jogador.categoria > partida.categoria_max
  ) {
    return false;
  }
  if (partida.sexo_jogo !== "mista") {
    if (!jogador.sexo || jogador.sexo !== partida.sexo_jogo) return false;
  }
  return true;
}
