import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { BotaoSair } from "@/components/BotaoSair";

export const metadata: Metadata = {
  title: "Início — padel",
};

const ROTULO_NIVEL: Record<string, string> = {
  forte: "Forte",
  medio: "Médio",
  fraco: "Fraco",
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
    .select("nome, foto_url, categoria, nivel_categoria, em_calibracao")
    .eq("id", user.id)
    .maybeSingle();

  // Logou mas ainda não tem perfil → onboarding.
  if (!jogador) redirect("/app/onboarding");

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {jogador.foto_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={jogador.foto_url}
                alt=""
                className="h-11 w-11 rounded-full object-cover ring-2 ring-primaria/30"
              />
            )}
            <h1 className="font-display text-2xl font-extrabold text-tinta">
              Olá, {jogador.nome.split(" ")[0]}!
            </h1>
          </div>
          <BotaoSair />
        </header>

        <div className="mt-6 rounded-2xl bg-superficie p-6 shadow-lg ring-1 ring-black/5">
          <p className="text-sm text-tinta-suave">Sua categoria</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-primaria">
            {jogador.categoria}ª{" "}
            <span className="text-lg font-bold text-tinta-suave">
              {ROTULO_NIVEL[jogador.nivel_categoria] ?? jogador.nivel_categoria}
            </span>
          </p>
          {jogador.em_calibracao && (
            <span className="mt-3 inline-block rounded-full bg-destaque px-3 py-1 text-xs font-bold text-destaque-tinta">
              ⚖️ Em calibração
            </span>
          )}
        </div>

        <Link
          href="/app/descobrir"
          className="mt-4 block rounded-2xl bg-primaria p-6 shadow-lg transition hover:brightness-110"
        >
          <p className="font-display text-lg font-bold text-white">
            🗺️ Descobrir clubes
          </p>
          <p className="mt-1 text-sm text-white/80">
            Mapa com preços, filtros e quadras livres agora
          </p>
        </Link>
      </div>
    </main>
  );
}
