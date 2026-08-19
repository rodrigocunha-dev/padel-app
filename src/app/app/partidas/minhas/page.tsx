import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor, usuarioAtual } from "@/lib/supabase/server";
import { MinhasPartidas } from "@/components/partidas/MinhasPartidas";
import { AbasPartidas } from "@/components/partidas/AbasPartidas";
import { AvisosPendentes } from "@/components/partidas/AvisosPendentes";
import { BlocoNaFila } from "@/components/partidas/BlocoNaFila";
import { minhaFila } from "@/lib/fila";
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
  naoLidas: number;
};

export default async function PaginaMinhasPartidas({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro } = await searchParams;
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual();
  if (!user) redirect("/entrar");

  // ⚡ Todas juntas, e não uma esperando a outra: nenhuma depende do
  // resultado da anterior. Mesmo motivo e mesma correção da Início.
  const [
    { data: vinculos },
    { data: convitesRaw },
    { data: avisosRaw },
    fila,
    naoLidasRpc,
    { data: pagos },
  ] = await Promise.all([
    // Partidas em que sou/fui JOGADOR ativo (substituto que nunca jogou não
    // entra aqui). O nome do clube/quadra vem embutido; a partida carrega os
    // próprios dados públicos (script 009).
    supabase
      .from("partida_jogadores")
      .select(
        "papel, estado, partidas ( id, tipo, inicio, fim, preco_centavos, status, quadras ( nome, clubes ( nome, cidade ) ) )"
      )
      .eq("jogador_id", user.id)
      .eq("papel", "jogador")
      // Convite pendente NÃO é participação: sem este filtro, um convite que
      // você ainda não aceitou apareceria como se já estivesse jogando.
      .eq("estado", "aceito"),

    // Convites esperando resposta, que viram um bloco próprio no topo.
    supabase
      .from("partida_jogadores")
      .select(
        "partidas ( id, inicio, status, quadras ( nome, clubes ( nome ) ) )"
      )
      .eq("jogador_id", user.id)
      .eq("estado", "convidado"),

    // Avisos ainda não lidos (resultado registrado, votação aberta).
    // A partida vem direto do aviso (script 032): o aviso de promoção não tem
    // set, e pelo caminho antigo ficaria sem para onde apontar.
    supabase
      .from("avisos")
      .select(
        "id, tipo, partida_id, clube_id, clubes ( nome ), partidas ( inicio, quadras ( clubes ( nome ) ) ), sets ( ordem, games_a, games_b )"
      )
      .eq("jogador_id", user.id)
      .is("lido_em", null),

    minhaFila(user.id),

    // Mensagens que eu ainda nao li, por partida. Uma consulta so para a
    // lista inteira - ver meus_nao_lidos no script 041.
    supabase.rpc("meus_nao_lidos"),

    // Meus pagamentos (para saber o que está pago).
    supabase
      .from("pagamentos")
      .select("partida_id, status")
      .eq("jogador_id", user.id)
      .eq("status", "pago"),
  ]);

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

  const avisos = (avisosRaw ?? []).map((a) => {
    const p = a.partidas as unknown as {
      inicio: string;
      quadras: { clubes: { nome: string } };
    } | null;
    const s = a.sets as unknown as {
      ordem: number;
      games_a: number;
      games_b: number;
    } | null;
    const nome = p
      ? `${p.quadras.clubes.nome} · ${new Date(p.inicio).toLocaleDateString(
          "pt-BR",
          { day: "2-digit", month: "2-digit" }
        )}`
      : null;
    const setRotulo = s ? `Set ${s.ordem} · ${s.games_a}x${s.games_b}` : null;
    return {
      id: a.id,
      tipo: a.tipo,
      partidaId: a.partida_id ?? null,
      clubeId: a.clube_id ?? null,
      clubeNome: (a.clubes as unknown as { nome: string } | null)?.nome ?? null,
      partidaNome: nome,
      setRotulo,
    };
  });

  const pagouSet = new Set((pagos ?? []).map((p) => p.partida_id));

  const naoLidasPorPartida = new Map(
    ((naoLidasRpc?.data ?? []) as { partida_id: string; nao_lidas: number }[]).map(
      (n) => [n.partida_id, Number(n.nao_lidas)]
    )
  );

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
        naoLidas: naoLidasPorPartida.get(part.id) ?? 0,
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
        <AvisosPendentes avisos={avisos} />

        {/* Fila em bloco próprio: estar na fila não é ter jogo, e por isso
            não entra na lista abaixo nem nos filtros de status/pagamento. */}
        <BlocoNaFila itens={fila} />

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
