import Link from "next/link";

// ============================================================
// "VOCÊ ESTÁ NA FILA" — o bloco que faltava
// ============================================================
// Quem está na fila de substitutos não aparecia em lugar nenhum: "Minhas
// partidas" exige `papel = 'jogador'` e o feed some com a partida assim que
// ela começa. A pessoa perdia o único acesso que tinha.
//
// Fica em BLOCO PRÓPRIO, e não dentro da lista de "Minhas partidas", por
// decisão do fundador (12/08/2026): **fila é possibilidade, não jogo**.
// Misturar contaminaria os filtros de status e pagamento, que não se
// aplicam a quem talvez nem entre em quadra.
//
// Vantagem que isso traz de graça: quando a pessoa é promovida, o `papel`
// vira 'jogador', ela sai daqui e entra na lista sozinha — sem nenhuma
// regra extra escrita para isso.

export type ItemDaFila = {
  partidaId: string;
  clube: string;
  quadra: string;
  inicio: string;
  posicao: number; // 1 = próximo a entrar
};

export function BlocoNaFila({ itens }: { itens: ItemDaFila[] }) {
  if (itens.length === 0) return null;

  return (
    <section className="mt-4">
      <h2 className="font-display text-base font-bold text-tinta">
        Você está na fila
      </h2>
      <ul className="mt-2 space-y-2">
        {itens.map((i) => (
          <li key={i.partidaId}>
            <Link
              href={`/app/partidas/${i.partidaId}`}
              className="block rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5 transition hover:ring-primaria/40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display font-bold text-tinta">{i.clube}</p>
                <span className="shrink-0 rounded-full bg-primaria/10 px-2.5 py-0.5 text-xs font-bold text-primaria">
                  {i.posicao === 1 ? "próximo a entrar" : `${i.posicao}º na fila`}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-tinta-suave">
                {i.quadra} ·{" "}
                {new Date(i.inicio).toLocaleString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="mt-1.5 text-xs text-tinta-suave">
                Se alguém sair, você entra automaticamente — e a gente avisa.
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
