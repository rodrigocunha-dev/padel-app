"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

// Esportes e tipos de piso compatíveis (agenda multiesporte, alma padel)
const ESPORTES: Record<string, { rotulo: string; tipos: string[] }> = {
  padel: { rotulo: "Padel", tipos: ["vidro", "alvenaria"] },
  beach_tennis: { rotulo: "Beach Tennis", tipos: ["areia"] },
  tenis: { rotulo: "Tênis", tipos: ["saibro", "grama"] },
  futebol_society: { rotulo: "Futebol Society", tipos: ["grama"] },
};

const ROTULO_TIPO: Record<string, string> = {
  vidro: "Vidro",
  alvenaria: "Alvenaria",
  areia: "Areia",
  saibro: "Saibro",
  grama: "Grama sintética",
};

// Ordem de exibição seg→dom; valores seguem o banco (0=dom ... 6=sáb)
const DIAS = [
  { valor: 1, rotulo: "Seg" },
  { valor: 2, rotulo: "Ter" },
  { valor: 3, rotulo: "Qua" },
  { valor: 4, rotulo: "Qui" },
  { valor: 5, rotulo: "Sex" },
  { valor: 6, rotulo: "Sáb" },
  { valor: 0, rotulo: "Dom" },
];

type Preco = {
  id: string;
  dias: number[];
  hora_inicio: string;
  hora_fim: string;
  preco_centavos: number;
};

type Quadra = {
  id: string;
  nome: string;
  esporte: string;
  tipo: string;
  coberta: boolean;
  quadra_precos: Preco[];
};

const estiloInput =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta placeholder:text-tinta-suave/60 focus:border-primaria focus:outline-none focus:ring-2 focus:ring-primaria/30";

function formatarReais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarDias(dias: number[]) {
  return DIAS.filter((d) => dias.includes(d.valor))
    .map((d) => d.rotulo)
    .join(", ");
}

export function GerenciarQuadras({
  clubeId,
  quadras,
}: {
  clubeId: string;
  quadras: Quadra[];
}) {
  const router = useRouter();
  const [mostrarFormQuadra, setMostrarFormQuadra] = useState(quadras.length === 0);
  const [esporte, setEsporte] = useState("padel");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [precoAberto, setPrecoAberto] = useState<string | null>(null);

  async function criarQuadra(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const nome = String(dados.get("nome") ?? "").trim();
    const tipo = String(dados.get("tipo") ?? "");
    const coberta = dados.get("coberta") === "sim";

    if (!nome || !tipo) {
      setErro("Preencha nome e tipo da quadra.");
      return;
    }

    setSalvando(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.from("quadras").insert({
      clube_id: clubeId,
      nome,
      esporte,
      tipo,
      coberta,
    });
    setSalvando(false);

    if (error) {
      console.error("Erro ao criar quadra:", error.message);
      setErro("Não conseguimos salvar a quadra. Tente de novo.");
      return;
    }

    posthog.capture("quadra_criada", { esporte, tipo, coberta });
    setMostrarFormQuadra(false);
    router.refresh();
  }

  async function excluirQuadra(quadraId: string) {
    const supabase = criarClienteNavegador();
    const { error } = await supabase.from("quadras").delete().eq("id", quadraId);
    if (!error) router.refresh();
  }

  async function criarPreco(
    evento: FormEvent<HTMLFormElement>,
    quadraId: string
  ) {
    evento.preventDefault();
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const dias = DIAS.filter((d) => dados.get(`dia-${d.valor}`) === "on").map(
      (d) => d.valor
    );
    const horaInicio = String(dados.get("hora_inicio") ?? "");
    const horaFim = String(dados.get("hora_fim") ?? "");
    const precoTexto = String(dados.get("preco") ?? "").replace(",", ".");
    const precoCentavos = Math.round(parseFloat(precoTexto) * 100);

    if (dias.length === 0 || !horaInicio || !horaFim || isNaN(precoCentavos)) {
      setErro("Escolha os dias, o horário e o valor da faixa.");
      return;
    }
    if (horaFim <= horaInicio) {
      setErro("O fim da faixa precisa ser depois do início.");
      return;
    }

    setSalvando(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.from("quadra_precos").insert({
      quadra_id: quadraId,
      dias,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      preco_centavos: precoCentavos,
    });
    setSalvando(false);

    if (error) {
      console.error("Erro ao criar preço:", error.message);
      setErro("Não conseguimos salvar o preço. Tente de novo.");
      return;
    }

    posthog.capture("preco_quadra_criado", { preco_centavos: precoCentavos });
    setPrecoAberto(null);
    router.refresh();
  }

  async function excluirPreco(precoId: string) {
    const supabase = criarClienteNavegador();
    const { error } = await supabase
      .from("quadra_precos")
      .delete()
      .eq("id", precoId);
    if (!error) router.refresh();
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-tinta">
          Suas quadras
        </h2>
        {!mostrarFormQuadra && (
          <button
            type="button"
            onClick={() => setMostrarFormQuadra(true)}
            className="rounded-full bg-primaria px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
          >
            + Adicionar quadra
          </button>
        )}
      </div>

      {quadras.length === 0 && !mostrarFormQuadra && (
        <p className="mt-4 text-sm text-tinta-suave">
          Nenhuma quadra ainda — adicione a primeira.
        </p>
      )}

      {mostrarFormQuadra && (
        <form
          onSubmit={criarQuadra}
          className="mt-4 rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5"
        >
          <h3 className="font-display font-bold text-tinta">Nova quadra</h3>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-tinta">Nome</span>
            <input
              name="nome"
              type="text"
              required
              placeholder="Ex.: Quadra 1"
              className={estiloInput}
            />
          </label>

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-tinta">Esporte</span>
            <select
              name="esporte"
              value={esporte}
              onChange={(e) => setEsporte(e.target.value)}
              className={estiloInput}
            >
              {Object.entries(ESPORTES).map(([valor, e]) => (
                <option key={valor} value={valor}>
                  {e.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-tinta">Tipo</span>
            <select name="tipo" className={estiloInput}>
              {ESPORTES[esporte].tipos.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 flex items-center gap-2 text-sm text-tinta">
            <input type="checkbox" name="coberta" value="sim" />
            Quadra coberta
          </label>

          {erro && (
            <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 rounded-full bg-destaque px-4 py-2.5 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar quadra"}
            </button>
            {quadras.length > 0 && (
              <button
                type="button"
                onClick={() => setMostrarFormQuadra(false)}
                className="rounded-full px-4 py-2.5 text-sm font-medium text-tinta-suave hover:text-tinta"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {quadras.map((quadra) => (
          <div
            key={quadra.id}
            className="rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-tinta">
                  {quadra.nome}
                </h3>
                <p className="mt-0.5 text-sm text-tinta-suave">
                  {ESPORTES[quadra.esporte]?.rotulo ?? quadra.esporte} ·{" "}
                  {ROTULO_TIPO[quadra.tipo] ?? quadra.tipo} ·{" "}
                  {quadra.coberta ? "coberta" : "descoberta"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => excluirQuadra(quadra.id)}
                className="text-xs font-medium text-tinta-suave hover:text-red-600"
              >
                Excluir
              </button>
            </div>

            <div className="mt-3 border-t border-black/5 pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">
                Preços por faixa horária
              </p>
              {quadra.quadra_precos.length === 0 && (
                <p className="mt-1 text-sm text-tinta-suave">
                  Nenhuma faixa cadastrada.
                </p>
              )}
              <ul className="mt-1 flex flex-col gap-1">
                {quadra.quadra_precos.map((preco) => (
                  <li
                    key={preco.id}
                    className="flex items-center justify-between text-sm text-tinta"
                  >
                    <span>
                      {formatarDias(preco.dias)} ·{" "}
                      {preco.hora_inicio.slice(0, 5)}–
                      {preco.hora_fim.slice(0, 5)} ·{" "}
                      <strong>{formatarReais(preco.preco_centavos)}</strong>/h
                    </span>
                    <button
                      type="button"
                      onClick={() => excluirPreco(preco.id)}
                      className="text-xs text-tinta-suave hover:text-red-600"
                    >
                      remover
                    </button>
                  </li>
                ))}
              </ul>

              {precoAberto === quadra.id ? (
                <form
                  onSubmit={(e) => criarPreco(e, quadra.id)}
                  className="mt-3 rounded-xl bg-fundo p-3"
                >
                  <div className="flex flex-wrap gap-2">
                    {DIAS.map((d) => (
                      <label
                        key={d.valor}
                        className="flex items-center gap-1 text-xs font-medium text-tinta"
                      >
                        <input type="checkbox" name={`dia-${d.valor}`} />
                        {d.rotulo}
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs text-tinta-suave">
                      Das
                      <input
                        type="time"
                        name="hora_inicio"
                        required
                        className={estiloInput}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-tinta-suave">
                      Até
                      <input
                        type="time"
                        name="hora_fim"
                        required
                        className={estiloInput}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-tinta-suave">
                      R$/hora
                      <input
                        type="text"
                        name="preco"
                        required
                        inputMode="decimal"
                        placeholder="120,00"
                        className={estiloInput}
                      />
                    </label>
                  </div>
                  {erro && (
                    <p className="mt-2 text-sm font-medium text-red-600">
                      {erro}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="submit"
                      disabled={salvando}
                      className="rounded-full bg-primaria px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                    >
                      Salvar faixa
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrecoAberto(null)}
                      className="text-sm text-tinta-suave hover:text-tinta"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setErro(null);
                    setPrecoAberto(quadra.id);
                  }}
                  className="mt-2 text-sm font-medium text-primaria hover:underline"
                >
                  + Adicionar faixa de preço
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
