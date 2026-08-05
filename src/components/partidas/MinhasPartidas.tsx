"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ROTULO_STATUS_PARTIDA,
  ROTULO_STATUS_PAGAMENTO,
  type StatusPartida,
  type StatusPagamento,
} from "@/lib/partidas";
import type { ItemMinhaPartida } from "@/app/app/partidas/minhas/page";

function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

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

// Cores dos selos de status de pagamento.
const CLASSE_PAGAMENTO: Record<StatusPagamento, string> = {
  paga: "bg-primaria/10 text-primaria",
  aguardando: "bg-amber-100 text-amber-800",
  inadimplente: "bg-red-100 text-red-700",
};

export function MinhasPartidas({
  itens,
  filtroInicial,
}: {
  itens: ItemMinhaPartida[];
  // Vem de quem chegou por um link de cobrança ("você tem jogo não pago"):
  // a lista já abre filtrada, em vez de a pessoa ter que achar a dívida.
  filtroInicial?: StatusPagamento;
}) {
  const [filtroPartida, setFiltroPartida] = useState<StatusPartida | "todas">(
    "todas"
  );
  const [filtroPagamento, setFiltroPagamento] = useState<
    StatusPagamento | "todos"
  >(filtroInicial ?? "todos");

  const lista = useMemo(
    () =>
      itens.filter(
        (i) =>
          (filtroPartida === "todas" || i.statusPartida === filtroPartida) &&
          (filtroPagamento === "todos" || i.statusPagamento === filtroPagamento)
      ),
    [itens, filtroPartida, filtroPagamento]
  );

  const temInadimplencia = itens.some(
    (i) => i.statusPagamento === "inadimplente"
  );

  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-bold transition ${
      ativo
        ? "bg-primaria text-white"
        : "bg-superficie text-tinta ring-1 ring-black/10 hover:ring-primaria/40"
    }`;

  if (itens.length === 0) {
    return (
      <div className="mt-6 rounded-2xl bg-superficie p-6 text-center shadow ring-1 ring-black/5">
        <p className="font-display text-lg font-bold text-tinta">
          Você ainda não jogou nenhuma partida
        </p>
        <p className="mt-2 text-sm text-tinta-suave">
          Entre em uma partida aberta ou crie a sua.
        </p>
        <Link
          href="/app/partidas"
          className="mt-4 inline-block rounded-full bg-destaque px-6 py-2.5 font-display font-bold text-destaque-tinta transition hover:brightness-95"
        >
          👥 Partidas abertas
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {temInadimplencia && (
        <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
          Você tem partida(s) com pagamento em aberto. Acerte para voltar a
          reservar e entrar em partidas.
        </p>
      )}

      {/* Filtros */}
      <div className="rounded-2xl bg-superficie p-3 shadow ring-1 ring-black/5">
        <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">
          Status da partida
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFiltroPartida("todas")}
            className={chip(filtroPartida === "todas")}
          >
            Todas
          </button>
          {(["futura", "jogada"] as StatusPartida[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFiltroPartida(s)}
              className={chip(filtroPartida === s)}
            >
              {ROTULO_STATUS_PARTIDA[s]}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-tinta-suave">
          Status de pagamento
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFiltroPagamento("todos")}
            className={chip(filtroPagamento === "todos")}
          >
            Todos
          </button>
          {(["paga", "aguardando", "inadimplente"] as StatusPagamento[]).map(
            (s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFiltroPagamento(s)}
                className={chip(filtroPagamento === s)}
              >
                {ROTULO_STATUS_PAGAMENTO[s]}
              </button>
            )
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-tinta-suave">
        {lista.length} {lista.length === 1 ? "partida" : "partidas"}
      </p>

      <div className="mt-2 flex flex-col gap-3">
        {lista.map((i) => (
          <Link
            key={i.id}
            href={`/app/partidas/${i.id}`}
            className="rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5 transition hover:ring-primaria/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display font-bold text-tinta">{i.clube}</p>
                <p className="text-sm text-tinta-suave">
                  {i.quadra} · {i.cidade}
                </p>
                <p className="mt-1 text-sm font-medium text-tinta">
                  {formatarQuando(i.inicio)}
                </p>
              </div>
              {i.preco_centavos != null && (
                <span className="shrink-0 text-sm font-bold text-tinta">
                  {formatarReais(
                    Math.round(i.preco_centavos / 4) // parte aproximada por jogador
                  )}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-fundo px-2.5 py-1 text-[11px] font-bold text-tinta-suave">
                {ROTULO_STATUS_PARTIDA[i.statusPartida]}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${CLASSE_PAGAMENTO[i.statusPagamento]}`}
              >
                {ROTULO_STATUS_PAGAMENTO[i.statusPagamento]}
              </span>
            </div>

            {i.statusPagamento !== "paga" && (
              <p className="mt-2 text-sm font-medium text-primaria">
                {i.statusPagamento === "inadimplente"
                  ? "Pagar agora →"
                  : "Ver e pagar →"}
              </p>
            )}
          </Link>
        ))}
        {lista.length === 0 && (
          <p className="rounded-2xl bg-superficie p-4 text-center text-sm text-tinta-suave shadow ring-1 ring-black/5">
            Nenhuma partida com esses filtros.
          </p>
        )}
      </div>
    </div>
  );
}
