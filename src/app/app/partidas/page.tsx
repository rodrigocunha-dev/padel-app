import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  criarClienteServidor,
  perfilAtual,
  usuarioAtual,
} from "@/lib/supabase/server";
import { FeedPartidas } from "@/components/partidas/FeedPartidas";
import { AbasPartidas } from "@/components/partidas/AbasPartidas";
import type { PartidaFeed } from "@/lib/partidas-tipos";

export const metadata: Metadata = {
  title: "Partidas abertas — padel",
};

export default async function PaginaFeed() {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual();
  if (!user) redirect("/entrar");

  // ⚡ O feed não depende do meu perfil — ele traz TODAS as partidas abertas,
  // e a compatibilidade com a minha categoria é decidida na tela. Então as
  // duas coisas podem ser buscadas ao mesmo tempo. E o perfil já veio no
  // layout: `perfilAtual` devolve o de lá sem ir ao banco de novo.
  const [jogador, { data: partidas }] = await Promise.all([
    perfilAtual(user.id),

    // "aberta" (tem vaga) e "completa" (cheia, mas dá para entrar na fila de
    // substitutos) aparecem no feed. Canceladas não.
    //
    // O filtro por `tipo` não é detalhe: sem ele as SESSÕES PRIVADAS de todo
    // mundo apareciam aqui como se fossem partidas abertas, com botão de
    // entrar. O feed é anterior à sessão privada existir e nunca foi relido.
    supabase
      .from("partidas")
      .select(
        "id, categoria_min, categoria_max, competitiva, sexo_jogo, max_jogadores, status, organizador_id, inicio, fim, quadras ( nome, clubes ( id, nome, cidade ) ), partida_jogadores ( jogador_id, papel, estado )"
      )
      .eq("tipo", "aberta")
      .in("status", ["aberta", "completa"])
      .order("inicio", { ascending: true }),
  ]);

  if (!jogador) redirect("/app/onboarding");
  if (!jogador.sexo) redirect("/app/completar-perfil");

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Partidas abertas
          </h1>
          <Link
            href="/app"
            className="text-sm font-medium text-tinta-suave hover:text-tinta"
          >
            ← Início
          </Link>
        </div>

        <AbasPartidas atual="abertas" />

        <FeedPartidas
          partidas={JSON.parse(JSON.stringify(partidas ?? [])) as PartidaFeed[]}
          meuId={user.id}
          minhaCategoria={jogador.categoria}
          meuSexo={jogador.sexo}
        />
      </div>
    </main>
  );
}
