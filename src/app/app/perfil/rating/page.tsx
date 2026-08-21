import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { trilhaDoRating } from "@/lib/rating";

export const metadata: Metadata = {
  title: "Como minha categoria mudou — padel",
};

// ============================================================
// A TRANSPARÊNCIA DA REGRA Nº 4
// ============================================================
// "Após cada jogo, mostrar quanto mudou e por quê." Esta é a tela onde
// isso mora — e é o que nos separa do Playtomic, onde o número muda e
// ninguém sabe explicar.
//
// A unidade é o DIA, não o set, porque o motor calcula em blocos de um dia
// (item 11): a sessão é uma noite, e "nesta noite você subiu 12 pontos" é
// legível, enquanto quatro micro-mudanças não são.
//
// Dos outros jogadores aparece só categoria e nível — nunca o rating deles
// (item 20), mesmo aqui, que é uma explicação sobre os SEUS jogos.
export default async function PaginaTrilhaDoRating() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const trilha = await trilhaDoRating(user.id);

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Como minha categoria mudou
          </h1>
          <Link
            href="/app/perfil"
            className="shrink-0 text-sm font-medium text-tinta-suave hover:text-tinta"
          >
            ← Perfil
          </Link>
        </div>

        {trilha.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-superficie p-6 text-center shadow-lg ring-1 ring-black/5">
            <p className="font-display text-base font-bold text-tinta">
              Nada por aqui ainda
            </p>
            <p className="mt-2 text-sm text-tinta-suave">
              Assim que os sets dos seus jogos forem confirmados, você vê
              aqui o que cada noite fez com o seu nível. Um set vale a partir
              de 24 horas depois de registrado.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-tinta-suave">
              Os sets de um mesmo dia contam juntos — é a noite que move sua
              categoria, não cada set separado.
            </p>

            <ul className="mt-5 space-y-3">
              {trilha.map((d) => {
                const subiu = d.variacao >= 0;
                return (
                  <li
                    key={d.dia}
                    className="rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-display text-base font-bold text-tinta">
                        {new Date(d.dia + "T12:00:00").toLocaleDateString(
                          "pt-BR",
                          { weekday: "long", day: "2-digit", month: "2-digit" }
                        )}
                      </p>
                      <p
                        className={`font-display text-lg font-extrabold ${
                          subiu ? "text-primaria" : "text-red-600"
                        }`}
                      >
                        {subiu ? "▲" : "▼"} {Math.abs(d.variacao).toFixed(1)}
                      </p>
                    </div>

                    {/* Onde foi o jogo, e o caminho para abri-lo. Antes a
                        trilha dizia quanto você subiu naquela noite sem dizer
                        QUE noite — e a pessoa tinha que caçar partida por
                        partida, que era exatamente a queixa. */}
                    {d.clube && (
                      <p className="mt-0.5 text-sm text-tinta-suave">
                        {d.partidaId ? (
                          <Link
                            href={`/app/partidas/${d.partidaId}`}
                            className="underline decoration-tinta-suave/40 hover:text-tinta"
                          >
                            {d.clube} →
                          </Link>
                        ) : (
                          d.clube
                        )}
                      </p>
                    )}

                    {/* O impacto de cada set aparece porque a conta do dia se
                        decompõe exatamente — a soma daqui fecha com o número
                        do topo. O motor continua contando por dia. */}
                    <ul className="mt-3 space-y-2">
                      {d.sets.map((s, i) => (
                        <li
                          key={i}
                          className="flex items-start justify-between gap-3 text-sm text-tinta-suave"
                        >
                          <span className="flex items-start gap-2">
                            <span aria-hidden>{s.venceu ? "✅" : "❌"}</span>
                            <span>
                              {/* O placar vem primeiro: sem ele, dois sets
                                  com a mesma descrição mostravam valores
                                  diferentes e pareciam arbitrários. */}
                              {s.placar && (
                                <strong className="text-tinta">
                                  {s.placar}
                                </strong>
                              )}
                              {s.placar ? " — " : ""}
                              {s.venceu ? "venceu" : "perdeu"} jogando com um{" "}
                              <strong className="text-tinta">
                                {s.parceiro}
                              </strong>{" "}
                              contra a dupla{" "}
                              <strong className="text-tinta">
                                {s.adversarios}
                              </strong>
                            </span>
                          </span>
                          {s.variacao !== null && (
                            <span
                              className={`shrink-0 font-display text-sm font-bold ${
                                s.variacao >= 0
                                  ? "text-primaria"
                                  : "text-red-600"
                              }`}
                            >
                              {s.variacao >= 0 ? "+" : "−"}
                              {Math.abs(s.variacao).toFixed(1)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 rounded-2xl bg-primaria/5 p-4 text-xs text-tinta-suave">
              <p className="font-bold text-tinta">Por que o valor muda tanto?</p>
              <p className="mt-1.5">
                Vencer quem joga mais que você vale bem mais do que vencer
                quem joga menos. E o parceiro conta: ganhar carregando alguém
                de categoria mais baixa rende mais do que ganhar ao lado de
                alguém mais forte, porque ali já se esperava a vitória.
              </p>
              <p className="mt-1.5">
                O placar também pesa — um 6x0 diz mais sobre o jogo do que um
                7x6 —, mas nunca inverte: quem venceu sempre sobe.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
