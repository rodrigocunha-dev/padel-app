import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { criarClienteServidor } from "@/lib/supabase/server";
import { OnboardingJogador } from "@/components/OnboardingJogador";
import { BotaoSair } from "@/components/BotaoSair";

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
        {/* ⚠️ A UNICA SAIDA DESTA TELA.

            A barra de navegacao e escondida no cadastro de proposito (para
            ninguem escapar do onboarding pela metade e usar o app sem
            perfil). O efeito colateral era uma armadilha: quem entrasse com
            o numero errado ficava preso, sem voltar e sem sair, obrigado a
            criar um perfil que nao queria.

            Sair nao deixa nada pela metade: enquanto o perfil nao e salvo,
            nao existe nada no banco para limpar. */}
        <div className="mb-6 flex justify-end">
          <BotaoSair destaque />
        </div>

        <OnboardingJogador
          usuarioId={user.id}
          telefone={user.phone ? `+${user.phone}` : ""}
        />
      </div>
    </main>
  );
}
