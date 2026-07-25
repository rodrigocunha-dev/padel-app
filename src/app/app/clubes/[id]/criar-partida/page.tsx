import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CriarPartida } from "@/components/partidas/CriarPartida";

export const metadata: Metadata = {
  title: "Criar partida — padel",
};

export default async function PaginaCriarPartida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // Precisa do sexo/categoria do organizador para pré-preencher a partida.
  const { data: jogador } = await supabase
    .from("jogadores")
    .select("categoria, sexo")
    .eq("id", user.id)
    .maybeSingle();
  if (!jogador) redirect("/app/onboarding");
  if (!jogador.sexo) redirect("/app/completar-perfil");

  const { data: clube } = await supabase
    .from("clubes")
    .select(
      "id, nome, quadras ( id, nome, esporte, tipo, coberta, quadra_precos ( dias, hora_inicio, hora_fim, preco_centavos ) )"
    )
    .eq("id", id)
    .maybeSingle();
  if (!clube) notFound();

  // Partidas de padel: alma do produto no lançamento (matchmaking é 100% padel).
  const quadrasPadel = clube.quadras.filter((q) => q.esporte === "padel");

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link
          href={`/app/clubes/${clube.id}`}
          className="text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          ← Voltar ao clube
        </Link>
        <h1 className="mt-3 font-display text-2xl font-extrabold text-tinta">
          Criar partida em {clube.nome}
        </h1>

        {quadrasPadel.length === 0 ? (
          <p className="mt-5 text-sm text-tinta-suave">
            Este clube ainda não tem quadras de padel cadastradas.
          </p>
        ) : (
          <CriarPartida
            quadras={quadrasPadel}
            categoriaJogador={jogador.categoria}
            sexoJogador={jogador.sexo}
          />
        )}
      </div>
    </main>
  );
}
