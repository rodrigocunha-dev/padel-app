"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  horasCapacidade,
  horasReservadas,
  ocupacaoDoDia,
  type QuadraComFaixas,
  type ReservaPeriodo,
} from "@/lib/ocupacao";

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Cor do "calor" da ocupação: cinza (sem capacidade), claro → escuro.
function corOcupacao(percentual: number | null): string {
  if (percentual === null) return "rgba(0,0,0,0.04)";
  const alpha = 0.12 + (percentual / 100) * 0.78;
  return `color-mix(in srgb, var(--cor-primaria) ${Math.round(alpha * 100)}%, white)`;
}

function textoContraste(percentual: number | null): string {
  return percentual !== null && percentual > 55 ? "#fff" : "inherit";
}

type Visao = "semana" | "mes";

export function AgendaOcupacao({
  quadras,
  visao,
  dataBase,
}: {
  quadras: QuadraComFaixas[];
  visao: Visao;
  dataBase: string; // YYYY-MM-DD
}) {
  const [reservas, setReservas] = useState<ReservaPeriodo[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Período visível: semana (seg–dom) ou mês inteiro da dataBase.
  const periodo = useMemo(() => {
    const base = new Date(`${dataBase}T12:00:00`);
    let dias: Date[];
    if (visao === "semana") {
      const desloc = (base.getDay() + 6) % 7; // segunda = 0
      const inicioSemana = new Date(base);
      inicioSemana.setDate(base.getDate() - desloc);
      dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(inicioSemana);
        d.setDate(inicioSemana.getDate() + i);
        return d;
      });
    } else {
      const diasNoMes = new Date(
        base.getFullYear(),
        base.getMonth() + 1,
        0
      ).getDate();
      dias = Array.from(
        { length: diasNoMes },
        (_, i) => new Date(base.getFullYear(), base.getMonth(), i + 1)
      );
    }
    const fimExclusivo = new Date(dias[dias.length - 1]);
    fimExclusivo.setDate(fimExclusivo.getDate() + 1);
    return { dias, inicioISO: dataISO(dias[0]), fimISO: dataISO(fimExclusivo) };
  }, [visao, dataBase]);

  const { dias } = periodo;

  const carregar = useCallback(async () => {
    const supabase = criarClienteNavegador();
    const { data } = await supabase
      .from("reservas")
      .select("quadra_id, inicio, fim")
      .in(
        "quadra_id",
        quadras.map((q) => q.id)
      )
      .eq("status", "confirmada")
      .lt("inicio", `${periodo.fimISO}T00:00:00`)
      .gt("fim", `${periodo.inicioISO}T00:00:00`);
    setReservas((data as ReservaPeriodo[]) ?? []);
    setCarregando(false);
  }, [quadras, periodo]);

  useEffect(() => {
    // Busca de dados ao trocar período — setState pós-await, sem cascata.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  if (visao === "semana") {
    return (
      <div className="mt-4 overflow-x-auto rounded-2xl bg-superficie p-4 shadow-lg ring-1 ring-black/5">
        <table className="w-full min-w-[36rem] border-separate border-spacing-1 text-center">
          <thead>
            <tr>
              <th className="text-left text-sm font-bold text-tinta">Quadra</th>
              {dias.map((d) => (
                <th key={d.getTime()} className="pb-1 text-xs font-bold text-tinta">
                  {DIAS_CURTOS[d.getDay()]}
                  <br />
                  <span className="font-normal text-tinta-suave">
                    {d.getDate()}/{d.getMonth() + 1}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quadras.map((q) => (
              <tr key={q.id}>
                <td className="pr-2 text-left text-sm font-medium text-tinta">
                  {q.nome}
                </td>
                {dias.map((d) => {
                  const cap = horasCapacidade(q, d.getDay());
                  const res = horasReservadas(q.id, d, reservas);
                  const pct = cap > 0 ? Math.min(100, (res / cap) * 100) : null;
                  return (
                    <td key={d.getTime()}>
                      <div
                        className="rounded-lg px-1 py-2 text-xs font-bold"
                        style={{
                          background: corOcupacao(pct),
                          color: textoContraste(pct),
                        }}
                        title={
                          pct === null
                            ? "Fechado"
                            : `${res.toFixed(1)}h reservadas de ${cap.toFixed(1)}h`
                        }
                      >
                        {pct === null ? "—" : `${Math.round(pct)}%`}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-tinta-suave">
          {carregando
            ? "Atualizando..."
            : "% do horário de funcionamento já reservado. Quanto mais escuro, mais cheio. “—” = fechado."}
        </p>
      </div>
    );
  }

  // Visão mês: calendário com ocupação agregada de todas as quadras.
  const primeiroDia = dias[0];
  const celulasVazias = (primeiroDia.getDay() + 6) % 7; // alinha na segunda

  return (
    <div className="mt-4 rounded-2xl bg-superficie p-4 shadow-lg ring-1 ring-black/5">
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((r) => (
          <div key={r} className="pb-1 text-xs font-bold text-tinta">
            {r}
          </div>
        ))}
        {Array.from({ length: celulasVazias }).map((_, i) => (
          <div key={`v${i}`} />
        ))}
        {dias.map((d) => {
          const { capacidade, reservado, percentual } = ocupacaoDoDia(
            quadras,
            d,
            reservas
          );
          return (
            <div
              key={d.getTime()}
              className="rounded-lg px-1 py-2"
              style={{
                background: corOcupacao(percentual),
                color: textoContraste(percentual),
              }}
              title={
                percentual === null
                  ? "Fechado"
                  : `${reservado.toFixed(1)}h de ${capacidade.toFixed(1)}h reservadas`
              }
            >
              <div className="text-xs font-bold">{d.getDate()}</div>
              <div className="text-[10px] font-medium">
                {percentual === null ? "—" : `${Math.round(percentual)}%`}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-tinta-suave">
        {carregando
          ? "Atualizando..."
          : "Ocupação de todas as quadras somadas, dia a dia. Ideal para achar horários ociosos."}
      </p>
    </div>
  );
}
