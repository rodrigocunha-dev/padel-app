"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { buscarEndereco, type LocalEncontrado } from "@/lib/geo";
import { mascararTelefoneBr } from "@/lib/telefone";

const estiloInput =
  "w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-tinta placeholder:text-tinta-suave/60 focus:border-primaria focus:outline-none focus:ring-2 focus:ring-primaria/30";

export function CadastroClube({ donoId }: { donoId: string }) {
  const router = useRouter();
  const [endereco, setEndereco] = useState("");
  const [local, setLocal] = useState<LocalEncontrado | null>(null);
  const [telefone, setTelefone] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function procurar() {
    if (!endereco.trim()) {
      setErro("Digite o endereço do clube antes de buscar.");
      return;
    }
    setErro(null);
    setBuscando(true);
    try {
      const encontrado = await buscarEndereco(endereco);
      if (!encontrado || !encontrado.cidade) {
        setErro(
          "Endereço não encontrado. Tente incluir número, cidade e estado."
        );
        setLocal(null);
      } else {
        setLocal(encontrado);
      }
    } catch {
      setErro("Falha na busca. Tente de novo em instantes.");
    }
    setBuscando(false);
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const nome = String(dados.get("nome") ?? "").trim();

    if (!nome) {
      setErro("Informe o nome do clube.");
      return;
    }
    if (!local?.cidade) {
      setErro("Busque o endereço do clube para definirmos a cidade.");
      return;
    }

    setSalvando(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.from("clubes").insert({
      dono_id: donoId,
      nome,
      // Cidade sempre vem do endereço (nunca digitada) — assim o nome é o
      // oficial e o filtro por cidade do jogador funciona.
      cidade: local.cidade,
      endereco: endereco.trim(),
      latitude: local.latitude,
      longitude: local.longitude,
      telefone: telefone.replace(/\D/g, "") || null,
    });
    setSalvando(false);

    if (error) {
      console.error("Erro ao criar clube:", error.message);
      setErro("Não conseguimos salvar o clube. Tente de novo.");
      return;
    }

    posthog.capture("clube_criado", { cidade: local.cidade });
    router.refresh();
  }

  return (
    <form
      onSubmit={salvar}
      className="rounded-2xl bg-superficie p-6 shadow-lg ring-1 ring-black/5"
    >
      <h1 className="font-display text-2xl font-extrabold text-tinta">
        Cadastre seu clube
      </h1>
      <p className="mt-2 text-sm text-tinta-suave">
        Depois você adiciona as quadras — de padel e de qualquer outro
        esporte.
      </p>

      <label className="mt-5 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">Nome do clube</span>
        <input
          name="nome"
          type="text"
          required
          placeholder="Ex.: Arena Padel Sinos"
          className={estiloInput}
        />
      </label>

      <div className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">
          Endereço do clube
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={endereco}
            onChange={(e) => {
              setEndereco(e.target.value);
              setLocal(null);
            }}
            placeholder="Rua, número, cidade e estado"
            className={estiloInput}
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
        <span className="text-xs text-tinta-suave">
          A cidade do clube é definida pelo endereço — depois você ajusta o
          pin no mapa, se precisar.
        </span>
        {local?.cidade && (
          <span className="text-sm font-medium text-primaria">
            ✓ Cidade identificada: {local.cidade}
          </span>
        )}
      </div>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">
          Telefone/WhatsApp do clube{" "}
          <span className="text-tinta-suave">(opcional)</span>
        </span>
        <input
          name="telefone"
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(mascararTelefoneBr(e.target.value))}
          placeholder="(51) 99999-8888"
          className={estiloInput}
        />
      </label>

      {erro && <p className="mt-4 text-sm font-medium text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={salvando}
        className="mt-6 w-full rounded-full bg-destaque px-6 py-3 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
      >
        {salvando ? "Salvando..." : "Criar clube"}
      </button>
    </form>
  );
}
