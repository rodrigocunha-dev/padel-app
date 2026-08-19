"use client";

import { useCallback, useEffect, useState } from "react";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mascararTelefoneBr } from "@/lib/telefone";
import { AgendaOcupacao } from "@/components/clube/AgendaOcupacao";
import type { QuadraComFaixas } from "@/lib/ocupacao";

type Quadra = QuadraComFaixas & { esporte: string };

type Reserva = {
  id: string;
  quadra_id: string;
  inicio: string;
  fim: string;
  cliente_nome: string | null;
  origem: string;
  jogador_id: string | null;
  motivo_bloqueio?: string | null;
  jogador_nome?: string | null;
};

const HORA_INICIAL = 6;
const HORA_FINAL = 24;

function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rotuloDia(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function AgendaDia({
  quadras,
  usuarioId,
}: {
  quadras: Quadra[];
  usuarioId: string;
}) {
  const [visao, setVisao] = useState<"dia" | "semana" | "mes">("dia");
  const [dia, setDia] = useState(() => dataISO(new Date()));
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [slotAberto, setSlotAberto] = useState<{
    quadraId: string;
    hora: number;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // O que o dono quer fazer com um horário livre: vender, fechar ou anunciar.
  const [modo, setModo] = useState<"reserva" | "bloqueio" | "avisar">("reserva");
  const [avisados, setAvisados] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const supabase = criarClienteNavegador();
    const inicioDia = new Date(`${dia}T00:00:00`);
    const fimDia = new Date(`${dia}T23:59:59`);
    const { data } = await supabase
      .from("reservas")
      .select("id, quadra_id, inicio, fim, cliente_nome, origem, jogador_id, motivo_bloqueio")
      .in(
        "quadra_id",
        quadras.map((q) => q.id)
      )
      .eq("status", "confirmada")
      .lt("inicio", fimDia.toISOString())
      .gt("fim", inicioDia.toISOString());

    const lista = (data as Reserva[]) ?? [];

    // Reserva feita pelo app não tem "cliente_nome": o clube precisa saber
    // quem é o jogador, então buscamos os nomes em seguida.
    const idsJogadores = [
      ...new Set(lista.filter((r) => r.jogador_id).map((r) => r.jogador_id!)),
    ];
    if (idsJogadores.length > 0) {
      const { data: jogadores } = await supabase
        .from("jogadores")
        .select("id, nome")
        .in("id", idsJogadores);
      const nomePorId = new Map(
        (jogadores ?? []).map((j) => [j.id as string, j.nome as string])
      );
      lista.forEach((r) => {
        if (r.jogador_id) r.jogador_nome = nomePorId.get(r.jogador_id) ?? null;
      });
    }

    setReservas(lista);
    setCarregando(false);
  }, [dia, quadras]);

  useEffect(() => {
    // Busca de dados ao abrir/trocar o dia: o setState acontece após o
    // await (assíncrono), não causa a cascata que a regra tenta evitar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  // Tempo real: reserva feita pelo app (ou em outro dispositivo do clube)
  // aparece na agenda sozinha, sem atualizar a página.
  useEffect(() => {
    const supabase = criarClienteNavegador();
    const canal = supabase
      .channel("agenda-clube")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservas" },
        () => carregar()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  function reservaNoSlot(quadraId: string, hora: number): Reserva | null {
    const slotInicio = new Date(`${dia}T${String(hora).padStart(2, "0")}:00:00`).getTime();
    const slotFim = slotInicio + 60 * 60_000;
    return (
      reservas.find(
        (r) =>
          r.quadra_id === quadraId &&
          new Date(r.inicio).getTime() < slotFim &&
          new Date(r.fim).getTime() > slotInicio
      ) ?? null
    );
  }

  async function criarReserva(dadosForm: FormData) {
    if (!slotAberto) return;
    const nome = String(dadosForm.get("nome") ?? "").trim();
    const telefone = String(dadosForm.get("telefone") ?? "").trim();
    const duracaoMin = Number(dadosForm.get("duracao") ?? 60);

    if (!nome) {
      setErro("Informe o nome de quem reservou.");
      return;
    }

    setErro(null);
    setSalvando(true);
    const inicio = new Date(
      `${dia}T${String(slotAberto.hora).padStart(2, "0")}:00:00`
    );
    const fim = new Date(inicio.getTime() + duracaoMin * 60_000);

    const supabase = criarClienteNavegador();
    const { error } = await supabase.from("reservas").insert({
      quadra_id: slotAberto.quadraId,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      origem: "balcao",
      cliente_nome: nome,
      cliente_telefone: telefone.replace(/\D/g, "") || null,
      criado_por: usuarioId,
    });
    setSalvando(false);

    if (error) {
      // 23P01 = trava anti-overbooking do banco
      setErro(
        error.code === "23P01"
          ? "Esse horário acabou de ser ocupado. Atualize a agenda."
          : "Não conseguimos salvar a reserva. Tente de novo."
      );
      console.error("Erro ao reservar:", error.message);
      return;
    }

    posthog.capture("reserva_balcao_criada", { duracao_min: duracaoMin });
    setSlotAberto(null);
    carregar();
  }

  // Bloquear é chamada de função no servidor, e não `insert` direto como a
  // reserva de balcão: só o dono do clube pode bloquear, e essa checagem
  // precisa morar no banco. O 23P01 (sobreposição) vem traduzido de lá.
  async function bloquear(dados: FormData) {
    if (!slotAberto) return;
    const motivo = String(dados.get("motivo") ?? "").trim();
    const duracaoMin = Number(dados.get("duracao") ?? 60);

    setErro(null);
    setSalvando(true);

    const inicio = new Date(
      `${dia}T${String(slotAberto.hora).padStart(2, "0")}:00:00`
    );
    const fim = new Date(inicio.getTime() + duracaoMin * 60_000);

    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc("bloquear_horario", {
      p_quadra_id: slotAberto.quadraId,
      p_inicio: inicio.toISOString(),
      p_fim: fim.toISOString(),
      p_motivo: motivo || null,
    });
    setSalvando(false);

    if (error) {
      setErro(
        error.message.includes("HORARIO_OCUPADO")
          ? "Esse horário acabou de ser ocupado. Atualize a agenda."
          : "Não conseguimos bloquear. Tente de novo."
      );
      return;
    }

    posthog.capture("horario_bloqueado", { duracao_min: duracaoMin });
    setSlotAberto(null);
    carregar();
  }

  // Avisa jogadores da cidade de que sobrou horário. O push sai sozinho pelo
  // gatilho do banco — aqui é só o disparo.
  async function promover(duracaoMin: number) {
    if (!slotAberto) return;

    setErro(null);
    setSalvando(true);

    const inicio = new Date(
      `${dia}T${String(slotAberto.hora).padStart(2, "0")}:00:00`
    );
    const fim = new Date(inicio.getTime() + duracaoMin * 60_000);

    const supabase = criarClienteNavegador();
    const { data, error } = await supabase.rpc("promover_horario_ocioso", {
      p_quadra_id: slotAberto.quadraId,
      p_inicio: inicio.toISOString(),
      p_fim: fim.toISOString(),
    });
    setSalvando(false);

    if (error) {
      if (error.message.includes("AGUARDE_6H")) {
        setErro(
          "Você já avisou jogadores nas últimas 6 horas. Espere um pouco para não cansar quem recebe."
        );
      } else if (error.message.includes("HORARIO_NO_PASSADO")) {
        setErro("Esse horário já passou.");
      } else if (error.message.includes("HORARIO_OCUPADO")) {
        setErro("Esse horário não está mais livre.");
      } else {
        setErro("Não conseguimos avisar agora. Tente de novo.");
      }
      return;
    }

    posthog.capture("horario_ocioso_promovido", { avisados: data ?? 0 });
    setAvisados(typeof data === "number" ? data : 0);
  }

  async function cancelarReserva(reservaId: string) {
    const supabase = criarClienteNavegador();
    const { error } = await supabase
      .from("reservas")
      .update({ status: "cancelada" })
      .eq("id", reservaId);
    if (!error) {
      posthog.capture("reserva_balcao_cancelada");
      carregar();
    }
  }

  // Avança/volta conforme a visão: 1 dia, 1 semana ou 1 mês.
  function mudarPeriodo(direcao: number) {
    const d = new Date(`${dia}T12:00:00`);
    if (visao === "dia") d.setDate(d.getDate() + direcao);
    else if (visao === "semana") d.setDate(d.getDate() + direcao * 7);
    else d.setMonth(d.getMonth() + direcao);
    setCarregando(true);
    setDia(dataISO(d));
    setSlotAberto(null);
  }

  const horas = Array.from(
    { length: HORA_FINAL - HORA_INICIAL },
    (_, i) => HORA_INICIAL + i
  );

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-superficie p-1 ring-1 ring-black/10">
          {(
            [
              ["dia", "Dia"],
              ["semana", "Semana"],
              ["mes", "Mês"],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setVisao(valor)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold ${
                visao === valor
                  ? "bg-primaria text-white"
                  : "text-tinta-suave hover:text-tinta"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {/* Seletor de data com calendário (pedido do fundador) */}
        <input
          type="date"
          value={dia}
          onChange={(e) => {
            if (!e.target.value) return;
            setCarregando(true);
            setDia(e.target.value);
            setSlotAberto(null);
          }}
          className="rounded-full bg-superficie px-4 py-2 text-sm font-bold text-tinta ring-1 ring-black/10 focus:outline-none focus:ring-primaria"
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => mudarPeriodo(-1)}
          className="rounded-full bg-superficie px-4 py-2 text-sm font-bold text-tinta ring-1 ring-black/10"
        >
          ← Anterior
        </button>
        <p className="font-display font-bold capitalize text-tinta">
          {visao === "dia"
            ? rotuloDia(new Date(`${dia}T12:00:00`))
            : visao === "semana"
              ? "Semana"
              : new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
        </p>
        <button
          type="button"
          onClick={() => mudarPeriodo(1)}
          className="rounded-full bg-superficie px-4 py-2 text-sm font-bold text-tinta ring-1 ring-black/10"
        >
          Próximo →
        </button>
      </div>

      {visao !== "dia" ? (
        <AgendaOcupacao
          quadras={quadras}
          visao={visao}
          dataBase={dia}
          aoEscolherDia={(novoDia) => {
            setCarregando(true);
            setDia(novoDia);
            setVisao("dia");
            setSlotAberto(null);
            posthog.capture("agenda_dia_aberto_pela_visao", { visao });
          }}
        />
      ) : quadras.length === 0 ? (
        <p className="mt-6 text-sm text-tinta-suave">
          Cadastre quadras no painel para ver a agenda.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl bg-superficie p-4 shadow-lg ring-1 ring-black/5">
          <table className="w-full min-w-[32rem] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-14" />
                {quadras.map((q) => (
                  <th
                    key={q.id}
                    className="pb-1 text-sm font-bold text-tinta"
                  >
                    {q.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horas.map((hora) => (
                <tr key={hora}>
                  <td className="pr-1 text-right align-top text-xs font-medium text-tinta-suave">
                    {String(hora).padStart(2, "0")}:00
                  </td>
                  {quadras.map((q) => {
                    const reserva = reservaNoSlot(q.id, hora);
                    if (reserva) {
                      const ehInicio =
                        new Date(reserva.inicio).getHours() === hora;
                      // Bloqueio ocupa a quadra igual a uma reserva, mas não é
                      // uma: cinza em vez de verde, para o dono bater o olho e
                      // saber que ali não entrou dinheiro.
                      const ehBloqueio = reserva.origem === "bloqueio";
                      return (
                        <td key={q.id} className="align-top">
                          <div
                            className={`rounded-lg px-2 py-1.5 text-xs font-medium ${
                              ehBloqueio
                                ? "bg-tinta-suave/70 text-white"
                                : "bg-primaria/90 text-white"
                            }`}
                          >
                            {ehInicio ? (
                              <>
                                {reserva.origem === "app" && (
                                  <span title="Reserva feita pelo app">📱 </span>
                                )}
                                {ehBloqueio && <span>🚧 </span>}
                                {ehBloqueio
                                  ? (reserva.motivo_bloqueio ?? "Bloqueado")
                                  : (reserva.cliente_nome ??
                                    reserva.jogador_nome ??
                                    "Reservado")}
                                <button
                                  type="button"
                                  onClick={() => cancelarReserva(reserva.id)}
                                  className="ml-2 text-white/70 hover:text-white"
                                  title="Cancelar reserva"
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              "·"
                            )}
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={q.id} className="align-top">
                        <button
                          type="button"
                          onClick={() => {
                            setErro(null);
                            setSlotAberto({ quadraId: q.id, hora });
                          }}
                          className="w-full rounded-lg border border-dashed border-black/10 px-2 py-1.5 text-xs text-tinta-suave/60 transition hover:border-primaria hover:text-primaria"
                        >
                          livre
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {carregando && (
            <p className="mt-2 text-xs text-tinta-suave">Atualizando...</p>
          )}
        </div>
      )}

      {slotAberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            action={modo === "bloqueio" ? bloquear : criarReserva}
            className="w-full max-w-sm rounded-2xl bg-superficie p-5 shadow-xl"
          >
            <h2 className="font-display text-lg font-bold text-tinta">
              {quadras.find((q) => q.id === slotAberto.quadraId)?.nome} ·{" "}
              {String(slotAberto.hora).padStart(2, "0")}:00
            </h2>

            {/* Três coisas diferentes para o mesmo horário vazio: vender,
                fechar ou anunciar. Antes só existia a primeira, e fechar a
                quadra só dava criando uma reserva falsa. */}
            <div className="mt-3 flex gap-1 rounded-xl bg-fundo p-1">
              {(
                [
                  ["reserva", "Reservar"],
                  ["bloqueio", "Bloquear"],
                  ["avisar", "Avisar"],
                ] as const
              ).map(([id, rotulo]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setModo(id);
                    setErro(null);
                    setAvisados(null);
                  }}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                    modo === id
                      ? "bg-superficie text-primaria shadow"
                      : "text-tinta-suave"
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>

            {modo === "reserva" && (
              <>
                <label className="mt-4 flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-tinta">
                    Nome de quem reservou
                  </span>
                  <input
                    name="nome"
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex.: João da Silva"
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta focus:border-primaria focus:outline-none"
                  />
                </label>

                <label className="mt-3 flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-tinta">
                    WhatsApp <span className="text-tinta-suave">(opcional)</span>
                  </span>
                  <input
                    name="telefone"
                    type="tel"
                    onChange={(e) =>
                      (e.target.value = mascararTelefoneBr(e.target.value))
                    }
                    placeholder="(51) 99999-8888"
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta focus:border-primaria focus:outline-none"
                  />
                </label>
              </>
            )}

            {modo === "bloqueio" && (
              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-sm font-medium text-tinta">
                  Motivo <span className="text-tinta-suave">(opcional)</span>
                </span>
                <input
                  name="motivo"
                  type="text"
                  autoFocus
                  placeholder="Ex.: manutenção, chuva, torneio"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta focus:border-primaria focus:outline-none"
                />
                <span className="text-xs text-tinta-suave">
                  A quadra fica ocupada na agenda e some para os jogadores.
                  Bloqueio não entra no faturamento nem na taxa de ocupação.
                </span>
              </label>
            )}

            {modo === "avisar" && (
              <div className="mt-4">
                <p className="text-sm text-tinta">
                  Avisamos os jogadores da sua cidade que esta quadra está
                  livre neste horário.
                </p>
                <p className="mt-2 text-xs text-tinta-suave">
                  Só dá para avisar uma vez a cada 6 horas, para não cansar
                  quem recebe. O horário continua livre até alguém reservar.
                </p>
                {avisados !== null && (
                  <p className="mt-3 rounded-xl bg-primaria/10 p-3 text-sm font-bold text-primaria">
                    {avisados === 0
                      ? "Nenhum jogador da sua cidade para avisar ainda."
                      : `${avisados} ${avisados === 1 ? "jogador avisado" : "jogadores avisados"} ✓`}
                  </p>
                )}
              </div>
            )}

            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-sm font-medium text-tinta">Duração</span>
              <select
                name="duracao"
                defaultValue="60"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta focus:border-primaria focus:outline-none"
              >
                <option value="60">1 hora</option>
                <option value="90">1h30</option>
                <option value="120">2 horas</option>
              </select>
            </label>

            {erro && (
              <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>
            )}

            <div className="mt-4 flex gap-2">
              {modo === "avisar" ? (
                // Fora do fluxo do formulário: avisar não cria nada na
                // agenda, então não é "enviar" o mesmo formulário.
                <button
                  type="button"
                  disabled={salvando || avisados !== null}
                  onClick={() =>
                    promover(
                      Number(
                        (
                          document.querySelector(
                            'select[name="duracao"]'
                          ) as HTMLSelectElement | null
                        )?.value ?? 60
                      )
                    )
                  }
                  className="flex-1 rounded-full bg-destaque px-4 py-2.5 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
                >
                  {salvando
                    ? "Avisando..."
                    : avisados !== null
                      ? "Avisado ✓"
                      : "Avisar jogadores"}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 rounded-full bg-destaque px-4 py-2.5 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
                >
                  {salvando
                    ? "Salvando..."
                    : modo === "bloqueio"
                      ? "Bloquear horário"
                      : "Confirmar reserva"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSlotAberto(null)}
                className="rounded-full px-4 py-2.5 text-sm font-medium text-tinta-suave hover:text-tinta"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
