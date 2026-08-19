"use client";

import { useCallback, useEffect, useState } from "react";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

type Relatorio = {
  de: string;
  ate: string;
  faturamento_centavos: number;
  reservas: number;
  por_origem: Record<string, number>;
  horas_abertas: number;
  horas_vendidas: number;
  horas_bloqueadas: number;
  ocupacao_percentual: number;
  mais_ociosos: { dia: string; hora: number; vendas: number }[];
};

const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
];

const NOME_ORIGEM: Record<string, string> = {
  app: "Pelo app",
  balcao: "No balcão",
};

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function Relatorios({ clubeId }: { clubeId: string }) {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const ate = new Date();
    const de = new Date();
    de.setDate(de.getDate() - dias);

    const supabase = criarClienteNavegador();
    const { data, error } = await supabase.rpc("relatorio_do_clube", {
      p_clube_id: clubeId,
      p_de: dataISO(de),
      p_ate: dataISO(ate),
    });

    setCarregando(false);
    if (error) {
      setErro("Não conseguimos montar o relatório agora.");
      return;
    }
    setDados(data as Relatorio);
    posthog.capture("relatorio_clube_visto", { dias });
  }, [clubeId, dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div>
      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.dias}
            type="button"
            onClick={() => setDias(p.dias)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
              dias === p.dias
                ? "bg-primaria text-white"
                : "bg-superficie text-tinta-suave ring-1 ring-black/5"
            }`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      {erro && (
        <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {erro}
        </p>
      )}

      {carregando && (
        <p className="mt-6 text-sm text-tinta-suave">Somando…</p>
      )}

      {dados && !carregando && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
              <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">
                Faturamento
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold text-primaria">
                {reais(dados.faturamento_centavos)}
              </p>
              <p className="mt-1 text-xs text-tinta-suave">
                {dados.reservas}{" "}
                {dados.reservas === 1 ? "reserva" : "reservas"}
              </p>
            </div>

            <div className="rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
              <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">
                Ocupação
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold text-tinta">
                {dados.ocupacao_percentual}%
              </p>
              <p className="mt-1 text-xs text-tinta-suave">
                {dados.horas_vendidas}h vendidas
              </p>
            </div>
          </div>

          {/* O leitor precisa saber sobre o QUE a porcentagem foi calculada,
              senão "60%" não quer dizer nada. */}
          <div className="rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
            <p className="font-display text-sm font-bold text-tinta">
              Como a ocupação foi calculada
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Horas abertas</dt>
                <dd className="font-medium text-tinta">
                  {dados.horas_abertas}h
                </dd>
              </div>
              {dados.horas_bloqueadas > 0 && (
                <div className="flex justify-between">
                  <dt className="text-tinta-suave">− Bloqueadas</dt>
                  <dd className="font-medium text-tinta">
                    {dados.horas_bloqueadas}h
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-black/5 pt-1.5">
                <dt className="text-tinta-suave">Vendidas</dt>
                <dd className="font-medium text-tinta">
                  {dados.horas_vendidas}h
                </dd>
              </div>
            </dl>
            {dados.horas_bloqueadas > 0 && (
              <p className="mt-3 text-xs text-tinta-suave">
                Horário bloqueado sai da conta: a quadra não estava à venda,
                então não conta como vendida nem como vaga perdida.
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
            <p className="font-display text-sm font-bold text-tinta">
              De onde vieram as reservas
            </p>
            {Object.keys(dados.por_origem).length === 0 ? (
              <p className="mt-2 text-sm text-tinta-suave">
                Nenhuma reserva no período.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {Object.entries(dados.por_origem).map(([origem, qtd]) => {
                  const total = Object.values(dados.por_origem).reduce(
                    (a, b) => a + b,
                    0
                  );
                  const pct = Math.round((qtd / total) * 100);
                  return (
                    <li key={origem}>
                      <div className="flex justify-between text-sm">
                        <span className="text-tinta">
                          {NOME_ORIGEM[origem] ?? origem}
                        </span>
                        <span className="font-medium text-tinta-suave">
                          {qtd} · {pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-fundo">
                        <div
                          className="h-full rounded-full bg-primaria"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
            <p className="font-display text-sm font-bold text-tinta">
              Horários que mais ficam vazios
            </p>
            <p className="mt-1 text-xs text-tinta-suave">
              Candidatos a promoção. Na agenda do dia, toque num horário livre
              e use &quot;Avisar&quot;.
            </p>
            {dados.mais_ociosos.length === 0 ? (
              <p className="mt-2 text-sm text-tinta-suave">
                Ainda não há dados suficientes.
              </p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {dados.mais_ociosos.map((o) => (
                  <li
                    key={`${o.dia}-${o.hora}`}
                    className="rounded-full bg-fundo px-3 py-1.5 text-xs font-medium text-tinta-suave"
                  >
                    {o.dia} · {String(o.hora).padStart(2, "0")}h
                    {o.vendas > 0 && (
                      <span className="text-tinta-suave/60">
                        {" "}
                        ({o.vendas})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
