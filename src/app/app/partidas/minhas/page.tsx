import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { MinhasPartidas } from "@/components/partidas/MinhasPartidas";
import {
  statusDaPartida,
  statusDoPagamento,
  type StatusPartida,
  type StatusPagamento,
} from "@/lib/partidas";

export const metadata: Metadata = {
  title: "Minhas partidas — padel",
};

export type ItemMinhaPartida = {
  id: string;
  clube: string;
  cidade: string;
  quadra: string;
  inicio: string;
  fim: string;
  preco_centavos: number | null;
  statusPartida: StatusPartida;
  statusPagamento: StatusPagamento;
};

export default async function PaginaMinhasPartidas() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  // Partidas em que sou/fui JOGADOR ativo (substituto que nunca jogou não
  // entra aqui). O nome do clube/quadra vem embutido; a partida carrega os
  // próprios dados públicos (script 009).
  const { data: vinculos } = await supabase
    .from("partida_jogadores")
    .select(
      "papel, partidas ( id, inicio, fim, preco_centavos, status, quadras ( nome, clubes ( nome, cidade ) ) )"
    )
    .eq("jogador_id", user.id)
    .eq("papel", "jogador");

  // Meus pagamentos (para saber o que está pago).
  const { data: pagos } = await supabase
    .from("pagamentos")
    .select("partida_id, status")
    .eq("jogador_id", user.id)
    .eq("status", "pago");
  const pagouSet = new Set((pagos ?? []).map((p) => p.partida_id));

  const agora = Date.now();
  const itens: ItemMinhaPartida[] = (vinculos ?? [])
    .map((v) => v.partidas as unknown)
    .filter(
      (p): p is NonNullable<typeof p> => !!p && (p as { status: string }).status !== "cancelada"
    )
    .map((p) => {
      const part = p as {
        id: string;
        inicio: string;
        fim: string;
        preco_centavos: number | null;
        quadras: { nome: string; clubes: { nome: string; cidade: string } };
      };
      return {
        id: part.id,
        clube: part.quadras.clubes.nome,
        cidade: part.quadras.clubes.cidade,
        quadra: part.quadras.nome,
        inicio: part.inicio,
        fim: part.fim,
        preco_centavos: part.preco_centavos,
        statusPartida: statusDaPartida(part.fim, agora),
        statusPagamento: statusDoPagamento(
          part.fim,
          pagouSet.has(part.id),
          agora
        ),
      };
    })
    .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Minhas partidas
          </h1>
          <Link
            href="/app"
            className="text-sm font-medium text-tinta-suave hover:text-tinta"
          >
            ← Início
          </Link>
        </div>

        <MinhasPartidas itens={itens} />
      </div>
    </main>
  );
}
