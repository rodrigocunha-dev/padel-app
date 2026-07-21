"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { buscarEndereco, localPorCoordenadas } from "@/lib/geo";

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
  cidadeAtual: string;
  latitude: number | null;
  longitude: number | null;
};

// Centro de Novo Hamburgo/RS — ponto de partida quando não há coordenadas.
const CENTRO_PADRAO: [number, number] = [-29.6783, -51.1309];

export function LocalizacaoClube({
  clubeId,
  enderecoAtual,
  cidadeAtual,
  latitude,
  longitude,
}: Props) {
  const router = useRouter();
  const [endereco, setEndereco] = useState(enderecoAtual ?? "");
  const [posicao, setPosicao] = useState<[number, number] | null>(
    latitude != null && longitude != null ? [latitude, longitude] : null
  );
  // Cidade detectada pelo mapa — é ela que vai para o banco.
  const [cidadeDetectada, setCidadeDetectada] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function procurar() {
    if (!endereco.trim()) {
      setMensagem("Digite o endereço antes de buscar.");
      return;
    }
    setMensagem(null);
    setBuscando(true);
    try {
      const local = await buscarEndereco(endereco);
      if (!local) {
        setMensagem(
          "Endereço não encontrado. Tente incluir cidade e estado, ou arraste o pin no mapa."
        );
      } else {
        setPosicao([local.latitude, local.longitude]);
        setCidadeDetectada(local.cidade);
        setMensagem("Confira o pin no mapa e arraste para ajustar se precisar.");
      }
    } catch {
      setMensagem("Falha na busca. Tente de novo em instantes.");
    }
    setBuscando(false);
  }

  // Ao mover o pin, a cidade é redescoberta pelas novas coordenadas.
  async function moverPin(lat: number, lng: number) {
    setPosicao([lat, lng]);
    setMensagem(null);
    setCidadeDetectada(null);
    try {
      const local = await localPorCoordenadas(lat, lng);
      if (local?.cidade) setCidadeDetectada(local.cidade);
    } catch {
      // Sem conexão com o serviço: a cidade é resolvida ao salvar.
    }
  }

  async function salvar() {
    if (!posicao) {
      setMensagem("Busque o endereço ou posicione o pin antes de salvar.");
      return;
    }
    setSalvando(true);

    // Garante a cidade oficial mesmo se o pin foi movido sem resposta antes.
    let cidade = cidadeDetectada;
    if (!cidade) {
      try {
        const local = await localPorCoordenadas(posicao[0], posicao[1]);
        cidade = local?.cidade ?? null;
      } catch {
        cidade = null;
      }
    }

    const supabase = criarClienteNavegador();
    const { error } = await supabase
      .from("clubes")
      .update({
        endereco: endereco.trim() || null,
        latitude: posicao[0],
        longitude: posicao[1],
        // Cidade nunca é digitada: vem sempre do mapa (evita "NH" vs
        // "Novo Hamburgo" quebrando o filtro por cidade do jogador).
        ...(cidade ? { cidade } : {}),
      })
      .eq("id", clubeId);
    setSalvando(false);

    if (error) {
      console.error("Erro ao salvar localização:", error.message);
      setMensagem("Não conseguimos salvar. Tente de novo.");
      return;
    }
    posthog.capture("clube_localizacao_salva", { cidade_detectada: !!cidade });
    setMensagem(
      cidade
        ? `Localização salva! Cidade do clube: ${cidade}.`
        : "Localização salva! Não conseguimos identificar a cidade — ajuste o pin e salve de novo."
    );
    router.refresh();
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-tinta">
        Localização no mapa
      </h2>
      <p className="mt-1 text-sm text-tinta-suave">
        É assim que os jogadores encontram seu clube. Busque o endereço e
        ajuste o pin se necessário — a cidade do clube é definida aqui.
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
            onClick={procurar}
            disabled={buscando}
            className="shrink-0 rounded-full bg-primaria px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </div>

        <p className="mt-2 text-sm text-tinta-suave">
          Cidade:{" "}
          <strong className="text-tinta">
            {cidadeDetectada ?? cidadeAtual}
          </strong>
          {cidadeDetectada && cidadeDetectada !== cidadeAtual && (
            <span className="ml-1 text-primaria">
              (será atualizada ao salvar)
            </span>
          )}
        </p>

        <div className="mt-3">
          <MapaPin
            centro={posicao ?? CENTRO_PADRAO}
            pin={posicao}
            aoMoverPin={moverPin}
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
