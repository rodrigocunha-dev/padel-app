"use client";

import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";

export function BotaoSair() {
  const router = useRouter();

  async function sair() {
    const supabase = criarClienteNavegador();
    await supabase.auth.signOut();
    router.replace("/entrar");
  }

  return (
    <button
      type="button"
      onClick={sair}
      className="text-sm font-medium text-tinta-suave hover:text-tinta"
    >
      Sair
    </button>
  );
}
