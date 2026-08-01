import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { BotaoSair } from "@/components/BotaoSair";
import { ROTULO_NIVEL } from "@/lib/partidas";

export const metadata: Metadata = {
  title: "Meu perfil — padel",
};

// Perfil mínimo: só o que já está guardado hoje. Histórico, estatísticas
// e evolução do rating entram no Sprint 5, depois que a regra nº 5 for
// decidida — não colocar placeholder aqui antes disso.
export default async function PaginaPerfil() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: jogador } = await supabase
    .from("jogadores")
    .select("nome, foto_url, cidade, categoria, nivel_categoria, em_calibracao")
    .eq("id", user.id)
    .maybeSingle();

  if (!jogador) redirect("/app/onboarding");

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display text-2xl font-extrabold text-tinta">
          Meu perfil
        </h1>

        <div className="mt-6 flex items-center gap-4">
          {jogador.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={jogador.foto_url}
              alt=""
              className="h-16 w-16 rounded-full object-cover ring-2 ring-primaria/30"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-16 w-16 items-center justify-center rounded-full bg-superficie text-2xl ring-2 ring-primaria/30"
            >
              🎾
            </div>
          )}
          <div>
            <p className="font-display text-xl font-extrabold text-tinta">
              {jogador.nome}
            </p>
            {jogador.cidade && (
              <p className="text-sm text-tinta-suave">{jogador.cidade}</p>
            )}
          </div>
        </div>

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
          href="/app/reservas"
          className="mt-4 block rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
        >
          <p className="font-display text-base font-bold text-tinta">
            🎾 Minhas reservas
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            Cancelar ou remarcar suas quadras
          </p>
        </Link>

        <Link
          href="/app/partidas/minhas"
          className="mt-3 block rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
        >
          <p className="font-display text-base font-bold text-tinta">
            📋 Minhas partidas
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            Seus jogos e pagamentos — futuros e passados
          </p>
        </Link>

        <div className="mt-8 border-t border-black/5 pt-6">
          <BotaoSair />
        </div>
      </div>
    </main>
  );
}
