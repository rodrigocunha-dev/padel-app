"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  faixaCategoria,
  jogadorCompativel,
  ROTULO_SEXO_JOGO,
} from "@/lib/partidas";
import type { PartidaFeed } from "@/lib/partidas-tipos";

function formatarQuando(inicio: string): string {
  const d = new Date(inicio);
  return (
    d.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    }) +
    " · " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

export function FeedPartidas({
  partidas,
  meuId,
  minhaCategoria,
  meuSexo,
}: {
  partidas: PartidaFeed[];
  meuId: string;
  minhaCategoria: number;
  meuSexo: string;
}) {
  const router = useRouter();
  const [entrando, setEntrando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [soCompativeis, setSoCompativeis] = useState(true);
  // "Agora" fixado na montagem — o initializer do useState pode ser impuro.
  const [agora] = useState(() => Date.now());

  const lista = useMemo(() => {
    return partidas
      .filter((p) => new Date(p.inicio).getTime() > agora)
      .filter((p) => {
        if (!soCompativeis) return true;
        return jogadorCompativel(p, {
          categoria: minhaCategoria,
          sexo: meuSexo,
        });
      })
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  }, [partidas, soCompativeis, minhaCategoria, meuSexo, agora]);

  async function entrar(partidaId: string) {
    setErro(null);
    setEntrando(partidaId);
    const supabase = criarClienteNavegador();
    const { data, error } = await supabase.rpc("entrar_na_partida", {
      p_partida_id: partidaId,
    });
    setEntrando(null);

    if (error) {
      console.error("Erro ao entrar:", error.message);
      if (error.message.includes("JA_ESTA_NA_PARTIDA")) {
        router.push(`/app/partidas/${partidaId}`);
      } else if (error.message.includes("INCOMPATIVEL")) {
        setErro("Essa partida não é compatível com sua categoria ou sexo.");
      } else if (error.message.includes("PENDENCIA")) {
        setErro(
          "Você tem uma parte em aberto de outra partida. Acerte antes de entrar em uma nova."
        );
      } else {
        setErro("Não conseguimos entrar na partida. Tente de novo.");
      }
      return;
    }

    posthog.capture("partida_entrou", { como: data });
    router.push(`/app/partidas/${partidaId}`);
  }

  return (
    <div className="mt-5">
      <label className="flex items-center gap-2 text-sm text-tinta">
        <input
          type="checkbox"
          checked={soCompativeis}
          onChange={(e) => setSoCompativeis(e.target.checked)}
        />
        Só partidas compatíveis comigo
      </label>

      {erro && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
          {erro}
        </p>
      )}

      {lista.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-superficie p-6 text-center shadow ring-1 ring-black/5">
          <p className="font-display text-lg font-bold text-tinta">
            Nenhuma partida aberta por enquanto
          </p>
          <p className="mt-2 text-sm text-tinta-suave">
            Que tal criar a sua? Escolha um clube no mapa e monte o jogo.
          </p>
          <Link
            href="/app/descobrir"
            className="mt-4 inline-block rounded-full bg-destaque px-6 py-2.5 font-display font-bold text-destaque-tinta transition hover:brightness-95"
          >
            🗺️ Descobrir clubes
          </Link>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {lista.map((p) => {
            // Quem ocupa vaga é quem ACEITOU. Hoje, em partida aberta, todo
            // mundo é 'aceito' — mas a conta de vagas passou a ter um estado
            // para olhar, e contar sem ele foi a origem de três bugs.
            const jogadores = p.partida_jogadores.filter(
              (j) => j.papel === "jogador" && j.estado === "aceito"
            ).length;
            const jaEstou = p.partida_jogadores.some(
              (j) => j.jogador_id === meuId
            );
            const clube = p.quadras.clubes;

            // Na sessão privada com vaga ("falta um") quem manda no número
            // de vagas é o anúncio do organizador, não `max_jogadores` —
            // essa coluna é sempre 4 na sessão e não descreve o grupo.
            const ehGrupo = p.tipo === "privada";
            const vagas = ehGrupo ? p.vagas_abertas : p.max_jogadores - jogadores;
            const tamanho = ehGrupo ? jogadores + p.vagas_abertas : p.max_jogadores;

            return (
              <div
                key={p.id}
                className="rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-bold text-tinta">
                      {clube.nome}
                    </p>
                    <p className="text-sm text-tinta-suave">
                      {p.quadras.nome} · {clube.cidade}
                    </p>
                    <p className="mt-1 text-sm font-medium text-tinta">
                      {formatarQuando(p.inicio)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primaria/10 px-3 py-1 text-xs font-bold text-primaria">
                    {vagas > 0 ? `${vagas} vaga${vagas > 1 ? "s" : ""}` : "cheia"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                  {/* Quem chega de fora precisa saber que ali já existe um
                      grupo formado — é uma experiência diferente de entrar
                      numa partida montada por desconhecidos. */}
                  {ehGrupo && (
                    <span className="rounded-full bg-destaque px-2 py-0.5 text-destaque-tinta">
                      🎾 Grupo precisa de {vagas}
                    </span>
                  )}
                  <span className="rounded-full bg-fundo px-2 py-0.5 text-tinta-suave">
                    {p.competitiva ? "Competitiva" : "Amistosa"}
                  </span>
                  <span className="rounded-full bg-fundo px-2 py-0.5 text-tinta-suave">
                    {ROTULO_SEXO_JOGO[p.sexo_jogo]}
                  </span>
                  <span className="rounded-full bg-fundo px-2 py-0.5 text-tinta-suave">
                    Cat. {faixaCategoria(p.categoria_min, p.categoria_max)}
                  </span>
                  <span className="rounded-full bg-fundo px-2 py-0.5 text-tinta-suave">
                    {jogadores}/{tamanho} jogadores
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {jaEstou ? (
                    <Link
                      href={`/app/partidas/${p.id}`}
                      className="rounded-full bg-primaria px-4 py-2 text-sm font-bold text-white"
                    >
                      Você está nesta →
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => entrar(p.id)}
                        disabled={entrando === p.id}
                        className="rounded-full bg-destaque px-5 py-2 font-display text-sm font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
                      >
                        {/* Sessão de grupo não tem fila de substitutos: ou
                            existe vaga anunciada, ou ela nem aparece aqui. */}
                        {entrando === p.id
                          ? "Entrando..."
                          : vagas > 0 || ehGrupo
                            ? "Entrar"
                            : "Entrar na fila"}
                      </button>
                      <Link
                        href={`/app/partidas/${p.id}`}
                        className="text-sm font-medium text-primaria hover:underline"
                      >
                        Ver detalhes
                      </Link>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
