"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

const DIAS = [
  { valor: 1, rotulo: "Segunda" },
  { valor: 2, rotulo: "Terça" },
  { valor: 3, rotulo: "Quarta" },
  { valor: 4, rotulo: "Quinta" },
  { valor: 5, rotulo: "Sexta" },
  { valor: 6, rotulo: "Sábado" },
  { valor: 0, rotulo: "Domingo" },
];

const ERROS: Record<string, string> = {
  PERIODO_LONGO_DEMAIS: "O período não pode passar de um ano.",
  PERIODO_INVALIDO: "A data final precisa vir depois da inicial.",
  DURACAO_INVALIDA: "A duração precisa ficar entre 30 minutos e 8 horas.",
  SO_O_DONO: "Só o dono do clube pode bloquear horários.",
};

function daquiA(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Fecha um horário que se repete toda semana — aula fixa, manutenção,
// horário que o clube não vende. Antes disso o clube bloqueava um por um.
export function BloqueioRecorrente({
  quadras,
  aoConcluir,
}: {
  quadras: { id: string; nome: string }[];
  aoConcluir: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [quadraId, setQuadraId] = useState(quadras[0]?.id ?? "");
  const [diaSemana, setDiaSemana] = useState(2);
  const [hora, setHora] = useState("08:00");
  const [duracao, setDuracao] = useState(60);
  const [de, setDe] = useState(() => daquiA(0));
  const [ate, setAte] = useState(() => daquiA(90));
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    criados: number;
    pulados: number;
  } | null>(null);

  async function criar() {
    setSalvando(true);
    setErro(null);
    setResultado(null);

    const supabase = criarClienteNavegador();
    const { data, error } = await supabase.rpc("bloquear_recorrente", {
      p_quadra_id: quadraId,
      p_dia_semana: diaSemana,
      p_hora: hora,
      p_duracao_min: duracao,
      p_de: de,
      p_ate: ate,
      p_motivo: motivo || null,
    });
    setSalvando(false);

    if (error) {
      const chave = Object.keys(ERROS).find((k) => error.message.includes(k));
      setErro(chave ? ERROS[chave] : "Não conseguimos criar os bloqueios.");
      return;
    }

    const r = data as { criados: number; pulados: number };
    setResultado(r);
    posthog.capture("bloqueio_recorrente_criado", r);
    aoConcluir();
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 w-full rounded-2xl bg-superficie p-4 text-left shadow ring-1 ring-black/5 transition hover:ring-primaria/40"
      >
        <p className="font-display text-sm font-bold text-tinta">
          🔁 Bloquear um horário que se repete
        </p>
        <p className="mt-0.5 text-xs text-tinta-suave">
          Aula fixa, manutenção semanal, horário que você não vende
        </p>
      </button>
    );
  }

  const campo = "w-full rounded-xl border border-black/10 px-3 py-2.5 text-tinta";

  return (
    <div className="mt-3 rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
      <p className="font-display text-base font-bold text-tinta">
        Bloquear horário que se repete
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-tinta">
          Quadra
          <select
            value={quadraId}
            onChange={(e) => setQuadraId(e.target.value)}
            className={`mt-1 ${campo}`}
          >
            {quadras.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-tinta">
          Toda
          <select
            value={diaSemana}
            onChange={(e) => setDiaSemana(Number(e.target.value))}
            className={`mt-1 ${campo}`}
          >
            {DIAS.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.rotulo}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3">
          <label className="flex-1 text-sm font-medium text-tinta">
            A partir das
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className={`mt-1 ${campo}`}
            />
          </label>
          <label className="flex-1 text-sm font-medium text-tinta">
            Por
            <select
              value={duracao}
              onChange={(e) => setDuracao(Number(e.target.value))}
              className={`mt-1 ${campo}`}
            >
              <option value={60}>1 hora</option>
              <option value={90}>1h30</option>
              <option value={120}>2 horas</option>
              <option value={180}>3 horas</option>
            </select>
          </label>
        </div>

        <div className="flex gap-3">
          <label className="flex-1 text-sm font-medium text-tinta">
            De
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className={`mt-1 ${campo}`}
            />
          </label>
          <label className="flex-1 text-sm font-medium text-tinta">
            Até
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className={`mt-1 ${campo}`}
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-tinta">
          Motivo <span className="text-tinta-suave">(opcional)</span>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: aula do professor João"
            className={`mt-1 ${campo}`}
          />
        </label>
      </div>

      {erro && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      {resultado && (
        <div className="mt-3 rounded-xl bg-primaria/10 p-3 text-sm">
          <p className="font-bold text-primaria">
            {resultado.criados} {resultado.criados === 1 ? "horário" : "horários"}{" "}
            bloqueado{resultado.criados === 1 ? "" : "s"} ✓
          </p>
          {/* Pular não é erro: é o clube saber quais datas ficaram de fora
              porque já tinham jogo marcado. Omitir isso faria o clube
              acreditar que a quadra está fechada quando não está. */}
          {resultado.pulados > 0 && (
            <p className="mt-1 text-tinta-suave">
              {resultado.pulados}{" "}
              {resultado.pulados === 1 ? "data ficou" : "datas ficaram"} de
              fora porque já {resultado.pulados === 1 ? "tinha" : "tinham"}{" "}
              reserva. Elas continuam valendo.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setErro(null);
            setResultado(null);
          }}
          className="flex-1 rounded-xl bg-fundo px-4 py-3 font-display font-bold text-tinta-suave"
        >
          Fechar
        </button>
        <button
          type="button"
          disabled={salvando || !quadraId}
          onClick={criar}
          className="flex-1 rounded-xl bg-primaria px-4 py-3 font-display font-bold text-white disabled:opacity-40"
        >
          {salvando ? "Bloqueando…" : "Bloquear"}
        </button>
      </div>
    </div>
  );
}
