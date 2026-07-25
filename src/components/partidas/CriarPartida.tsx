"use client";

import { useMemo, useState } from "react";
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
import { ROTULO_CATEGORIA } from "@/lib/partidas";

type Quadra = {
  id: string;
  nome: string;
  esporte: string;
  tipo: string;
  coberta: boolean;
  quadra_precos: FaixaPreco[];
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

export function CriarPartida({
  quadras,
  categoriaJogador,
  sexoJogador,
}: {
  quadras: Quadra[];
  categoriaJogador: number;
  sexoJogador: string;
}) {
  const router = useRouter();

  // Passo 1: horário. Passo 2: regras da partida.
  const [passo, setPasso] = useState<1 | 2>(1);
  const [quadraId, setQuadraId] = useState(quadras[0]?.id ?? "");
  const [dia, setDia] = useState(() => dataISO(new Date()));
  const [duracao, setDuracao] = useState(90);
  const [ocupados, setOcupados] = useState<PeriodoOcupado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [horario, setHorario] = useState<Horario | null>(null);

  // Regras da partida (pré-preenchidas com o perfil do organizador).
  const [catMin, setCatMin] = useState(Math.max(1, categoriaJogador - 1));
  const [catMax, setCatMax] = useState(Math.min(7, categoriaJogador + 1));
  const [competitiva, setCompetitiva] = useState(true);
  const [sexoJogo, setSexoJogo] = useState(sexoJogador);
  const [maxJogadores, setMaxJogadores] = useState(4);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const quadra = quadras.find((q) => q.id === quadraId) ?? quadras[0];

  async function carregarHorarios(quadraSel: string, diaSel: string) {
    setCarregando(true);
    const supabase = criarClienteNavegador();
    const { data } = await supabase
      .from("agenda_publica")
      .select("inicio, fim")
      .eq("quadra_id", quadraSel)
      .lt("inicio", `${diaSel}T23:59:59`)
      .gt("fim", `${diaSel}T00:00:00`);
    setOcupados((data as PeriodoOcupado[]) ?? []);
    setCarregando(false);
  }

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

  // Competitiva exige exatamente 4 jogadores (regra nº 5).
  function escolherCompetitiva(valor: boolean) {
    setCompetitiva(valor);
    if (valor) setMaxJogadores(4);
  }

  async function criar() {
    if (!horario || !quadra) return;
    if (catMax < catMin) {
      setErro("A faixa de categoria está invertida.");
      return;
    }
    setErro(null);
    setCriando(true);

    const supabase = criarClienteNavegador();
    const { data, error } = await supabase.rpc("criar_partida", {
      p_quadra_id: quadra.id,
      p_inicio: horario.inicio.toISOString(),
      p_fim: horario.fim.toISOString(),
      p_categoria_min: catMin,
      p_categoria_max: catMax,
      p_competitiva: competitiva,
      p_sexo_jogo: sexoJogo,
      p_max_jogadores: maxJogadores,
    });
    setCriando(false);

    if (error) {
      console.error("Erro ao criar partida:", error.message);
      if (error.code === "23P01" || error.message.includes("sem_overbooking")) {
        setErro("Esse horário acabou de ser reservado. Escolha outro.");
        setPasso(1);
        carregarHorarios(quadra.id, dia);
      } else if (error.message.includes("COMPETITIVA_SO_COM_4")) {
        setErro("Partida competitiva é só com 4 jogadores.");
      } else if (error.message.includes("ORGANIZADOR_INCOMPATIVEL")) {
        setErro("Sua categoria ou sexo não cabem nas regras que você escolheu.");
      } else {
        setErro("Não conseguimos criar a partida. Tente de novo.");
      }
      return;
    }

    posthog.capture("partida_criada", {
      competitiva,
      sexo_jogo: sexoJogo,
      max_jogadores: maxJogadores,
      categoria_min: catMin,
      categoria_max: catMax,
    });
    router.push(`/app/partidas/${data}`);
  }

  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-bold transition ${
      ativo
        ? "bg-primaria text-white"
        : "bg-superficie text-tinta ring-1 ring-black/10 hover:ring-primaria/40"
    }`;

  const hoje = new Date();
  const amanha = new Date(hoje.getTime() + 24 * 60 * 60_000);

  // ---------- Passo 1: escolher o horário ----------
  if (passo === 1) {
    return (
      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDia(dataISO(hoje));
              carregarHorarios(quadraId, dataISO(hoje));
            }}
            className={chip(dia === dataISO(hoje))}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => {
              setDia(dataISO(amanha));
              carregarHorarios(quadraId, dataISO(amanha));
            }}
            className={chip(dia === dataISO(amanha))}
          >
            Amanhã
          </button>
          <input
            type="date"
            value={dia}
            min={dataISO(hoje)}
            onChange={(e) => {
              if (!e.target.value) return;
              setDia(e.target.value);
              carregarHorarios(quadraId, e.target.value);
            }}
            className="rounded-full bg-superficie px-3 py-1.5 text-sm font-bold text-tinta ring-1 ring-black/10 focus:outline-none focus:ring-primaria"
          />
        </div>

        {quadras.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {quadras.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setQuadraId(q.id);
                  carregarHorarios(q.id, dia);
                }}
                className={chip(q.id === quadraId)}
              >
                {q.nome}
              </button>
            ))}
          </div>
        )}

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

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">
            Escolha o horário · {formatarDiaLongo(new Date(`${dia}T12:00:00`))}
          </p>
          {carregando ? (
            <p className="mt-3 text-sm text-tinta-suave">Carregando...</p>
          ) : livres.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-superficie p-4 text-sm text-tinta-suave shadow ring-1 ring-black/5">
              Nenhum horário livre nesse dia com essa duração. Tente outro dia ou
              duração menor.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {livres.map((h) => (
                <button
                  key={h.inicio.getTime()}
                  type="button"
                  onClick={() => {
                    setHorario(h);
                    setPasso(2);
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
        </div>
      </div>
    );
  }

  // ---------- Passo 2: regras da partida ----------
  return (
    <div className="mt-5">
      {horario && (
        <div className="rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5">
          <p className="text-sm text-tinta-suave">
            {quadra?.nome} ·{" "}
            <span className="capitalize">{formatarDiaLongo(horario.inicio)}</span>
          </p>
          <p className="font-display font-bold text-tinta">
            {formatarHora(horario.inicio)} às {formatarHora(horario.fim)} ·{" "}
            {formatarReais(horario.precoCentavos)} a quadra
          </p>
          <button
            type="button"
            onClick={() => setPasso(1)}
            className="mt-1 text-sm font-medium text-primaria hover:underline"
          >
            Trocar horário
          </button>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-superficie p-5 shadow ring-1 ring-black/5">
        <p className="text-sm font-medium text-tinta">Tipo de jogo</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => escolherCompetitiva(true)}
            className={chip(competitiva)}
          >
            Competitiva (vale rating)
          </button>
          <button
            type="button"
            onClick={() => escolherCompetitiva(false)}
            className={chip(!competitiva)}
          >
            Amistosa
          </button>
        </div>

        <p className="mt-4 text-sm font-medium text-tinta">Sexo do jogo</p>
        <div className="mt-2 flex gap-2">
          {[
            { id: "masculino", rotulo: "Masculino" },
            { id: "feminino", rotulo: "Feminino" },
            { id: "mista", rotulo: "Mista" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSexoJogo(s.id)}
              className={chip(sexoJogo === s.id)}
            >
              {s.rotulo}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm font-medium text-tinta">
          Quantos jogadores no total?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMaxJogadores(n)}
              disabled={competitiva && n !== 4}
              className={`${chip(maxJogadores === n)} disabled:opacity-40`}
            >
              {n}
            </button>
          ))}
        </div>
        {competitiva ? (
          <p className="mt-1 text-xs text-tinta-suave">
            Partida competitiva é sempre 4 jogadores — é a que conta para o
            rating.
          </p>
        ) : (
          <p className="mt-1 text-xs text-tinta-suave">
            5 ou mais entram no modo revezamento: todos jogam e dividem a
            quadra, mas não conta para o rating.
          </p>
        )}

        <p className="mt-4 text-sm font-medium text-tinta">
          Faixa de categoria aceita
        </p>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={catMin}
            onChange={(e) => setCatMin(Number(e.target.value))}
            className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA[c]}
              </option>
            ))}
          </select>
          <span className="text-sm text-tinta-suave">até</span>
          <select
            value={catMax}
            onChange={(e) => setCatMax(Number(e.target.value))}
            className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-xs text-tinta-suave">
          Lembre: 1ª é a mais forte, 7ª a mais iniciante. Você é{" "}
          {ROTULO_CATEGORIA[categoriaJogador]}.
        </p>

        {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={criar}
          disabled={criando}
          className="mt-5 w-full rounded-full bg-destaque px-6 py-3 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
        >
          {criando ? "Criando..." : "Criar partida"}
        </button>
      </div>
    </div>
  );
}
