"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

// O mapa só funciona no navegador (usa window), por isso o import dinâmico.
const MapaPin = dynamic(() => import("@/components/mapa/MapaPin"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-xl bg-fundo text-sm text-tinta-suave">
      Carregando mapa...
    </div>
  ),
});

type Props = {
  clubeId: string;
  enderecoAtual: string | null;
  latitude: number | null;
  longitude: number | null;
};

// Centro de Novo Hamburgo/RS — ponto de partida quando não há coordenadas.
const CENTRO_PADRAO: [number, number] = [-29.6783, -51.1309];

export function LocalizacaoClube({
  clubeId,
  enderecoAtual,
  latitude,
  longitude,
}: Props) {
  const router = useRouter();
  const [endereco, setEndereco] = useState(enderecoAtual ?? "");
  const [posicao, setPosicao] = useState<[number, number] | null>(
    latitude != null && longitude != null ? [latitude, longitude] : null
  );
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function buscarEndereco() {
    if (!endereco.trim()) {
      setMensagem("Digite o endereço antes de buscar.");
      return;
    }
    setMensagem(null);
    setBuscando(true);
    try {
      const resposta = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(endereco)}`,
        { headers: { "Accept-Language": "pt-BR" } }
      );
      const resultados = await resposta.json();
      if (resultados.length === 0) {
        setMensagem(
          "Endereço não encontrado. Tente incluir cidade e estado, ou arraste o pin no mapa."
        );
      } else {
        setPosicao([
          parseFloat(resultados[0].lat),
          parseFloat(resultados[0].lon),
        ]);
        setMensagem("Confira o pin no mapa e arraste para ajustar se precisar.");
      }
    } catch {
      setMensagem("Falha na busca. Tente de novo em instantes.");
    }
    setBuscando(false);
  }

  async function salvar() {
    if (!posicao) {
      setMensagem("Busque o endereço ou posicione o pin antes de salvar.");
      return;
    }
    setSalvando(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase
      .from("clubes")
      .update({
        endereco: endereco.trim() || null,
        latitude: posicao[0],
        longitude: posicao[1],
      })
      .eq("id", clubeId);
    setSalvando(false);

    if (error) {
      console.error("Erro ao salvar localização:", error.message);
      setMensagem("Não conseguimos salvar. Tente de novo.");
      return;
    }
    posthog.capture("clube_localizacao_salva");
    setMensagem("Localização salva! Seu clube já aparece no mapa dos jogadores.");
    router.refresh();
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-tinta">
        Localização no mapa
      </h2>
      <p className="mt-1 text-sm text-tinta-suave">
        É assim que os jogadores encontram seu clube. Busque o endereço e
        ajuste o pin se necessário.
      </p>

      <div className="mt-3 rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
        <div className="flex gap-2">
          <input
            type="text"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua, número, cidade — ex.: Av. Nações Unidas 500, Novo Hamburgo"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta placeholder:text-tinta-suave/60 focus:border-primaria focus:outline-none focus:ring-2 focus:ring-primaria/30"
          />
          <button
            type="button"
            onClick={buscarEndereco}
            disabled={buscando}
            className="shrink-0 rounded-full bg-primaria px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </div>

        <div className="mt-3">
          <MapaPin
            centro={posicao ?? CENTRO_PADRAO}
            pin={posicao}
            aoMoverPin={(lat, lng) => {
              setPosicao([lat, lng]);
              setMensagem(null);
            }}
          />
        </div>

        {mensagem && (
          <p className="mt-3 text-sm font-medium text-tinta">{mensagem}</p>
        )}

        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !posicao}
          className="mt-4 rounded-full bg-destaque px-6 py-2.5 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar localização"}
        </button>
      </div>
    </section>
  );
}
