import { BarraNavegacao } from "@/components/BarraNavegacao";
import { criarClienteServidor } from "@/lib/supabase/server";

// Layout só do app do jogador. O painel do clube (/clube) e o login
// (/entrar) ficam de fora — a barra é da experiência do jogador.
export default async function LayoutApp({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A barra mostra a foto (ou a inicial) no lugar do ícone de perfil.
  // Quem ainda não terminou o cadastro não tem perfil — e nesses caminhos
  // a barra nem aparece.
  const { data: jogador } = user
    ? await supabase
        .from("jogadores")
        .select("nome, foto_url")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <>
      {children}
      <BarraNavegacao
        nome={jogador?.nome ?? null}
        fotoUrl={jogador?.foto_url ?? null}
      />
    </>
  );
}
