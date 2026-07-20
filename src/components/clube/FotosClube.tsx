"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

type Foto = { id: string; url: string };

export function FotosClube({
  clubeId,
  donoId,
  fotos,
}: {
  clubeId: string;
  donoId: string;
  fotos: Foto[];
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Aceita várias fotos de uma vez (pedido do fundador) — envia uma a
  // uma e avisa se alguma falhar, sem travar as demais.
  async function enviarVarias(arquivos: File[]) {
    setErro(null);
    setEnviando(true);
    const supabase = criarClienteNavegador();
    let falhas = 0;

    for (const arquivo of arquivos) {
      const caminho = `${donoId}/clube-${clubeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: erroUpload } = await supabase.storage
        .from("fotos")
        .upload(caminho, arquivo);

      if (erroUpload) {
        console.error("Erro no upload:", erroUpload.message);
        falhas++;
        continue;
      }

      const url = supabase.storage.from("fotos").getPublicUrl(caminho)
        .data.publicUrl;
      const { error } = await supabase
        .from("clube_fotos")
        .insert({ clube_id: clubeId, url });
      if (error) {
        console.error("Erro ao registrar foto:", error.message);
        falhas++;
      }
    }

    setEnviando(false);
    if (falhas > 0) {
      setErro(
        falhas === arquivos.length
          ? "Não conseguimos enviar as fotos. Tente de novo."
          : `${falhas} de ${arquivos.length} fotos falharam — tente enviá-las de novo.`
      );
    }
    if (falhas < arquivos.length) {
      posthog.capture("clube_foto_adicionada", {
        quantidade: arquivos.length - falhas,
      });
      router.refresh();
    }
  }

  async function remover(fotoId: string) {
    const supabase = criarClienteNavegador();
    const { error } = await supabase
      .from("clube_fotos")
      .delete()
      .eq("id", fotoId);
    if (!error) router.refresh();
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-tinta">
        Fotos do clube
      </h2>
      <p className="mt-1 text-sm text-tinta-suave">
        Aparecem na página do clube que os jogadores veem. Capriche!
      </p>

      <div className="mt-3 flex flex-wrap gap-3">
        {fotos.map((foto) => (
          <div key={foto.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.url}
              alt="Foto do clube"
              className="h-28 w-40 rounded-xl object-cover ring-1 ring-black/10"
            />
            <button
              type="button"
              onClick={() => remover(foto.id)}
              aria-label="Remover foto"
              className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white hover:bg-red-600"
            >
              ✕
            </button>
          </div>
        ))}

        <label className="flex h-28 w-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primaria/30 bg-primaria/5 text-center">
          <span className="text-2xl">📷</span>
          <span className="px-2 text-xs font-medium text-primaria">
            {enviando ? "Enviando..." : "Adicionar fotos"}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={enviando}
            onChange={(e) => {
              const arquivos = Array.from(e.target.files ?? []);
              if (arquivos.length > 0) enviarVarias(arquivos);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {erro && <p className="mt-2 text-sm font-medium text-red-600">{erro}</p>}
    </section>
  );
}
