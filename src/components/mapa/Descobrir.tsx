"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  distanciaKm,
  menorPrecoCentavos,
  quadraLivreAgora,
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

const ESPORTES = [
  { valor: "", rotulo: "Todos os esportes" },
  { valor: "padel", rotulo: "Padel" },
  { valor: "beach_tennis", rotulo: "Beach Tennis" },
  { valor: "tenis", rotulo: "Tênis" },
  { valor: "futebol_society", rotulo: "Futebol Society" },
];

const TIPOS = [
  { valor: "", rotulo: "Qualquer piso" },
  { valor: "vidro", rotulo: "Vidro" },
  { valor: "alvenaria", rotulo: "Alvenaria" },
  { valor: "areia", rotulo: "Areia" },
  { valor: "saibro", rotulo: "Saibro" },
  { valor: "grama", rotulo: "Grama" },
];

export function Descobrir({ clubes }: { clubes: ClubeDescoberta[] }) {
  const [esporte, setEsporte] = useState("");
  const [tipo, setTipo] = useState("");
  const [soCobertas, setSoCobertas] = useState(false);
  const [precoMax, setPrecoMax] = useState(""); // em reais
  const [distanciaMax, setDistanciaMax] = useState(""); // km
  const [minhaPosicao, setMinhaPosicao] = useState<[number, number] | null>(
    null
  );
  const [jogarAgora, setJogarAgora] = useState(false);
  const [ocupacoes, setOcupacoes] = useState<Ocupacao[] | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  useEffect(() => {
    posthog.capture("mapa_aberto", { clubes_no_mapa: clubes.length });
    navigator.geolocation?.getCurrentPosition(
      (p) => setMinhaPosicao([p.coords.latitude, p.coords.longitude]),
      () => setMinhaPosicao(null),
      { timeout: 5000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Liga o "Jogar agora": busca só horários ocupados (sem dados pessoais)
  async function alternarJogarAgora() {
    const ligar = !jogarAgora;
    setJogarAgora(ligar);
    if (ligar && ocupacoes === null) {
      const supabase = criarClienteNavegador();
      const todasQuadras = clubes.flatMap((c) => c.quadras.map((q) => q.id));
      const agora = new Date();
      const daqui3h = new Date(agora.getTime() + 3 * 60 * 60 * 1000);
      const { data } = await supabase.rpc("horarios_ocupados", {
        p_quadras: todasQuadras,
        p_de: agora.toISOString(),
        p_ate: daqui3h.toISOString(),
      });
      setOcupacoes((data as Ocupacao[]) ?? []);
      posthog.capture("jogar_agora_ativado");
    }
  }

  const clubesFiltrados = useMemo(() => {
    return clubes.filter((clube) => {
      let quadras = clube.quadras;
      if (esporte) quadras = quadras.filter((q) => q.esporte === esporte);
      if (tipo) quadras = quadras.filter((q) => q.tipo === tipo);
      if (soCobertas) quadras = quadras.filter((q) => q.coberta);
      if (quadras.length === 0) return false;

      if (precoMax) {
        const menor = menorPrecoCentavos(quadras);
        if (menor === null || menor > parseFloat(precoMax) * 100) return false;
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
        const livre = quadras.some((q) =>
          quadraLivreAgora(q, ocupacoes ?? [])
        );
        if (!livre) return false;
      }

      return true;
    });
  }, [
    clubes,
    esporte,
    tipo,
    soCobertas,
    precoMax,
    distanciaMax,
    minhaPosicao,
    jogarAgora,
    ocupacoes,
  ]);

  const filtrosAtivos =
    (esporte ? 1 : 0) +
    (tipo ? 1 : 0) +
    (soCobertas ? 1 : 0) +
    (precoMax ? 1 : 0) +
    (distanciaMax ? 1 : 0);

  const estiloSelect =
    "rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-tinta focus:border-primaria focus:outline-none";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          type="button"
          onClick={alternarJogarAgora}
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
        <span className="ml-auto text-xs text-tinta-suave">
          {clubesFiltrados.length}{" "}
          {clubesFiltrados.length === 1 ? "clube" : "clubes"}
        </span>
      </div>

      {mostrarFiltros && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-superficie p-3 shadow ring-1 ring-black/5">
          <select
            value={esporte}
            onChange={(e) => {
              setEsporte(e.target.value);
              posthog.capture("mapa_filtro_usado", { filtro: "esporte" });
            }}
            className={estiloSelect}
          >
            {ESPORTES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value);
              posthog.capture("mapa_filtro_usado", { filtro: "tipo" });
            }}
            className={estiloSelect}
          >
            {TIPOS.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
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
          <select
            value={distanciaMax}
            onChange={(e) => setDistanciaMax(e.target.value)}
            disabled={!minhaPosicao}
            className={estiloSelect}
            title={
              minhaPosicao
                ? undefined
                : "Permita a localização no navegador para filtrar por distância"
            }
          >
            <option value="">Qualquer distância</option>
            <option value="5">Até 5 km</option>
            <option value="10">Até 10 km</option>
            <option value="20">Até 20 km</option>
            <option value="50">Até 50 km</option>
          </select>
        </div>
      )}

      <div className="relative flex-1" style={{ minHeight: "60vh" }}>
        <MapaClubes
          clubes={clubesFiltrados}
          minhaPosicao={minhaPosicao}
        />
      </div>
    </div>
  );
}
