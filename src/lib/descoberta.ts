// Regras da descoberta de clubes (Sprint 2): distância, menor preço
// e o modo "Jogar agora" (quadra com 1h livre nas próximas 3 horas).

export type FaixaPreco = {
  dias: number[]; // 0=domingo ... 6=sábado
  hora_inicio: string; // "18:00:00"
  hora_fim: string;
  preco_centavos: number;
};

export type QuadraDescoberta = {
  id: string;
  esporte: string;
  tipo: string;
  coberta: boolean;
  quadra_precos: FaixaPreco[];
};

export type ClubeDescoberta = {
  id: string;
  nome: string;
  cidade: string;
  latitude: number;
  longitude: number;
  telefone: string | null;
  quadras: QuadraDescoberta[];
};

export type Ocupacao = { quadra_id: string; inicio: string; fim: string };

// Distância em linha reta entre dois pontos (fórmula de Haversine).
export function distanciaKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Menor preço/h entre todas as faixas das quadras do clube (para o pin).
export function menorPrecoCentavos(quadras: QuadraDescoberta[]): number | null {
  let menor: number | null = null;
  for (const q of quadras) {
    for (const f of q.quadra_precos) {
      if (menor === null || f.preco_centavos < menor) menor = f.preco_centavos;
    }
  }
  return menor;
}

function minutosDoDia(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// "Jogar agora": a quadra tem pelo menos 1h contínua livre nas próximas
// 3 horas, dentro de uma faixa de preço do dia de hoje (faixa cadastrada
// = clube funcionando naquele horário).
export function quadraLivreAgora(
  quadra: QuadraDescoberta,
  ocupacoes: Ocupacao[],
  agora: Date = new Date()
): boolean {
  const DURACAO_MIN = 60; // 1 hora de jogo
  const JANELA_MIN = 180; // próximas 3 horas
  const PASSO_MIN = 30; // testa a cada meia hora

  const diaHoje = agora.getDay();
  const inicioJanela = agora.getTime();
  const fimJanela = inicioJanela + JANELA_MIN * 60_000;

  const ocupadasDaQuadra = ocupacoes
    .filter((o) => o.quadra_id === quadra.id)
    .map((o) => ({
      inicio: new Date(o.inicio).getTime(),
      fim: new Date(o.fim).getTime(),
    }));

  const faixasHoje = quadra.quadra_precos.filter((f) =>
    f.dias.includes(diaHoje)
  );

  const meiaNoite = new Date(agora);
  meiaNoite.setHours(0, 0, 0, 0);

  for (
    let slotInicio = inicioJanela;
    slotInicio + DURACAO_MIN * 60_000 <= fimJanela;
    slotInicio += PASSO_MIN * 60_000
  ) {
    const slotFim = slotInicio + DURACAO_MIN * 60_000;

    // O slot precisa caber inteiro numa faixa de funcionamento de hoje
    const slotInicioMin = (slotInicio - meiaNoite.getTime()) / 60_000;
    const slotFimMin = (slotFim - meiaNoite.getTime()) / 60_000;
    const dentroDeFaixa = faixasHoje.some(
      (f) =>
        minutosDoDia(f.hora_inicio) <= slotInicioMin &&
        minutosDoDia(f.hora_fim) >= slotFimMin
    );
    if (!dentroDeFaixa) continue;

    // ...e não pode cruzar com nenhuma reserva confirmada
    const ocupado = ocupadasDaQuadra.some(
      (o) => o.inicio < slotFim && o.fim > slotInicio
    );
    if (!ocupado) return true;
  }
  return false;
}

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
