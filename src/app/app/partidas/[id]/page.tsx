import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { PartidaDetalhe } from "@/components/partidas/PartidaDetalhe";

export const metadata: Metadata = {
  title: "Partida — padel",
};

export default async function PaginaPartida({
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

  const { data: partida } = await supabase
    .from("partidas")
    .select(
      "id, categoria_min, categoria_max, competitiva, sexo_jogo, max_jogadores, status, organizador_id, inicio, fim, preco_centavos, quadras ( nome, clubes ( id, nome, cidade ) ), partida_jogadores ( jogador_id, papel, ordem )"
    )
    .eq("id", id)
    .maybeSingle();

  if (!partida) notFound();

  // Os nomes vêm à parte: partida_jogadores.jogador_id aponta para
  // auth.users, então não dá para juntar direto com a tabela jogadores.
  const ids = partida.partida_jogadores.map((j) => j.jogador_id);
  const { data: perfis } = await supabase
    .from("jogadores")
    .select("id, nome, foto_url, categoria")
    .in("id", ids);
  const porId = new Map((perfis ?? []).map((p) => [p.id, p]));

  const jogadores = partida.partida_jogadores.map((j) => ({
    ...j,
    perfil: porId.get(j.jogador_id) ?? null,
  }));

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/app/partidas"
          className="text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          ← Partidas abertas
        </Link>
        <PartidaDetalhe
          partida={JSON.parse(JSON.stringify({ ...partida, jogadores }))}
          meuId={user.id}
        />
      </div>
    </main>
  );
}
