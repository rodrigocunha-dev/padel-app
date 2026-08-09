import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { PartidaDetalhe } from "@/components/partidas/PartidaDetalhe";
import { ConvidarParticipantes } from "@/components/partidas/ConvidarParticipantes";
import { SetsDaSessao } from "@/components/partidas/SetsDaSessao";
import { PagamentoPartida } from "@/components/partidas/PagamentoPartida";
import { MarcarAvisosLidos } from "@/components/partidas/MarcarAvisosLidos";
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
      "id, tipo, categoria_min, categoria_max, competitiva, sexo_jogo, max_jogadores, status, organizador_id, inicio, fim, preco_centavos, quadras ( nome, clubes ( id, nome, cidade ) ), partida_jogadores ( jogador_id, papel, ordem, estado, desistiu_em )"
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

  // Quem joga de verdade: aceitou E ocupa vaga. O `papel` importa na partida
  // aberta, onde existe fila de substitutos — quem está na fila não entrou em
  // quadra, então não registra set, não aparece num set e não vota.
  const aceitos = jogadores
    .filter((j) => j.papel === "jogador" && j.estado === "aceito" && j.perfil)
    .map((j) => ({ id: j.jogador_id, nome: j.perfil!.nome }));

  // ============================================================
  // SETS — carregados para os DOIS tipos de partida
  // ============================================================
  // Desde 08/08/2026 a unidade do rating é sempre o set, em qualquer
  // contexto (regra nº 5). Antes disto a área de sets só existia na sessão
  // privada, e a partida aberta não gravava resultado nenhum — o que deixava
  // o motor de rating sem fonte de dado justamente para o jogo entre
  // desconhecidos, que é o que mais interessa medir.
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

  // As duas telas mostram a mesma área de sets, com as mesmas travas.
  const areaDeSets = (
    <SetsDaSessao
      partidaId={partida.id}
      meuId={user.id}
      jaComecou={jaComecou}
      passaram15Min={
        new Date(partida.inicio).getTime() + 15 * 60 * 1000 <=
        new Date().getTime()
      }
      dentroDaJanela={
        new Date().getTime() <=
        new Date(partida.fim).getTime() + 24 * 60 * 60 * 1000
      }
      participantes={aceitos}
      sets={JSON.parse(JSON.stringify(sets))}
      teto={teto ?? 1}
    />
  );

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

    // O divisor vem do servidor: mínimo 4 e congelado no 1º pagamento.
    // A tela não recalcula por conta própria — foi assim que a conta de
    // quem já tinha pago mudou sozinha no teste.
    const { data: divisor } = await supabase.rpc("divisor_da_partida", {
      p_partida_id: partida.id,
    });

    // A divisão do valor vale para a sessão igual à partida aberta: a quadra
    // é paga do mesmo jeito. Onde ela aparece na tela depende de eu já ter
    // pago ou não — devendo, ela vem antes de tudo.
    const { data: pagamentosDaPartida } = await supabase
      .from("pagamentos")
      .select("jogador_id, status")
      .eq("partida_id", partida.id);

    const jaPagaram = (pagamentosDaPartida ?? [])
      .filter((p) => p.status === "pago")
      .map((p) => p.jogador_id);

    const euPaguei = jaPagaram.includes(user.id);
    const mostrarPagamento =
      partida.status !== "cancelada" &&
      (partida.preco_centavos ?? 0) > 0 &&
      jogadores.some((j) => j.jogador_id === user.id && j.estado === "aceito");

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
          {/* Chegou no jogo → os avisos DESTE jogo já cumpriram o papel. */}
          <MarcarAvisosLidos setIds={setIds} />

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

          {/* Se EU ainda não paguei, a divisão sobe para antes de tudo:
              quem chega aqui por um aviso de cobrança quer pagar, e não
              deve ter que rolar a tela para achar o botão. */}
          {mostrarPagamento && !euPaguei && (
            <PagamentoPartida
              partidaId={partida.id}
              meuId={user.id}
              souOrganizador={partida.organizador_id === user.id}
              totalCentavos={partida.preco_centavos ?? 0}
              maxJogadores={divisor ?? Math.max(4, aceitos.length)}
              jogadores={aceitos.map((p) => ({
                jogador_id: p.id,
                nome: p.nome,
                ehOrganizador: p.id === partida.organizador_id,
              }))}
              resumoPartida={`${local.nome}, ${quando}`}
            />
          )}

          <ConvidarParticipantes
            partidaId={partida.id}
            meuId={user.id}
            souOrganizador={partida.organizador_id === user.id}
            jaComecou={jaComecou}
            participantes={JSON.parse(
              JSON.stringify(
                jogadores
                  // Quem foi substituído sai da lista: não está mais no jogo.
                  .filter((j) => j.estado !== "saiu")
                  .map((j) => ({
                    jogador_id: j.jogador_id,
                    estado: j.estado,
                    papel: j.papel,
                    desistiu_em: j.desistiu_em,
                    perfil: j.perfil,
                  }))
              )
            )}
            jaPagaram={jaPagaram}
          />

          {/* Já paguei: a divisão fica aqui embaixo, como informação de
              quem falta — não é mais uma ação minha. */}
          {mostrarPagamento && euPaguei && (
              <PagamentoPartida
                partidaId={partida.id}
                meuId={user.id}
                souOrganizador={partida.organizador_id === user.id}
                totalCentavos={partida.preco_centavos ?? 0}
                maxJogadores={divisor ?? Math.max(4, aceitos.length)}
                jogadores={aceitos.map((p) => ({
                  jogador_id: p.id,
                  nome: p.nome,
                  ehOrganizador: p.id === partida.organizador_id,
                }))}
                resumoPartida={`${local.nome}, ${quando}`}
              />
            )}

          {areaDeSets}
        </div>
      </main>
    );
  }

  // Partida aberta. A área de sets é a mesma da sessão privada, e só aparece
  // para quem está jogando: substituto na fila não registra nem vota, e quem
  // só visita a partida não tem o que registrar.
  const souJogador = aceitos.some((p) => p.id === user.id);

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        {/* Chegou no jogo → os avisos DESTE jogo já cumpriram o papel. */}
        <MarcarAvisosLidos setIds={setIds} />

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

        {/* Amistosa também registra set: o resultado entra no histórico e na
            gamificação, e só não encosta no rating. Quem decide isso é o
            servidor (`situacao_do_set`), não esta tela. */}
        {souJogador && areaDeSets}
      </div>
    </main>
  );
}
