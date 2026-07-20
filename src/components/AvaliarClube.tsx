"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

type Props = {
  clubeId: string;
  jogadorId: string;
  notaAtual: number | null;
  comentarioAtual: string | null;
};

export function AvaliarClube({
  clubeId,
  jogadorId,
  notaAtual,
  comentarioAtual,
}: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState(notaAtual ?? 0);
  const [comentario, setComentario] = useState(comentarioAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (nota < 1) {
      setErro("Escolha de 1 a 5 estrelas.");
      return;
    }
    setErro(null);
    setSalvando(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.from("avaliacoes").upsert(
      {
        clube_id: clubeId,
        jogador_id: jogadorId,
        nota,
        comentario: comentario.trim() || null,
      },
      { onConflict: "clube_id,jogador_id" }
    );
    setSalvando(false);

    if (error) {
      console.error("Erro ao avaliar:", error.message);
      setErro("Não conseguimos salvar sua avaliação. Tente de novo.");
      return;
    }

    posthog.capture("clube_avaliado", { nota, tem_comentario: !!comentario.trim() });
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
        {notaAtual ? "✏️ Editar minha avaliação" : "★ Avaliar este clube"}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5">
      <div className="flex gap-1 text-2xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNota(n)}
            aria-label={`${n} estrelas`}
            className={n <= nota ? "text-primaria" : "text-black/15"}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Como foi jogar lá? (opcional)"
        rows={3}
        className="mt-3 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta placeholder:text-tinta-suave/60 focus:border-primaria focus:outline-none focus:ring-2 focus:ring-primaria/30"
      />
      {erro && <p className="mt-2 text-sm font-medium text-red-600">{erro}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-full bg-destaque px-5 py-2 font-display text-sm font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Publicar avaliação"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-sm text-tinta-suave hover:text-tinta"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
