"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

const estiloInput =
  "w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-tinta placeholder:text-tinta-suave/60 focus:border-primaria focus:outline-none focus:ring-2 focus:ring-primaria/30";

export function CadastroClube({ donoId }: { donoId: string }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const nome = String(dados.get("nome") ?? "").trim();
    const cidade = String(dados.get("cidade") ?? "").trim();
    const endereco = String(dados.get("endereco") ?? "").trim();
    const telefone = String(dados.get("telefone") ?? "").trim();

    if (!nome || !cidade) {
      setErro("Nome e cidade são obrigatórios.");
      return;
    }

    setSalvando(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.from("clubes").insert({
      dono_id: donoId,
      nome,
      cidade,
      endereco: endereco || null,
      telefone: telefone || null,
    });
    setSalvando(false);

    if (error) {
      console.error("Erro ao criar clube:", error.message);
      setErro("Não conseguimos salvar o clube. Tente de novo.");
      return;
    }

    posthog.capture("clube_criado", { cidade });
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
      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">Cidade</span>
        <input
          name="cidade"
          type="text"
          required
          placeholder="Ex.: Novo Hamburgo"
          className={estiloInput}
        />
      </label>
      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">
          Endereço <span className="text-tinta-suave">(opcional)</span>
        </span>
        <input
          name="endereco"
          type="text"
          placeholder="Rua, número, bairro"
          className={estiloInput}
        />
      </label>
      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">
          Telefone/WhatsApp do clube{" "}
          <span className="text-tinta-suave">(opcional)</span>
        </span>
        <input
          name="telefone"
          type="tel"
          placeholder="(51) 3333-4444"
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
