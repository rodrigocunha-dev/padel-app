import type { Metadata } from "next";
import { criarClienteServidor } from "@/lib/supabase/server";
import { BotaoSair } from "@/components/BotaoSair";

export const metadata: Metadata = {
  title: "Início — padel",
};

export default async function PaginaApp() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O proxy garante que só chega aqui logado, mas o TypeScript não sabe.
  if (!user) return null;

  const { data: jogador } = await supabase
    .from("jogadores")
    .select("nome, categoria, nivel_categoria, em_calibracao")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            {jogador ? `Olá, ${jogador.nome.split(" ")[0]}!` : "Bem-vindo!"}
          </h1>
          <BotaoSair />
        </header>

        {jogador ? (
          <div className="mt-6 rounded-2xl bg-superficie p-6 shadow-lg ring-1 ring-black/5">
            <p className="text-sm text-tinta-suave">Sua categoria</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-primaria">
              {jogador.categoria}ª{" "}
              <span className="text-lg font-bold text-tinta-suave">
                {jogador.nivel_categoria}
              </span>
            </p>
            {jogador.em_calibracao && (
              <span className="mt-3 inline-block rounded-full bg-destaque px-3 py-1 text-xs font-bold text-destaque-tinta">
                ⚖️ Em calibração
              </span>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-superficie p-6 text-center shadow-lg ring-1 ring-black/5">
            <p className="font-display text-lg font-bold text-tinta">
              Falta pouco! Vamos montar seu perfil de jogador.
            </p>
            <p className="mt-2 text-sm text-tinta-suave">
              O cadastro de perfil chega no próximo passo do desenvolvimento —
              login funcionando é o primeiro degrau. 🎾
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
