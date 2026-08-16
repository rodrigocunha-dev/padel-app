import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  criarClienteServidor,
  perfilAtual,
  usuarioAtual,
} from "@/lib/supabase/server";
import { Descobrir } from "@/components/mapa/Descobrir";
import type { ClubeDescoberta } from "@/lib/descoberta";

export const metadata: Metadata = {
  title: "Descobrir clubes — padel",
};

export default async function PaginaDescobrir({
  searchParams,
}: {
  searchParams: Promise<{ agora?: string }>;
}) {
  const { agora } = await searchParams;
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual();
  if (!user) redirect("/entrar");

  // ⚡ Os clubes do mapa não têm nada a ver com o meu perfil, então saem
  // juntos. E a cidade (usada no filtro "só na minha cidade") já veio no
  // layout: `perfilAtual` devolve o de lá sem ir ao banco de novo.
  const [{ data: clubes }, jogador] = await Promise.all([
    // Só clubes com localização definida aparecem no mapa.
    supabase
      .from("clubes")
      .select(
        "id, nome, cidade, latitude, longitude, telefone, quadras ( id, esporte, tipo, coberta, quadra_precos ( dias, hora_inicio, hora_fim, preco_centavos ) )"
      )
      .not("latitude", "is", null)
      .not("longitude", "is", null),

    perfilAtual(user.id),
  ]);

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="font-display text-xl font-extrabold text-tinta">
          Descobrir clubes
        </h1>
        <Link
          href="/app"
          className="text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          ← Início
        </Link>
      </header>
      <Descobrir
        clubes={(clubes ?? []) as ClubeDescoberta[]}
        minhaCidade={jogador?.cidade ?? null}
        agoraInicial={agora === "1"}
      />
    </main>
  );
}
