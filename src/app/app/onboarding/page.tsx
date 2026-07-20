import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { criarClienteServidor } from "@/lib/supabase/server";
import { OnboardingJogador } from "@/components/OnboardingJogador";

export const metadata: Metadata = {
  title: "Criar perfil — padel",
};

export default async function PaginaOnboarding() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const { data: jogador } = await supabase
    .from("jogadores")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  // Quem já tem perfil não refaz o onboarding.
  if (jogador) redirect("/app");

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <OnboardingJogador
          usuarioId={user.id}
          telefone={user.phone ? `+${user.phone}` : ""}
        />
      </div>
    </main>
  );
}
