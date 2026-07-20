"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mascararTelefoneBr } from "@/lib/telefone";

type Clube = {
  id: string;
  nome: string;
  cidade: string;
  telefone: string | null;
  descricao: string | null;
  politica_cancelamento: string | null;
};

const estiloInput =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta placeholder:text-tinta-suave/60 focus:border-primaria focus:outline-none focus:ring-2 focus:ring-primaria/30";

export function EditarClube({ clube }: { clube: Clube }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [telefone, setTelefone] = useState(
    clube.telefone ? mascararTelefoneBr(clube.telefone) : ""
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const nome = String(dados.get("nome") ?? "").trim();
    const cidade = String(dados.get("cidade") ?? "").trim();
    const descricao = String(dados.get("descricao") ?? "").trim();
    const politica = String(dados.get("politica") ?? "").trim();

    if (!nome || !cidade) {
      setErro("Nome e cidade são obrigatórios.");
      return;
    }

    setSalvando(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase
      .from("clubes")
      .update({
        nome,
        cidade,
        telefone: telefone.replace(/\D/g, "") || null,
        descricao: descricao || null,
        politica_cancelamento: politica || null,
      })
      .eq("id", clube.id);
    setSalvando(false);

    if (error) {
      console.error("Erro ao editar clube:", error.message);
      setErro("Não conseguimos salvar. Tente de novo.");
      return;
    }

    posthog.capture("clube_editado", {
      tem_descricao: !!descricao,
      tem_politica: !!politica,
    });
    setAberto(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 text-sm font-medium text-primaria hover:underline"
      >
        ✏️ Editar informações do clube
      </button>
    );
  }

  return (
    <form
      onSubmit={salvar}
      className="mt-3 rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5"
    >
      <h2 className="font-display text-lg font-bold text-tinta">
        Informações do clube
      </h2>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">Nome</span>
        <input
          name="nome"
          type="text"
          required
          defaultValue={clube.nome}
          className={estiloInput}
        />
      </label>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">Cidade</span>
        <input
          name="cidade"
          type="text"
          required
          defaultValue={clube.cidade}
          className={estiloInput}
        />
      </label>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">
          Telefone/WhatsApp do clube
        </span>
        <input
          name="telefone"
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(mascararTelefoneBr(e.target.value))}
          placeholder="(51) 99999-8888"
          className={estiloInput}
        />
        <span className="text-xs text-tinta-suave">
          Vira o botão “Chamar no WhatsApp” na página do clube.
        </span>
      </label>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">
          Descrição <span className="text-tinta-suave">(opcional)</span>
        </span>
        <textarea
          name="descricao"
          rows={3}
          defaultValue={clube.descricao ?? ""}
          placeholder="Conte o que faz seu clube especial: estrutura, bar, estacionamento, vestiário..."
          className={estiloInput}
        />
      </label>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">
          Política de cancelamento{" "}
          <span className="text-tinta-suave">(opcional)</span>
        </span>
        <textarea
          name="politica"
          rows={3}
          defaultValue={clube.politica_cancelamento ?? ""}
          placeholder="Ex.: cancelamento gratuito até 12h antes; depois disso, cobramos 50% do valor."
          className={estiloInput}
        />
        <span className="text-xs text-tinta-suave">
          Será exibida ao jogador ANTES de pagar, quando as reservas pelo app
          chegarem.
        </span>
      </label>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="flex-1 rounded-full bg-destaque px-4 py-2.5 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar informações"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-full px-4 py-2.5 text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
