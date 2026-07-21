"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  prazoParaMexer,
  formatarHora,
  formatarDiaLongo,
} from "@/lib/reservas";

type Reserva = {
  id: string;
  inicio: string;
  fim: string;
  status: string;
  preco_centavos: number | null;
  quadras: {
    id: string;
    nome: string;
    esporte: string;
    clubes: {
      id: string;
      nome: string;
      cidade: string;
      horas_limite_cancelamento: number | null;
      politica_cancelamento: string | null;
    };
  };
};

const ROTULO_ESPORTE: Record<string, string> = {
  padel: "Padel",
  beach_tennis: "Beach Tennis",
  tenis: "Tênis",
  futebol_society: "Futebol Society",
};

function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function MinhasReservas({
  reservas,
  idNova,
}: {
  reservas: Reserva[];
  idNova: string | null;
}) {
  const router = useRouter();
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState<
    string | null
  >(null);
  const [erro, setErro] = useState<string | null>(null);

  async function cancelar(reserva: Reserva) {
    setErro(null);
    setCancelando(reserva.id);

    const supabase = criarClienteNavegador();
    const { error } = await supabase
      .from("reservas")
      .update({ status: "cancelada" })
      .eq("id", reserva.id);
    setCancelando(null);
    setConfirmarCancelamento(null);

    if (error) {
      console.error("Erro ao cancelar:", error.message);
      setErro(
        error.message.includes("FORA_DO_PRAZO")
          ? "O prazo de cancelamento deste clube já passou. Fale com o clube pelo WhatsApp."
          : "Não conseguimos cancelar. Tente de novo."
      );
      return;
    }

    posthog.capture("reserva_app_cancelada");
    router.refresh();
  }

  if (reservas.length === 0) {
    return (
      <div className="mt-6 rounded-2xl bg-superficie p-6 text-center shadow ring-1 ring-black/5">
        <p className="font-display text-lg font-bold text-tinta">
          Você ainda não tem reservas
        </p>
        <p className="mt-2 text-sm text-tinta-suave">
          Encontre uma quadra no mapa e reserve em poucos toques.
        </p>
        <Link
          href="/app/descobrir"
          className="mt-4 inline-block rounded-full bg-destaque px-6 py-2.5 font-display font-bold text-destaque-tinta transition hover:brightness-95"
        >
          🗺️ Descobrir clubes
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      {erro && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
          {erro}
        </p>
      )}

      {reservas.map((reserva) => {
        const clube = reserva.quadras.clubes;
        const horasLimite = clube.horas_limite_cancelamento ?? 12;
        const { limite, podeMexer } = prazoParaMexer(
          reserva.inicio,
          horasLimite
        );
        const inicio = new Date(reserva.inicio);
        const fim = new Date(reserva.fim);
        const ehNova = reserva.id === idNova;

        return (
          <div
            key={reserva.id}
            className={`rounded-2xl bg-superficie p-4 shadow ring-1 ${
              ehNova ? "ring-2 ring-primaria" : "ring-black/5"
            }`}
          >
            {ehNova && (
              <p className="mb-2 rounded-lg bg-destaque px-3 py-1.5 text-xs font-bold text-destaque-tinta">
                ✅ Reserva confirmada! Bom jogo. 🎾
              </p>
            )}

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display font-bold text-tinta">
                  {clube.nome}
                </p>
                <p className="text-sm text-tinta-suave">
                  {reserva.quadras.nome} ·{" "}
                  {ROTULO_ESPORTE[reserva.quadras.esporte] ??
                    reserva.quadras.esporte}{" "}
                  · {clube.cidade}
                </p>
                <p className="mt-1.5 text-sm capitalize text-tinta">
                  {formatarDiaLongo(inicio)}
                </p>
                <p className="font-display text-lg font-bold text-primaria">
                  {formatarHora(inicio)} às {formatarHora(fim)}
                </p>
              </div>
              {reserva.preco_centavos != null && (
                <span className="shrink-0 rounded-full bg-primaria/10 px-3 py-1 text-sm font-bold text-primaria">
                  {formatarReais(reserva.preco_centavos)}
                </span>
              )}
            </div>

            <p className="mt-3 text-xs text-tinta-suave">
              {podeMexer ? (
                <>
                  ↩️ Dá para cancelar ou remarcar até{" "}
                  <strong className="text-tinta">
                    {limite.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}{" "}
                    às {formatarHora(limite)}
                  </strong>{" "}
                  ({horasLimite}h antes do jogo).
                </>
              ) : (
                <>
                  🔒 O prazo para cancelar ou remarcar ({horasLimite}h antes)
                  já passou. Fale direto com o clube se precisar.
                </>
              )}
            </p>

            {podeMexer && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/app/clubes/${clube.id}/reservar`}
                  className="rounded-full bg-superficie px-4 py-2 text-sm font-bold text-tinta ring-1 ring-black/10 transition hover:ring-primaria/40"
                >
                  Remarcar
                </Link>
                {confirmarCancelamento === reserva.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => cancelar(reserva)}
                      disabled={cancelando === reserva.id}
                      className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                    >
                      {cancelando === reserva.id
                        ? "Cancelando..."
                        : "Confirmar cancelamento"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmarCancelamento(null)}
                      className="px-2 text-sm font-medium text-tinta-suave hover:text-tinta"
                    >
                      Voltar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setErro(null);
                      setConfirmarCancelamento(reserva.id);
                    }}
                    className="rounded-full px-4 py-2 text-sm font-medium text-tinta-suave hover:text-red-600"
                  >
                    Cancelar reserva
                  </button>
                )}
              </div>
            )}

            <Link
              href={`/app/clubes/${clube.id}`}
              className="mt-3 inline-block text-sm font-medium text-primaria hover:underline"
            >
              Ver clube →
            </Link>
          </div>
        );
      })}
    </div>
  );
}
