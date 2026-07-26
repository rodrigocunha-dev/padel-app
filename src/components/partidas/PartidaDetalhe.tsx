"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  faixaCategoria,
  ROTULO_SEXO_JOGO,
  ROTULO_CATEGORIA,
} from "@/lib/partidas";
import { PagamentoPartida } from "@/components/partidas/PagamentoPartida";

type Jogador = {
  jogador_id: string;
  papel: string;
  ordem: number;
  perfil: { nome: string; foto_url: string | null; categoria: number } | null;
};

type Partida = {
  id: string;
  categoria_min: number;
  categoria_max: number;
  competitiva: boolean;
  sexo_jogo: string;
  max_jogadores: number;
  status: string;
  organizador_id: string;
  inicio: string;
  fim: string;
  preco_centavos: number | null;
  quadras: { nome: string; clubes: { id: string; nome: string; cidade: string } };
  jogadores: Jogador[];
};

function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function PartidaDetalhe({
  partida,
  meuId,
}: {
  partida: Partida;
  meuId: string;
}) {
  const router = useRouter();
  const [acao, setAcao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Tempo real: entradas/saídas aparecem sozinhas.
  useEffect(() => {
    const supabase = criarClienteNavegador();
    const canal = supabase
      .channel(`partida-${partida.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partida_jogadores" },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partidas" },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [partida.id, router]);

  const jogadores = partida.jogadores
    .filter((j) => j.papel === "jogador")
    .sort((a, b) => a.ordem - b.ordem);
  const substitutos = partida.jogadores
    .filter((j) => j.papel === "substituto")
    .sort((a, b) => a.ordem - b.ordem);

  const souOrganizador = meuId === partida.organizador_id;
  const jaEstou = partida.jogadores.some((j) => j.jogador_id === meuId);
  const ehSubstituto = partida.jogadores.some(
    (j) => j.jogador_id === meuId && j.papel === "substituto"
  );
  const vagas = partida.max_jogadores - jogadores.length;
  const inicio = new Date(partida.inicio);
  const fim = new Date(partida.fim);
  const cancelada = partida.status === "cancelada";

  // Valor por jogador: divisão igual, sobra de centavos nos primeiros.
  const total = partida.preco_centavos ?? 0;
  const base = Math.floor(total / partida.max_jogadores);
  const sobra = total - base * partida.max_jogadores;

  async function chamar(rpc: string, evento: string) {
    setErro(null);
    setAcao(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc(rpc, { p_partida_id: partida.id });
    setAcao(false);
    if (error) {
      console.error(`Erro em ${rpc}:`, error.message);
      if (error.message.includes("ORGANIZADOR_NAO_SAI")) {
        setErro(
          "Você é o organizador. Para sair, cancele a partida (isso libera a quadra)."
        );
      } else if (error.message.includes("PENDENCIA")) {
        setErro(
          "Você tem uma parte em aberto de outra partida. Acerte antes de entrar em uma nova."
        );
      } else {
        setErro("Não conseguimos concluir. Tente de novo.");
      }
      return;
    }
    posthog.capture(evento);
    if (rpc === "cancelar_partida" || rpc === "sair_da_partida") {
      router.push("/app/partidas");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="mt-3">
      <h1 className="font-display text-2xl font-extrabold text-tinta">
        {partida.quadras.clubes.nome}
      </h1>
      <p className="text-sm text-tinta-suave">
        {partida.quadras.nome} ·{" "}
        {partida.quadras.clubes.cidade}
      </p>

      {cancelada && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
          Esta partida foi cancelada.
        </p>
      )}

      <div className="mt-4 rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5">
        <p className="font-display text-lg font-bold text-tinta capitalize">
          {inicio.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <p className="font-display text-xl font-extrabold text-primaria">
          {inicio.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          às{" "}
          {fim.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-fundo px-2 py-0.5 text-tinta-suave">
            {partida.competitiva ? "Competitiva" : "Amistosa"}
          </span>
          <span className="rounded-full bg-fundo px-2 py-0.5 text-tinta-suave">
            {ROTULO_SEXO_JOGO[partida.sexo_jogo]}
          </span>
          <span className="rounded-full bg-fundo px-2 py-0.5 text-tinta-suave">
            Cat. {faixaCategoria(partida.categoria_min, partida.categoria_max)}
          </span>
        </div>
        {total > 0 && (
          <p className="mt-3 text-sm text-tinta">
            Quadra: <strong>{formatarReais(total)}</strong> ·{" "}
            <span className="text-tinta-suave">
              cada um paga ~{formatarReais(base + (sobra > 0 ? 1 : 0))}
            </span>
          </p>
        )}
      </div>

      {/* Jogadores confirmados */}
      <section className="mt-5">
        <h2 className="font-display text-lg font-bold text-tinta">
          Jogadores ({jogadores.length}/{partida.max_jogadores})
        </h2>
        <div className="mt-2 flex flex-col gap-2">
          {jogadores.map((j) => (
            <div
              key={j.jogador_id}
              className="flex items-center gap-3 rounded-xl bg-superficie p-3 shadow ring-1 ring-black/5"
            >
              {j.perfil?.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={j.perfil.foto_url}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primaria/10 text-sm font-bold text-primaria">
                  {j.perfil?.nome?.[0] ?? "?"}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-tinta">
                  {j.perfil?.nome ?? "Jogador"}
                  {j.jogador_id === partida.organizador_id && (
                    <span className="ml-1 text-xs text-tinta-suave">
                      (organizador)
                    </span>
                  )}
                </p>
                <p className="text-xs text-tinta-suave">
                  {j.perfil
                    ? `${ROTULO_CATEGORIA[j.perfil.categoria]} categoria`
                    : ""}
                </p>
              </div>
            </div>
          ))}
          {Array.from({ length: vagas }).map((_, i) => (
            <div
              key={`vaga-${i}`}
              className="flex items-center gap-3 rounded-xl border border-dashed border-black/10 p-3 text-sm text-tinta-suave"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-fundo">
                +
              </div>
              Vaga aberta
            </div>
          ))}
        </div>
      </section>

      {/* Fila de substitutos */}
      {substitutos.length > 0 && (
        <section className="mt-4">
          <h2 className="font-display text-sm font-bold text-tinta-suave">
            Fila de substitutos
          </h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {substitutos.map((j, i) => (
              <p key={j.jogador_id} className="text-sm text-tinta">
                {i + 1}. {j.perfil?.nome ?? "Jogador"}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Divisão do pagamento — só para quem está JOGANDO (não substitutos,
          não quem apenas visita a partida). */}
      {!cancelada && total > 0 && jaEstou && !ehSubstituto && (
        <PagamentoPartida
          partidaId={partida.id}
          meuId={meuId}
          souOrganizador={souOrganizador}
          totalCentavos={total}
          maxJogadores={partida.max_jogadores}
          jogadores={jogadores.map((j) => ({
            jogador_id: j.jogador_id,
            nome: j.perfil?.nome ?? "Jogador",
            ehOrganizador: j.jogador_id === partida.organizador_id,
          }))}
          resumoPartida={`${partida.quadras.nome}, ${inicio.toLocaleDateString(
            "pt-BR",
            { weekday: "short", hour: "2-digit", minute: "2-digit" }
          )} — ${partida.quadras.clubes.nome}`}
        />
      )}

      {erro && (
        <p className="mt-4 text-sm font-medium text-red-600">{erro}</p>
      )}

      {/* Ações */}
      {!cancelada && (
        <div className="mt-5 flex flex-wrap gap-2">
          {!jaEstou && (
            <button
              type="button"
              onClick={() => chamar("entrar_na_partida", "partida_entrou")}
              disabled={acao}
              className="rounded-full bg-destaque px-6 py-3 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
            >
              {vagas > 0 ? "Entrar na partida" : "Entrar na fila"}
            </button>
          )}
          {souOrganizador && (
            <button
              type="button"
              onClick={() => chamar("cancelar_partida", "partida_cancelada")}
              disabled={acao}
              className="rounded-full px-4 py-3 text-sm font-medium text-tinta-suave hover:text-red-600"
            >
              Cancelar partida
            </button>
          )}
          {jaEstou && !souOrganizador && (
            <button
              type="button"
              onClick={() => chamar("sair_da_partida", "partida_saiu")}
              disabled={acao}
              className="rounded-full px-4 py-3 text-sm font-medium text-tinta-suave hover:text-red-600"
            >
              Sair da partida
            </button>
          )}
        </div>
      )}
    </div>
  );
}
