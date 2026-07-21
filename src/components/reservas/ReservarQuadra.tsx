"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  gerarHorarios,
  formatarHora,
  formatarDiaLongo,
  type FaixaPreco,
  type Horario,
  type PeriodoOcupado,
} from "@/lib/reservas";

type Quadra = {
  id: string;
  nome: string;
  esporte: string;
  tipo: string;
  coberta: boolean;
  quadra_precos: FaixaPreco[];
};

const ROTULO_ESPORTE: Record<string, string> = {
  padel: "Padel",
  beach_tennis: "Beach Tennis",
  tenis: "Tênis",
  futebol_society: "Futebol Society",
};

const DURACOES = [
  { min: 60, rotulo: "1h" },
  { min: 90, rotulo: "1h30" },
  { min: 120, rotulo: "2h" },
];

function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ReservarQuadra({
  clubeNome,
  quadras,
  horasLimiteCancelamento,
  politicaTexto,
}: {
  clubeNome: string;
  quadras: Quadra[];
  horasLimiteCancelamento: number;
  politicaTexto: string | null;
}) {
  const router = useRouter();
  const [quadraId, setQuadraId] = useState(quadras[0]?.id ?? "");
  const [dia, setDia] = useState(() => dataISO(new Date()));
  const [duracao, setDuracao] = useState(60);
  const [ocupados, setOcupados] = useState<PeriodoOcupado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [escolhido, setEscolhido] = useState<Horario | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const quadra = quadras.find((q) => q.id === quadraId) ?? quadras[0];

  // Lê o espelho público da agenda: só quadra e horário, sem dados de
  // quem reservou (por isso o jogador pode consultar).
  const carregarOcupados = useCallback(async () => {
    if (!quadra) return;
    const supabase = criarClienteNavegador();
    const { data } = await supabase
      .from("agenda_publica")
      .select("inicio, fim")
      .eq("quadra_id", quadra.id)
      .lt("inicio", `${dia}T23:59:59`)
      .gt("fim", `${dia}T00:00:00`);
    setOcupados((data as PeriodoOcupado[]) ?? []);
    setCarregando(false);
  }, [quadra, dia]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarOcupados();
  }, [carregarOcupados]);

  // Tempo real: se alguém reservar enquanto esta tela está aberta, os
  // horários se atualizam sozinhos.
  useEffect(() => {
    const supabase = criarClienteNavegador();
    const canal = supabase
      .channel("agenda-publica-reserva")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agenda_publica" },
        () => carregarOcupados()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregarOcupados]);

  const horarios = useMemo(() => {
    if (!quadra) return [];
    return gerarHorarios(
      quadra.quadra_precos,
      new Date(`${dia}T12:00:00`),
      duracao,
      ocupados
    );
  }, [quadra, dia, duracao, ocupados]);

  const livres = horarios.filter((h) => h.livre);

  async function confirmar() {
    if (!escolhido || !quadra) return;
    setErro(null);
    setConfirmando(true);

    const supabase = criarClienteNavegador();
    const { data, error } = await supabase.rpc("reservar_quadra", {
      p_quadra_id: quadra.id,
      p_inicio: escolhido.inicio.toISOString(),
      p_fim: escolhido.fim.toISOString(),
    });
    setConfirmando(false);

    if (error) {
      console.error("Erro ao reservar:", error.message);
      // 23P01 = trava anti-overbooking do banco
      if (error.code === "23P01" || error.message.includes("sem_overbooking")) {
        setErro(
          "Esse horário acabou de ser reservado por outra pessoa. Escolha outro."
        );
        carregarOcupados();
      } else if (error.message.includes("FORA_DO_FUNCIONAMENTO")) {
        setErro("O clube não está aberto nesse horário.");
      } else if (error.message.includes("HORARIO_PASSADO")) {
        setErro("Esse horário já passou. Escolha outro.");
      } else {
        setErro("Não conseguimos concluir a reserva. Tente de novo.");
      }
      return;
    }

    posthog.capture("reserva_app_criada", {
      duracao_min: duracao,
      preco_centavos: escolhido.precoCentavos,
      esporte: quadra.esporte,
    });
    router.push(`/app/reservas?nova=${data}`);
  }

  if (quadras.length === 0) {
    return (
      <p className="mt-6 text-sm text-tinta-suave">
        Este clube ainda não cadastrou quadras.
      </p>
    );
  }

  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-bold transition ${
      ativo
        ? "bg-primaria text-white"
        : "bg-superficie text-tinta ring-1 ring-black/10 hover:ring-primaria/40"
    }`;

  const hoje = new Date();
  const amanha = new Date(hoje.getTime() + 24 * 60 * 60_000);

  return (
    <div className="mt-5">
      {/* Dia */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDia(dataISO(hoje))}
          className={chip(dia === dataISO(hoje))}
        >
          Hoje
        </button>
        <button
          type="button"
          onClick={() => setDia(dataISO(amanha))}
          className={chip(dia === dataISO(amanha))}
        >
          Amanhã
        </button>
        <input
          type="date"
          value={dia}
          min={dataISO(hoje)}
          onChange={(e) => e.target.value && setDia(e.target.value)}
          className="rounded-full bg-superficie px-3 py-1.5 text-sm font-bold text-tinta ring-1 ring-black/10 focus:outline-none focus:ring-primaria"
        />
      </div>

      {/* Quadra (só aparece se houver mais de uma) */}
      {quadras.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {quadras.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setQuadraId(q.id)}
              className={chip(q.id === quadraId)}
            >
              {q.nome}
              <span className="ml-1 font-normal opacity-80">
                · {ROTULO_ESPORTE[q.esporte] ?? q.esporte}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Duração */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-tinta-suave">Duração:</span>
        {DURACOES.map((d) => (
          <button
            key={d.min}
            type="button"
            onClick={() => setDuracao(d.min)}
            className={chip(duracao === d.min)}
          >
            {d.rotulo}
          </button>
        ))}
      </div>

      {/* Horários */}
      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">
          Horários livres · {formatarDiaLongo(new Date(`${dia}T12:00:00`))}
        </p>

        {carregando ? (
          <p className="mt-3 text-sm text-tinta-suave">Carregando...</p>
        ) : livres.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-superficie p-4 text-sm text-tinta-suave shadow ring-1 ring-black/5">
            {horarios.length === 0
              ? "O clube não abre neste dia."
              : "Nenhum horário livre com essa duração. Tente outro dia ou uma duração menor."}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {livres.map((h) => (
              <button
                key={h.inicio.getTime()}
                type="button"
                onClick={() => {
                  setErro(null);
                  setEscolhido(h);
                }}
                className="rounded-xl bg-superficie px-2 py-2.5 text-center shadow ring-1 ring-black/5 transition hover:ring-2 hover:ring-primaria"
              >
                <span className="block font-display text-sm font-bold text-tinta">
                  {formatarHora(h.inicio)}
                </span>
                <span className="block text-[11px] text-tinta-suave">
                  {formatarReais(h.precoCentavos)}
                </span>
              </button>
            ))}
          </div>
        )}

        {erro && !escolhido && (
          <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>
        )}
      </div>

      {/* Confirmação */}
      {escolhido && quadra && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-superficie p-5 shadow-xl">
            <h2 className="font-display text-lg font-bold text-tinta">
              Confirmar reserva
            </h2>
            <div className="mt-3 space-y-1 text-sm text-tinta">
              <p>
                <span className="text-tinta-suave">Clube:</span> {clubeNome}
              </p>
              <p>
                <span className="text-tinta-suave">Quadra:</span> {quadra.nome}{" "}
                ({ROTULO_ESPORTE[quadra.esporte] ?? quadra.esporte}
                {quadra.coberta ? ", coberta" : ""})
              </p>
              <p className="capitalize">
                <span className="text-tinta-suave">Quando:</span>{" "}
                {formatarDiaLongo(escolhido.inicio)}
              </p>
              <p>
                <span className="text-tinta-suave">Horário:</span>{" "}
                {formatarHora(escolhido.inicio)} às{" "}
                {formatarHora(escolhido.fim)}
              </p>
              <p className="pt-1 font-display text-xl font-extrabold text-primaria">
                {formatarReais(escolhido.precoCentavos)}
              </p>
            </div>

            <div className="mt-3 rounded-xl bg-fundo p-3 text-xs text-tinta-suave">
              💳 O pagamento é feito no clube. O PIX dividido entre os
              jogadores chega em breve.
              <br />
              ↩️ Cancelamento ou remarcação até{" "}
              <strong className="text-tinta">
                {horasLimiteCancelamento}h antes
              </strong>
              .
              {politicaTexto && (
                <>
                  <br />
                  {politicaTexto}
                </>
              )}
            </div>

            {erro && (
              <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={confirmar}
                disabled={confirmando}
                className="flex-1 rounded-full bg-destaque px-4 py-3 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
              >
                {confirmando ? "Reservando..." : "Confirmar reserva"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEscolhido(null);
                  setErro(null);
                }}
                className="rounded-full px-4 py-3 text-sm font-medium text-tinta-suave hover:text-tinta"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
