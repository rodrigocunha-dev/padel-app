import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { MinhasPartidas } from "@/components/partidas/MinhasPartidas";
import { AbasPartidas } from "@/components/partidas/AbasPartidas";
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

export default async function PaginaMinhasPartidas({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro } = await searchParams;
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
      "papel, estado, partidas ( id, tipo, inicio, fim, preco_centavos, status, quadras ( nome, clubes ( nome, cidade ) ) )"
    )
    .eq("jogador_id", user.id)
    .eq("papel", "jogador")
    // Convite pendente NÃO é participação: sem este filtro, um convite que
    // você ainda não aceitou apareceria como se já estivesse jogando.
    .eq("estado", "aceito");

  // Convites esperando resposta, que viram um bloco próprio no topo.
  const { data: convitesRaw } = await supabase
    .from("partida_jogadores")
    .select(
      "partidas ( id, inicio, status, quadras ( nome, clubes ( nome ) ) )"
    )
    .eq("jogador_id", user.id)
    .eq("estado", "convidado");

  const convites = (convitesRaw ?? [])
    .map(
      (c) =>
        c.partidas as unknown as {
          id: string;
          inicio: string;
          status: string;
          quadras: { nome: string; clubes: { nome: string } };
        } | null
    )
    .filter((p) => !!p && p.status !== "cancelada");

  // Avisos ainda não lidos (resultado registrado, votação aberta).
  const { data: avisosRaw } = await supabase
    .from("avisos")
    .select("id, tipo, sets ( partida_id )")
    .eq("jogador_id", user.id)
    .is("lido_em", null);

  const avisos = (avisosRaw ?? []).map((a) => ({
    id: a.id,
    tipo: a.tipo,
    partidaId:
      (a.sets as unknown as { partida_id: string } | null)?.partida_id ?? null,
  }));

  // Meus pagamentos (para saber o que está pago).
  const { data: pagos } = await supabase
    .from("pagamentos")
    .select("partida_id, status")
    .eq("jogador_id", user.id)
    .eq("status", "pago");
  const pagouSet = new Set((pagos ?? []).map((p) => p.partida_id));

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
        statusPartida: statusDaPartida(part.fim),
        statusPagamento: statusDoPagamento(part.fim, pagouSet.has(part.id)),
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

        <AbasPartidas atual="minhas" />

        {/* O aviso dentro do app existe sempre — é o que torna justo o
            "quem não contestar em 24h concordou". */}
        {avisos.length > 0 && (
          <ul className="mt-4 space-y-2">
            {avisos.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.partidaId ? `/app/partidas/${a.partidaId}` : "#"}
                  className="block rounded-2xl bg-amber-100 p-4 shadow ring-1 ring-amber-200 transition hover:brightness-105"
                >
                  <p className="font-display text-sm font-bold text-amber-800">
                    {a.tipo === "votacao_aberta"
                      ? "🗳️ Há um placar em disputa — seu voto decide"
                      : "📋 Registraram um resultado do seu jogo"}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800/80">
                    {a.tipo === "votacao_aberta"
                      ? "Você estava lá. Toque para dizer qual placar está certo."
                      : "Confira. Se não estiver certo, você tem 24h para contestar."}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {convites.length > 0 && (
          <section className="mt-4">
            <h2 className="font-display text-base font-bold text-tinta">
              Convites esperando você
            </h2>
            <ul className="mt-2 space-y-2">
              {convites.map((c) => (
                <li key={c!.id}>
                  <Link
                    href={`/app/partidas/${c!.id}`}
                    className="block rounded-2xl bg-destaque p-4 shadow transition hover:brightness-105"
                  >
                    <p className="font-display font-bold text-destaque-tinta">
                      {c!.quadras.clubes.nome}
                    </p>
                    <p className="mt-0.5 text-xs text-destaque-tinta/80">
                      {c!.quadras.nome} ·{" "}
                      {new Date(c!.inicio).toLocaleString("pt-BR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · toque para aceitar ou recusar
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <MinhasPartidas
          itens={itens}
          filtroInicial={
            filtro === "inadimplente" || filtro === "aguardando"
              ? filtro
              : undefined
          }
        />
      </div>
    </main>
  );
}
