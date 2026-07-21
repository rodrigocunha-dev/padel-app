// Geração dos horários oferecidos ao jogador na tela de reserva.
// Um horário só aparece se: cabe inteiro numa faixa de funcionamento do
// clube naquele dia, não cruza reserva confirmada e não está no passado.

export type FaixaPreco = {
  dias: number[]; // 0=domingo ... 6=sábado
  hora_inicio: string; // "18:00:00"
  hora_fim: string;
  preco_centavos: number; // por hora
};

export type PeriodoOcupado = { inicio: string; fim: string };

export type Horario = {
  inicio: Date;
  fim: Date;
  precoCentavos: number; // já proporcional à duração
  livre: boolean;
};

const PASSO_MIN = 30; // horários oferecidos de meia em meia hora

function minutosDoDia(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function gerarHorarios(
  faixas: FaixaPreco[],
  dia: Date,
  duracaoMin: number,
  ocupados: PeriodoOcupado[],
  agora: Date = new Date()
): Horario[] {
  const diaSemana = dia.getDay();
  const meiaNoite = new Date(dia);
  meiaNoite.setHours(0, 0, 0, 0);

  const faixasDoDia = faixas.filter((f) => f.dias.includes(diaSemana));
  const ocupadosMs = ocupados.map((o) => ({
    inicio: new Date(o.inicio).getTime(),
    fim: new Date(o.fim).getTime(),
  }));

  const horarios: Horario[] = [];
  const jaAdicionados = new Set<number>();

  for (const faixa of faixasDoDia) {
    const inicioFaixa = minutosDoDia(faixa.hora_inicio);
    const fimFaixa = minutosDoDia(faixa.hora_fim);

    for (
      let minuto = inicioFaixa;
      minuto + duracaoMin <= fimFaixa;
      minuto += PASSO_MIN
    ) {
      const inicio = new Date(meiaNoite.getTime() + minuto * 60_000);
      const fim = new Date(inicio.getTime() + duracaoMin * 60_000);

      // Faixas diferentes podem se encostar; não repetir o mesmo horário.
      if (jaAdicionados.has(inicio.getTime())) continue;
      jaAdicionados.add(inicio.getTime());

      const noPassado = inicio.getTime() <= agora.getTime();
      const ocupado = ocupadosMs.some(
        (o) => o.inicio < fim.getTime() && o.fim > inicio.getTime()
      );

      horarios.push({
        inicio,
        fim,
        precoCentavos: Math.round((faixa.preco_centavos * duracaoMin) / 60),
        livre: !noPassado && !ocupado,
      });
    }
  }

  return horarios.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

// Até quando o jogador pode cancelar/remarcar, pela política do clube.
export function prazoParaMexer(
  inicioReserva: string | Date,
  horasLimite: number
): { limite: Date; podeMexer: boolean } {
  const inicio =
    typeof inicioReserva === "string" ? new Date(inicioReserva) : inicioReserva;
  const limite = new Date(inicio.getTime() - horasLimite * 60 * 60_000);
  return { limite, podeMexer: Date.now() < limite.getTime() };
}

export function formatarHora(data: Date): string {
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarDiaLongo(data: Date): string {
  return data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
