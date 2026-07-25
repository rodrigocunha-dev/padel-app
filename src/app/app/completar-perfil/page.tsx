import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CompletarPerfil } from "@/components/CompletarPerfil";

export const metadata: Metadata = {
  title: "Completar perfil — padel",
};

export default async function PaginaCompletarPerfil() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: jogador } = await supabase
    .from("jogadores")
    .select("sexo")
    .eq("id", user.id)
    .maybeSingle();

  if (!jogador) redirect("/app/onboarding");
  // Já tem tudo? Volta para o início.
  if (jogador.sexo) redirect("/app");

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-fundo px-6 py-12">
      <div className="w-full max-w-sm">
        <CompletarPerfil />
      </div>
    </main>
  );
}
