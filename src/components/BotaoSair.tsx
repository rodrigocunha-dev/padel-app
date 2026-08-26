"use client";

import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";

// `destaque` existe por causa do cadastro: la o Sair e a UNICA saida da tela,
// e saida apagada nao se acha. Na Inicio ele continua discreto, porque ali
// sair e o que a pessoa menos quer fazer.
export function BotaoSair({ destaque = false }: { destaque?: boolean }) {
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
      className={
        destaque
          ? "rounded-full border border-black/10 bg-superficie px-4 py-2 text-sm font-bold text-tinta transition hover:bg-black/5"
          : "text-sm font-medium text-tinta-suave hover:text-tinta"
      }
    >
      {destaque ? "← Sair" : "Sair"}
    </button>
  );
}
