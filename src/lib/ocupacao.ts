// Capacidade × ocupação das quadras (visões semana/mês da agenda).
// "Capacidade" de um dia = total de horas dentro das faixas de preço
// daquele dia da semana (faixa cadastrada = quadra disponível).
// "Ocupação" = horas efetivamente reservadas (status confirmada).

export type FaixaFuncionamento = {
  dias: number[]; // 0=domingo ... 6=sábado
  hora_inicio: string;
  hora_fim: string;
};

export type QuadraComFaixas = {
  id: string;
  nome: string;
  quadra_precos: FaixaFuncionamento[];
};

export type ReservaPeriodo = {
  quadra_id: string;
  inicio: string;
  fim: string;
};

function minutosDaFaixa(f: FaixaFuncionamento): number {
  const [hi, mi] = f.hora_inicio.split(":").map(Number);
  const [hf, mf] = f.hora_fim.split(":").map(Number);
  return hf * 60 + mf - (hi * 60 + mi);
}

// Horas de capacidade de UMA quadra num dia da semana (0-6).
export function horasCapacidade(
  quadra: QuadraComFaixas,
  diaSemana: number
): number {
  return (
    quadra.quadra_precos
      .filter((f) => f.dias.includes(diaSemana))
      .reduce((total, f) => total + minutosDaFaixa(f), 0) / 60
  );
}

// Horas reservadas de UMA quadra dentro de um dia (data local).
export function horasReservadas(
  quadraId: string,
  data: Date,
  reservas: ReservaPeriodo[]
): number {
  const inicioDia = new Date(data);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(inicioDia.getTime() + 24 * 60 * 60_000);

  let minutos = 0;
  for (const r of reservas) {
    if (r.quadra_id !== quadraId) continue;
    const ini = Math.max(new Date(r.inicio).getTime(), inicioDia.getTime());
    const fim = Math.min(new Date(r.fim).getTime(), fimDia.getTime());
    if (fim > ini) minutos += (fim - ini) / 60_000;
  }
  return minutos / 60;
}

// Percentual de ocupação agregado (todas as quadras) de um dia.
export function ocupacaoDoDia(
  quadras: QuadraComFaixas[],
  data: Date,
  reservas: ReservaPeriodo[]
): { capacidade: number; reservado: number; percentual: number | null } {
  const diaSemana = data.getDay();
  const capacidade = quadras.reduce(
    (total, q) => total + horasCapacidade(q, diaSemana),
    0
  );
  const reservado = quadras.reduce(
    (total, q) => total + horasReservadas(q.id, data, reservas),
    0
  );
  return {
    capacidade,
    reservado,
    percentual: capacidade > 0 ? Math.min(100, (reservado / capacidade) * 100) : null,
  };
}
