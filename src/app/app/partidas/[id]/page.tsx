import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { PartidaDetalhe } from "@/components/partidas/PartidaDetalhe";
import { ConvidarParticipantes } from "@/components/partidas/ConvidarParticipantes";
import { SetsDaSessao } from "@/components/partidas/SetsDaSessao";
import { statusDaPartida, partidaComecou } from "@/lib/partidas";

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
      "id, tipo, categoria_min, categoria_max, competitiva, sexo_jogo, max_jogadores, status, organizador_id, inicio, fim, preco_centavos, quadras ( nome, clubes ( id, nome, cidade ) ), partida_jogadores ( jogador_id, papel, ordem, estado )"
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

  // Se já estou na partida, "voltar" leva para Minhas partidas; senão, para
  // o feed de partidas abertas (regra do fundador).
  const estouNaPartida = jogadores.some((j) => j.jogador_id === user.id);
  const voltarHref = estouNaPartida ? "/app/partidas/minhas" : "/app/partidas";
  const voltarLabel = estouNaPartida
    ? "← Minhas partidas"
    : "← Partidas abertas";

  // Depois que começa, não há mais ações; depois que termina, é "jogada".
  const jaComecou = partidaComecou(partida.inicio);
  const jaAconteceu = statusDaPartida(partida.fim) === "jogada";

  // Sessão privada não tem faixa de categoria nem sexo do jogo — o
  // organizador escolhe pessoa por pessoa. Por isso ela tem tela própria,
  // em vez de reaproveitar a da partida aberta com campos vazios.
  if (partida.tipo === "privada") {
    // O tipo que o Supabase infere para a junção aninhada vem como lista;
    // na prática é um registro só.
    const local = partida.quadras as unknown as {
      nome: string;
      clubes: { id: string; nome: string; cidade: string };
    };

    const { data: setsRaw } = await supabase
      .from("sets")
      .select(
        "id, ordem, a1, a2, b1, b2, games_a, games_b, registrado_por, registrado_em"
      )
      .eq("partida_id", partida.id)
      .order("ordem", { ascending: true });

    const setIds = (setsRaw ?? []).map((s) => s.id);

    const { data: contestacoes } = setIds.length
      ? await supabase
          .from("set_contestacoes")
          .select("set_id, contestado_por, games_a, games_b")
          .in("set_id", setIds)
      : { data: [] };

    const { data: meusVotos } = setIds.length
      ? await supabase
          .from("set_votos")
          .select("set_id, voto")
          .in("set_id", setIds)
          .eq("votante_id", user.id)
      : { data: [] };

    // A situação de cada set (qual placar vale e se conta) é calculada no
    // servidor — não replico a regra aqui para as duas não divergirem.
    const situacoes = await Promise.all(
      setIds.map((sid) => supabase.rpc("situacao_do_set", { p_set_id: sid }))
    );
    const { data: teto } = await supabase.rpc("teto_de_sets", {
      p_partida_id: partida.id,
    });

    const sets = (setsRaw ?? []).map((s, i) => {
      const c = (contestacoes ?? []).find((x) => x.set_id === s.id) ?? null;
      const v = (meusVotos ?? []).find((x) => x.set_id === s.id) ?? null;
      const sit = (situacoes[i]?.data ?? [])[0] ?? null;
      return {
        ...s,
        contestacao: c
          ? {
              contestado_por: c.contestado_por,
              games_a: c.games_a,
              games_b: c.games_b,
            }
          : null,
        meuVoto: v?.voto ?? null,
        situacao: {
          games_a: sit?.games_a ?? s.games_a,
          games_b: sit?.games_b ?? s.games_b,
          conta: sit?.conta_para_rating ?? false,
          motivo: sit?.motivo ?? "AGUARDANDO_JANELA",
        },
      };
    });

    const aceitos = jogadores
      .filter((j) => j.estado === "aceito" && j.perfil)
      .map((j) => ({ id: j.jogador_id, nome: j.perfil!.nome }));
    const quando = new Date(partida.inicio).toLocaleString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
        <div className="mx-auto w-full max-w-md">
          <Link
            href={voltarHref}
            className="text-sm font-medium text-tinta-suave hover:text-tinta"
          >
            {voltarLabel}
          </Link>

          <h1 className="mt-4 font-display text-2xl font-extrabold text-tinta">
            {local.clubes.nome}
          </h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {local.nome} · {quando}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-superficie px-3 py-1 text-xs font-bold text-tinta-suave ring-1 ring-black/5">
              🔒 Jogo entre convidados
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                partida.competitiva
                  ? "bg-primaria/10 text-primaria"
                  : "bg-fundo text-tinta-suave ring-1 ring-black/5"
              }`}
            >
              {partida.competitiva ? "Vale rating" : "Amistoso"}
            </span>
          </div>

          <ConvidarParticipantes
            partidaId={partida.id}
            meuId={user.id}
            souOrganizador={partida.organizador_id === user.id}
            jaComecou={jaComecou}
            participantes={JSON.parse(
              JSON.stringify(
                jogadores.map((j) => ({
                  jogador_id: j.jogador_id,
                  estado: j.estado,
                  papel: j.papel,
                  perfil: j.perfil,
                }))
              )
            )}
          />

          <SetsDaSessao
            partidaId={partida.id}
            meuId={user.id}
            jaComecou={jaComecou}
            passaram15Min={
              new Date(partida.inicio).getTime() + 15 * 60 * 1000 <=
              new Date().getTime()
            }
            participantes={aceitos}
            sets={JSON.parse(JSON.stringify(sets))}
            teto={teto ?? 1}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link
          href={voltarHref}
          className="text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          {voltarLabel}
        </Link>
        <PartidaDetalhe
          partida={JSON.parse(JSON.stringify({ ...partida, jogadores }))}
          meuId={user.id}
          jaComecou={jaComecou}
          jaAconteceu={jaAconteceu}
        />
      </div>
    </main>
  );
}
