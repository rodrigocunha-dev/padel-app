import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  criarClienteServidor,
  perfilAtual,
  usuarioAtual,
} from "@/lib/supabase/server";
import { PartidaDetalhe } from "@/components/partidas/PartidaDetalhe";
import { ConvidarParticipantes } from "@/components/partidas/ConvidarParticipantes";
import { SetsDaSessao } from "@/components/partidas/SetsDaSessao";
import { PagamentoPartida } from "@/components/partidas/PagamentoPartida";
import { MarcarAvisosLidos } from "@/components/partidas/MarcarAvisosLidos";
import { EditarPartidaAberta } from "@/components/partidas/EditarPartidaAberta";
import { ChatPartida } from "@/components/partidas/ChatPartida";
import { VagasNaSessao } from "@/components/partidas/VagasNaSessao";
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

  // ⚡ Esta tela tem dependências DE VERDADE — os nomes só podem ser buscados
  // depois que a partida diz quem são, e os votos dependem de quais sets
  // existem. Então aqui não dá para mandar tudo junto: o que dá é agrupar em
  // ondas, e não fazer uma consulta de cada vez. Eram nove passos em fila.
  //
  // ONDA 1 — tudo que só precisa do id que veio no endereço.
  const [user, { data: partida }, { data: setsRaw }, { data: teto }] =
    await Promise.all([
      usuarioAtual(),

      supabase
        .from("partidas")
        .select(
          "id, tipo, categoria_min, categoria_max, competitiva, sexo_jogo, max_jogadores, vagas_abertas, status, organizador_id, inicio, fim, preco_centavos, quadras ( nome, clubes ( id, nome, cidade ) ), partida_jogadores ( jogador_id, papel, ordem, estado, desistiu_em, entrou_pela_vaga )"
        )
        .eq("id", id)
        .maybeSingle(),

      // ============================================================
      // SETS — carregados para os DOIS tipos de partida
      // ============================================================
      // Desde 08/08/2026 a unidade do rating é sempre o set, em qualquer
      // contexto (regra nº 5). Antes disto a área de sets só existia na sessão
      // privada, e a partida aberta não gravava resultado nenhum — o que
      // deixava o motor de rating sem fonte de dado justamente para o jogo
      // entre desconhecidos, que é o que mais interessa medir.
      supabase
        .from("sets")
        .select(
          "id, ordem, a1, a2, b1, b2, games_a, games_b, registrado_por, registrado_em"
        )
        .eq("partida_id", id)
        .order("ordem", { ascending: true }),

      supabase.rpc("teto_de_sets", { p_partida_id: id }),
    ]);

  if (!user) redirect("/entrar");
  if (!partida) notFound();

  const setIds = (setsRaw ?? []).map((s) => s.id);

  // ONDA 2 — o que precisava saber quem joga e quais sets existem.
  const [
    { data: perfis },
    { data: contestacoes },
    { data: meusVotos },
    situacoes,
    { data: edicaoAberta },
  ] = await Promise.all([
      // Os nomes vêm à parte: partida_jogadores.jogador_id aponta para
      // auth.users, então não dá para juntar direto com a tabela jogadores.
      supabase
        .from("jogadores")
        .select("id, nome, foto_url, categoria")
        .in(
          "id",
          partida.partida_jogadores.map((j) => j.jogador_id)
        ),

      setIds.length
        ? supabase
            .from("set_contestacoes")
            .select("set_id, contestado_por, games_a, games_b")
            .in("set_id", setIds)
        : Promise.resolve({ data: [] }),

      setIds.length
        ? supabase
            .from("set_votos")
            .select("set_id, voto")
            .in("set_id", setIds)
            .eq("votante_id", user.id)
        : Promise.resolve({ data: [] }),

      // A situação de cada set (qual placar vale e se conta) é calculada no
      // servidor — não replico a regra aqui para as duas não divergirem.
      Promise.all(
        setIds.map((sid) => supabase.rpc("situacao_do_set", { p_set_id: sid }))
      ),

      // Mudança de partida esperando resposta. Uma por vez, garantido por
      // índice único no banco (script 040).
      supabase
        .from("partida_edicoes")
        .select(
          "id, proposta_por, categoria_min, categoria_max, competitiva, sexo_jogo, max_jogadores, partida_edicao_votos ( jogador_id )"
        )
        .eq("partida_id", id)
        .is("aplicada_em", null)
        .is("recusada_em", null)
        .is("cancelada_em", null)
        .maybeSingle(),
    ]);

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

  // Quem está DENTRO do jogo conversa. É a mesma regra que o servidor aplica
  // em `estou_na_conversa` (script 041) — a tela não decide nada por conta
  // própria, só evita desenhar o que o banco recusaria.
  const souParticipante = aceitos.some((p) => p.id === user.id);

  const areaDeChat = souParticipante ? (
    <ChatPartida partidaId={partida.id} meuId={user.id} participantes={aceitos} />
  ) : null;

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

    // ONDA 3 — só da sessão privada, e as três juntas.
    const [{ data: divisor }, { data: pagamentosDaPartida }, meuPerfil] =
      await Promise.all([
        // O divisor vem do servidor: mínimo 4 e congelado no 1º pagamento.
        // A tela não recalcula por conta própria — foi assim que a conta de
        // quem já tinha pago mudou sozinha no teste.
        supabase.rpc("divisor_da_partida", { p_partida_id: partida.id }),

        // A divisão do valor vale para a sessão igual à partida aberta: a
        // quadra é paga do mesmo jeito. Onde ela aparece na tela depende de eu
        // já ter pago ou não — devendo, ela vem antes de tudo.
        supabase
          .from("pagamentos")
          .select("jogador_id, status")
          .eq("partida_id", partida.id),

        // Só para sugerir a faixa de categoria quando o organizador for
        // anunciar uma vaga. Vem do cache do layout, sem ida ao banco.
        perfilAtual(user.id),
      ]);

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
          <MarcarAvisosLidos partidaId={partida.id} />

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
            {/* O cadeado vira porta quando o grupo anuncia vaga. É a única
                coisa na tela que diz, para quem chega de fora, que aquele
                jogo de grupo aceita gente nova. */}
            <span className="rounded-full bg-superficie px-3 py-1 text-xs font-bold text-tinta-suave ring-1 ring-black/5">
              {partida.vagas_abertas > 0
                ? `🔓 Grupo com ${partida.vagas_abertas === 1 ? "1 vaga" : `${partida.vagas_abertas} vagas`}`
                : "🔒 Jogo entre convidados"}
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

          <VagasNaSessao
            partidaId={partida.id}
            souOrganizador={partida.organizador_id === user.id}
            jaEstou={jogadores.some((j) => j.jogador_id === user.id)}
            entreiPelaVaga={jogadores.some(
              (j) => j.jogador_id === user.id && j.entrou_pela_vaga
            )}
            jaComecou={jaComecou}
            cancelada={partida.status === "cancelada"}
            vagasAbertas={partida.vagas_abertas ?? 0}
            categoriaMin={partida.categoria_min}
            categoriaMax={partida.categoria_max}
            sexoJogo={partida.sexo_jogo}
            minhaCategoria={meuPerfil?.categoria ?? null}
          />

          <ConvidarParticipantes
            partidaId={partida.id}
            meuId={user.id}
            souOrganizador={partida.organizador_id === user.id}
            jaComecou={jaComecou}
            nomeDoJogo={`${local.clubes.nome}, ${quando}`}
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

          {areaDeChat}
        </div>
      </main>
    );
  }

  // Partida aberta. A área de sets é a mesma da sessão privada, e só aparece
  // para quem está jogando: substituto na fila não registra nem vota, e quem
  // só visita a partida não tem o que registrar.
  const souJogador = aceitos.some((p) => p.id === user.id);

  const proposta = edicaoAberta
    ? {
        id: edicaoAberta.id,
        proposta_por: edicaoAberta.proposta_por,
        categoria_min: edicaoAberta.categoria_min,
        categoria_max: edicaoAberta.categoria_max,
        competitiva: edicaoAberta.competitiva,
        sexo_jogo: edicaoAberta.sexo_jogo,
        max_jogadores: edicaoAberta.max_jogadores,
        jaVotei: (
          (edicaoAberta.partida_edicao_votos ?? []) as { jogador_id: string }[]
        ).some((v) => v.jogador_id === user.id),
      }
    : null;

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        {/* Chegou no jogo → os avisos DESTE jogo já cumpriram o papel. */}
        <MarcarAvisosLidos partidaId={partida.id} />

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

        {/* Editar vem ANTES dos sets: mexer nas condições da partida é coisa
            de antes do jogo, e registrar set é de depois. */}
        <EditarPartidaAberta
          partidaId={partida.id}
          meuId={user.id}
          souOrganizador={partida.organizador_id === user.id}
          souJogador={souJogador}
          jaComecou={jaComecou}
          atual={{
            categoria_min: partida.categoria_min,
            categoria_max: partida.categoria_max,
            competitiva: partida.competitiva,
            sexo_jogo: partida.sexo_jogo,
            max_jogadores: partida.max_jogadores,
          }}
          proposta={proposta}
        />

        {/* Amistosa também registra set: o resultado entra no histórico e na
            gamificação, e só não encosta no rating. Quem decide isso é o
            servidor (`situacao_do_set`), não esta tela. */}
        {souJogador && areaDeSets}

        {areaDeChat}
      </div>
    </main>
  );
}
