"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";

export type Aviso = {
  id: string;
  tipo: string;
  partidaId: string | null;
  partidaNome: string | null;
};

const TITULO: Record<string, string> = {
  set_registrado: "Registraram um resultado do seu jogo",
  votacao_aberta: "Há um placar em disputa — seu voto decide",
};

const DETALHE: Record<string, string> = {
  set_registrado:
    "Confira. Se não estiver certo, você tem 24h para contestar.",
  votacao_aberta:
    "Você estava lá. Toque para dizer qual placar está certo.",
};

const ICONE: Record<string, string> = {
  set_registrado: "📋",
  votacao_aberta: "🗳️",
};

// Um bloco por TIPO, não um por aviso: com 3 resultados registrados a tela
// virava uma pilha de blocos iguais. Quando há mais de um do mesmo tipo, o
// bloco abre a lista das partidas envolvidas.
export function AvisosPendentes({ avisos }: { avisos: Aviso[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(null);

  const tipos = [...new Set(avisos.map((a) => a.tipo))];
  if (tipos.length === 0) return null;

  // Ao ir para a partida, os avisos daquele jogo já foram vistos — some o
  // que levou a pessoa até lá, em vez de continuar cobrando algo feito.
  async function marcarLidos(ids: string[]) {
    const supabase = criarClienteNavegador();
    await supabase
      .from("avisos")
      .update({ lido_em: new Date().toISOString() })
      .in("id", ids);
    router.refresh();
  }

  return (
    <ul className="mt-4 space-y-2">
      {tipos.map((tipo) => {
        const doTipo = avisos.filter((a) => a.tipo === tipo);
        const unico = doTipo.length === 1;
        const destino = unico && doTipo[0].partidaId
          ? `/app/partidas/${doTipo[0].partidaId}`
          : null;

        const conteudo = (
          <>
            <p className="font-display text-sm font-bold text-amber-800">
              {ICONE[tipo]} {TITULO[tipo] ?? "Aviso"}
              {!unico && ` (${doTipo.length})`}
            </p>
            <p className="mt-0.5 text-xs text-amber-800/80">
              {unico && doTipo[0].partidaNome
                ? doTipo[0].partidaNome
                : DETALHE[tipo] ?? ""}
            </p>
          </>
        );

        return (
          <li key={tipo}>
            {destino ? (
              <Link
                href={destino}
                onClick={() => marcarLidos(doTipo.map((a) => a.id))}
                className="block rounded-2xl bg-amber-100 p-4 shadow ring-1 ring-amber-200 transition hover:brightness-105"
              >
                {conteudo}
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAberto(aberto === tipo ? null : tipo)}
                  className="block w-full rounded-2xl bg-amber-100 p-4 text-left shadow ring-1 ring-amber-200 transition hover:brightness-105"
                >
                  {conteudo}
                  <p className="mt-1 text-xs font-bold text-amber-800">
                    {aberto === tipo ? "Fechar" : "Ver quais jogos →"}
                  </p>
                </button>

                {aberto === tipo && (
                  <ul className="mt-2 space-y-2 pl-3">
                    {doTipo.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={a.partidaId ? `/app/partidas/${a.partidaId}` : "#"}
                          onClick={() => marcarLidos([a.id])}
                          className="block rounded-xl bg-superficie p-3 shadow ring-1 ring-black/5 transition hover:ring-primaria/40"
                        >
                          <p className="text-sm font-bold text-tinta">
                            {a.partidaNome ?? "Ver jogo"}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
