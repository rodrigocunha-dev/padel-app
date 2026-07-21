"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { localPorCoordenadas } from "@/lib/geo";
import {
  distanciaKm,
  menorPrecoCentavos,
  quadraLivreAgora,
  quadraLivreNoPeriodo,
  formatarReais,
  type ClubeDescoberta,
  type Ocupacao,
} from "@/lib/descoberta";

const MapaClubes = dynamic(() => import("@/components/mapa/MapaClubes"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-sm text-tinta-suave">
      Carregando mapa...
    </div>
  ),
});

const ROTULO_ESPORTE: Record<string, string> = {
  padel: "Padel",
  beach_tennis: "Beach Tennis",
  tenis: "Tênis",
  futebol_society: "Futebol Society",
};

const ROTULO_TIPO: Record<string, string> = {
  vidro: "Vidro",
  alvenaria: "Alvenaria",
  areia: "Areia",
  saibro: "Saibro",
  grama: "Grama",
};

const HORAS_DE = Array.from({ length: 18 }, (_, i) => i + 6); // 06..23
const HORAS_ATE = Array.from({ length: 18 }, (_, i) => i + 7); // 07..24

function alternarNaLista(lista: string[], valor: string): string[] {
  return lista.includes(valor)
    ? lista.filter((v) => v !== valor)
    : [...lista, valor];
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Janela de busca a partir da data + horas escolhidas ("24" = fim do dia)
function montarJanela(data: string, deHora: number, ateHora: number) {
  const inicio = new Date(`${data}T${String(deHora).padStart(2, "0")}:00:00`);
  const fim = new Date(`${data}T00:00:00`);
  if (ateHora >= 24) fim.setDate(fim.getDate() + 1);
  else fim.setHours(ateHora);
  return { inicio, fim };
}

type Props = { clubes: ClubeDescoberta[]; minhaCidade: string | null };

export function Descobrir({ clubes, minhaCidade }: Props) {
  const [esportesSel, setEsportesSel] = useState<string[]>([]);
  const [tiposSel, setTiposSel] = useState<string[]>([]);
  const [soCobertas, setSoCobertas] = useState(false);
  const [precoMax, setPrecoMax] = useState("");
  const [distanciaMax, setDistanciaMax] = useState(""); // km
  const [cidadeSel, setCidadeSel] = useState(""); // "" | "atual" | nome
  const [cidadeAtual, setCidadeAtual] = useState<string | null>(null);
  const [minhaPosicao, setMinhaPosicao] = useState<[number, number] | null>(
    null
  );
  const [jogarAgora, setJogarAgora] = useState(false);
  const [ocupacoes, setOcupacoes] = useState<Ocupacao[] | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [vista, setVista] = useState<"mapa" | "lista">("mapa");

  // Busca por período futuro (viagem, planejamento)
  const [dataSel, setDataSel] = useState("");
  const [deHora, setDeHora] = useState(6);
  const [ateHora, setAteHora] = useState(24);
  const [somenteLivres, setSomenteLivres] = useState(false);
  const [ocupacoesJanela, setOcupacoesJanela] = useState<Ocupacao[] | null>(
    null
  );

  useEffect(() => {
    posthog.capture("mapa_aberto", { clubes_no_mapa: clubes.length });
    navigator.geolocation?.getCurrentPosition(
      async (p) => {
        setMinhaPosicao([p.coords.latitude, p.coords.longitude]);
        // Descobre a cidade em que a pessoa está (para o filtro "onde estou")
        try {
          const local = await localPorCoordenadas(
            p.coords.latitude,
            p.coords.longitude
          );
          if (local?.cidade) setCidadeAtual(local.cidade);
        } catch {
          // Sem reverse geocode: cai no plano B (cidade do perfil)
        }
      },
      () => setMinhaPosicao(null),
      { timeout: 5000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const esportesDisponiveis = useMemo(() => {
    const conjunto = new Set<string>();
    clubes.forEach((c) => c.quadras.forEach((q) => conjunto.add(q.esporte)));
    return [...conjunto];
  }, [clubes]);

  const tiposDisponiveis = useMemo(() => {
    const conjunto = new Set<string>();
    clubes.forEach((c) =>
      c.quadras.forEach((q) => {
        if (esportesSel.length === 0 || esportesSel.includes(q.esporte)) {
          conjunto.add(q.tipo);
        }
      })
    );
    return [...conjunto];
  }, [clubes, esportesSel]);

  const cidadesDisponiveis = useMemo(() => {
    const conjunto = new Set<string>();
    clubes.forEach((c) => conjunto.add(c.cidade.trim()));
    return [...conjunto].sort();
  }, [clubes]);

  const tiposSelValidos = useMemo(
    () => tiposSel.filter((t) => tiposDisponiveis.includes(t)),
    [tiposSel, tiposDisponiveis]
  );

  const todasQuadrasIds = useMemo(
    () => clubes.flatMap((c) => c.quadras.map((q) => q.id)),
    [clubes]
  );

  async function alternarJogarAgora() {
    const ligar = !jogarAgora;
    setJogarAgora(ligar);
    if (ligar && ocupacoes === null) {
      const supabase = criarClienteNavegador();
      const agora = new Date();
      const daqui3h = new Date(agora.getTime() + 3 * 60 * 60 * 1000);
      const { data } = await supabase.rpc("horarios_ocupados", {
        p_quadras: todasQuadrasIds,
        p_de: agora.toISOString(),
        p_ate: daqui3h.toISOString(),
      });
      setOcupacoes((data as Ocupacao[]) ?? []);
      posthog.capture("jogar_agora_ativado");
    }
  }

  // Busca os horários ocupados da janela escolhida (data + horas).
  async function buscarOcupacoesJanela(
    data: string,
    de: number,
    ate: number
  ) {
    if (!data) return;
    const { inicio, fim } = montarJanela(data, de, ate);
    const supabase = criarClienteNavegador();
    const { data: resultado } = await supabase.rpc("horarios_ocupados", {
      p_quadras: todasQuadrasIds,
      p_de: inicio.toISOString(),
      p_ate: fim.toISOString(),
    });
    setOcupacoesJanela((resultado as Ocupacao[]) ?? []);
  }

  function aoMudarPeriodo(
    novaData: string,
    novoDe: number,
    novoAte: number,
    novoSomenteLivres: boolean
  ) {
    setDataSel(novaData);
    setDeHora(novoDe);
    setAteHora(novoAte);
    setSomenteLivres(novoSomenteLivres);
    if (novoSomenteLivres && novaData) {
      buscarOcupacoesJanela(novaData, novoDe, novoAte);
      posthog.capture("mapa_filtro_usado", { filtro: "disponibilidade" });
    }
  }

  const clubesFiltrados = useMemo(() => {
    return clubes.filter((clube) => {
      let quadras = clube.quadras;
      if (esportesSel.length > 0)
        quadras = quadras.filter((q) => esportesSel.includes(q.esporte));
      if (tiposSelValidos.length > 0)
        quadras = quadras.filter((q) => tiposSelValidos.includes(q.tipo));
      if (soCobertas) quadras = quadras.filter((q) => q.coberta);
      if (quadras.length === 0) return false;

      if (precoMax) {
        const menor = menorPrecoCentavos(quadras);
        if (menor === null || menor > parseFloat(precoMax) * 100) return false;
      }

      if (cidadeSel) {
        const alvo =
          cidadeSel === "atual" ? (cidadeAtual ?? minhaCidade) : cidadeSel;
        if (
          !alvo ||
          clube.cidade.trim().toLowerCase() !== alvo.trim().toLowerCase()
        )
          return false;
      }

      if (distanciaMax && minhaPosicao) {
        const d = distanciaKm(
          minhaPosicao[0],
          minhaPosicao[1],
          clube.latitude,
          clube.longitude
        );
        if (d > parseFloat(distanciaMax)) return false;
      }

      if (jogarAgora) {
        const livre = quadras.some((q) => quadraLivreAgora(q, ocupacoes ?? []));
        if (!livre) return false;
      }

      if (somenteLivres && dataSel) {
        const { inicio, fim } = montarJanela(dataSel, deHora, ateHora);
        const livre = quadras.some((q) =>
          quadraLivreNoPeriodo(q, ocupacoesJanela ?? [], inicio, fim)
        );
        if (!livre) return false;
      }

      return true;
    });
  }, [
    clubes,
    esportesSel,
    tiposSelValidos,
    soCobertas,
    precoMax,
    cidadeSel,
    cidadeAtual,
    minhaCidade,
    distanciaMax,
    minhaPosicao,
    jogarAgora,
    ocupacoes,
    somenteLivres,
    dataSel,
    deHora,
    ateHora,
    ocupacoesJanela,
  ]);

  const filtrosAtivos =
    esportesSel.length +
    tiposSelValidos.length +
    (soCobertas ? 1 : 0) +
    (precoMax ? 1 : 0) +
    (cidadeSel ? 1 : 0) +
    (distanciaMax ? 1 : 0) +
    (somenteLivres && dataSel ? 1 : 0);

  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-bold transition ${
      ativo
        ? "bg-primaria text-white"
        : "bg-white text-tinta ring-1 ring-black/10 hover:ring-primaria/40"
    }`;

  const estiloSelect =
    "rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-tinta focus:border-primaria focus:outline-none";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          type="button"
          onClick={alternarJogarAgora}
          title="Mostrar só clubes com quadra livre nas próximas 3 horas"
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${
            jogarAgora
              ? "bg-destaque text-destaque-tinta"
              : "bg-superficie text-tinta ring-1 ring-black/10"
          }`}
        >
          ⚡ Jogar agora
        </button>
        <button
          type="button"
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          className="rounded-full bg-superficie px-4 py-2 text-sm font-bold text-tinta ring-1 ring-black/10"
        >
          Filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ""}
        </button>

        <div className="ml-auto flex items-center gap-1 rounded-full bg-superficie p-1 ring-1 ring-black/10">
          <button
            type="button"
            onClick={() => setVista("mapa")}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              vista === "mapa" ? "bg-primaria text-white" : "text-tinta-suave"
            }`}
          >
            🗺️ Mapa
          </button>
          <button
            type="button"
            onClick={() => {
              setVista("lista");
              posthog.capture("mapa_vista_lista");
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              vista === "lista" ? "bg-primaria text-white" : "text-tinta-suave"
            }`}
          >
            ☰ Lista
          </button>
        </div>
      </div>

      {mostrarFiltros && (
        <div className="mx-4 mb-3 rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5">
          <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">
            Esportes
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {esportesDisponiveis.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setEsportesSel(alternarNaLista(esportesSel, e));
                  posthog.capture("mapa_filtro_usado", { filtro: "esporte" });
                }}
                className={chip(esportesSel.includes(e))}
              >
                {ROTULO_ESPORTE[e] ?? e}
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-tinta-suave">
            Tipo de quadra
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tiposDisponiveis.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTiposSel(alternarNaLista(tiposSel, t));
                  posthog.capture("mapa_filtro_usado", { filtro: "tipo" });
                }}
                className={chip(tiposSelValidos.includes(t))}
              >
                {ROTULO_TIPO[t] ?? t}
              </button>
            ))}
            {tiposDisponiveis.length === 0 && (
              <span className="text-xs text-tinta-suave">
                Nenhum tipo de quadra para os esportes escolhidos.
              </span>
            )}
          </div>

          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-tinta-suave">
            Onde
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <select
              value={cidadeSel}
              onChange={(e) => {
                setCidadeSel(e.target.value);
                posthog.capture("mapa_filtro_usado", { filtro: "cidade" });
              }}
              className={estiloSelect}
            >
              <option value="">Qualquer cidade</option>
              {(cidadeAtual ?? minhaCidade) && (
                <option value="atual">
                  📍 Onde estou{cidadeAtual ? ` (${cidadeAtual})` : ""}
                </option>
              )}
              {cidadesDisponiveis.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={distanciaMax}
              onChange={(e) => {
                setDistanciaMax(e.target.value);
                posthog.capture("mapa_filtro_usado", { filtro: "distancia" });
              }}
              disabled={!minhaPosicao}
              className={estiloSelect}
            >
              <option value="">Qualquer distância</option>
              <option value="1">Até 1 km</option>
              <option value="2">Até 2 km</option>
              <option value="5">Até 5 km</option>
              <option value="10">Até 10 km</option>
              <option value="20">Até 20 km</option>
              <option value="50">Até 50 km</option>
            </select>
            {!minhaPosicao && (
              <span className="text-xs text-tinta-suave">
                Permita a localização para usar distância e “onde estou”.
              </span>
            )}
          </div>

          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-tinta-suave">
            Quando você quer jogar?
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dataSel}
              min={hojeISO()}
              onChange={(e) =>
                aoMudarPeriodo(e.target.value, deHora, ateHora, somenteLivres)
              }
              className={estiloSelect}
            />
            <label className="flex items-center gap-1.5 text-sm text-tinta">
              das
              <select
                value={deHora}
                onChange={(e) => {
                  const de = Number(e.target.value);
                  aoMudarPeriodo(
                    dataSel,
                    de,
                    ateHora > de ? ateHora : de + 1,
                    somenteLivres
                  );
                }}
                className={estiloSelect}
              >
                {HORAS_DE.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}h
                  </option>
                ))}
              </select>
              às
              <select
                value={ateHora}
                onChange={(e) =>
                  aoMudarPeriodo(
                    dataSel,
                    deHora,
                    Number(e.target.value),
                    somenteLivres
                  )
                }
                className={estiloSelect}
              >
                {HORAS_ATE.filter((h) => h > deHora).map((h) => (
                  <option key={h} value={h}>
                    {h >= 24 ? "24h" : `${String(h).padStart(2, "0")}h`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-sm font-medium text-tinta">
              <input
                type="checkbox"
                checked={somenteLivres}
                onChange={(e) =>
                  aoMudarPeriodo(
                    dataSel || hojeISO(),
                    deHora,
                    ateHora,
                    e.target.checked
                  )
                }
              />
              Só clubes com horário livre nesse período
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-tinta">
              <input
                type="checkbox"
                checked={soCobertas}
                onChange={(e) => setSoCobertas(e.target.checked)}
              />
              Só cobertas
            </label>
            <label className="flex items-center gap-1.5 text-sm text-tinta">
              até R$
              <input
                type="number"
                value={precoMax}
                onChange={(e) => setPrecoMax(e.target.value)}
                placeholder="150"
                className="w-16 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm"
              />
              /h
            </label>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-xs text-tinta-suave">
          {clubesFiltrados.length}{" "}
          {clubesFiltrados.length === 1
            ? "clube encontrado"
            : "clubes encontrados"}
        </span>
      </div>

      {vista === "mapa" ? (
        <div className="relative flex-1" style={{ minHeight: "60vh" }}>
          <MapaClubes clubes={clubesFiltrados} minhaPosicao={minhaPosicao} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pb-8">
          {clubesFiltrados.length === 0 && (
            <p className="text-sm text-tinta-suave">
              Nenhum clube com esses filtros. Tente ampliar a busca.
            </p>
          )}
          {clubesFiltrados.map((clube) => {
            const menor = menorPrecoCentavos(clube.quadras);
            const dist = minhaPosicao
              ? distanciaKm(
                  minhaPosicao[0],
                  minhaPosicao[1],
                  clube.latitude,
                  clube.longitude
                )
              : null;
            const esportes = [...new Set(clube.quadras.map((q) => q.esporte))];
            return (
              <Link
                key={clube.id}
                href={`/app/clubes/${clube.id}`}
                className="rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5 transition hover:ring-primaria/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-bold text-tinta">
                      {clube.nome}
                    </p>
                    <p className="mt-0.5 text-sm text-tinta-suave">
                      {clube.cidade}
                      {dist !== null ? ` · ${dist.toFixed(1)} km` : ""} ·{" "}
                      {clube.quadras.length}{" "}
                      {clube.quadras.length === 1 ? "quadra" : "quadras"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {esportes.map((e) => (
                        <span
                          key={e}
                          className="rounded-full bg-primaria/10 px-2 py-0.5 text-[11px] font-bold text-primaria"
                        >
                          {ROTULO_ESPORTE[e] ?? e}
                        </span>
                      ))}
                    </div>
                  </div>
                  {menor !== null && (
                    <span className="shrink-0 rounded-full bg-primaria px-3 py-1 text-sm font-bold text-white">
                      {formatarReais(menor)}/h
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
