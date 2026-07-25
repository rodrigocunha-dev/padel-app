"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

// Perfis criados antes do campo "sexo" existir completam aqui. Uma tela só,
// para não repetir todo o onboarding.
export function CompletarPerfil() {
  const router = useRouter();
  const [sexo, setSexo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!sexo) return;
    setErro(null);
    setSalvando(true);
    const supabase = criarClienteNavegador();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/entrar");
      return;
    }
    const { error } = await supabase
      .from("jogadores")
      .update({ sexo })
      .eq("id", user.id);
    setSalvando(false);

    if (error) {
      console.error("Erro ao completar perfil:", error.message);
      setErro("Não conseguimos salvar. Tente de novo.");
      return;
    }
    posthog.capture("perfil_completado", { campo: "sexo" });
    router.replace("/app");
  }

  return (
    <div className="rounded-2xl bg-superficie p-6 shadow-lg ring-1 ring-black/5">
      <h1 className="font-display text-2xl font-extrabold text-tinta">
        Falta só uma coisa
      </h1>
      <p className="mt-2 text-sm text-tinta-suave">
        Agora dá para entrar em partidas masculinas, femininas ou mistas. Para
        isso, precisamos saber seu sexo.
      </p>

      <div className="mt-5 flex gap-2">
        {[
          { id: "masculino", rotulo: "Masculino" },
          { id: "feminino", rotulo: "Feminino" },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSexo(s.id)}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              sexo === s.id
                ? "border-primaria bg-primaria/10 text-primaria"
                : "border-black/10 bg-white text-tinta hover:border-primaria/40"
            }`}
          >
            {s.rotulo}
          </button>
        ))}
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      <button
        type="button"
        disabled={!sexo || salvando}
        onClick={salvar}
        className="mt-6 w-full rounded-full bg-destaque px-6 py-3 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-50"
      >
        {salvando ? "Salvando..." : "Continuar"}
      </button>
    </div>
  );
}
