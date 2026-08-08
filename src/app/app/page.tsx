import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { AvisosPendentes } from "@/components/partidas/AvisosPendentes";
import {
  ROTULO_NIVEL,
  statusDaPartida,
  statusDoPagamento,
} from "@/lib/partidas";

export const metadata: Metadata = {
  title: "Início — padel",
};

// Um item da lista "seus próximos jogos". Reserva e partida aparecem
// juntas porque, para o jogador, as duas são "meu próximo jogo" — mas
// continuam sendo coisas diferentes no banco. Isto é só apresentação.
type ProximoJogo = {
  chave: string;
  href: string;
  etiqueta: string;
  clube: string;
  quadra: string;
  inicio: string;
};

function formatarQuando(inicio: string): string {
  const d = new Date(inicio);
  return (
    d.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    }) +
    " · " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

export default async function PaginaApp() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O proxy garante que só chega aqui logado, mas o TypeScript não sabe.
  if (!user) return null;

  const { data: jogador } = await supabase
    .from("jogadores")
    .select("nome, foto_url, categoria, nivel_categoria, em_calibracao, sexo")
    .eq("id", user.id)
    .maybeSingle();

  // Logou mas ainda não tem perfil → onboarding.
  if (!jogador) redirect("/app/onboarding");

  // Perfil criado antes do campo "sexo" existir → completar antes de seguir.
  if (!jogador.sexo) redirect("/app/completar-perfil");

  // Partidas em que sou jogador ativo (substituto não conta).
  const { data: vinculos } = await supabase
    .from("partida_jogadores")
    .select(
      "partidas ( id, reserva_id, inicio, fim, status, quadras ( nome, clubes ( nome ) ) )"
    )
    .eq("jogador_id", user.id)
    .eq("papel", "jogador")
    // Convite pendente NÃO é jogo seu: sem este filtro, um convite que você
    // ainda não aceitou apareceria entre os "próximos jogos".
    .eq("estado", "aceito");

  // Convites esperando resposta — bloco próprio, porque é uma AÇÃO pendente,
  // não um compromisso já marcado.
  const { data: convitesRaw } = await supabase
    .from("partida_jogadores")
    .select("partidas ( id, inicio, status, quadras ( clubes ( nome ) ) )")
    .eq("jogador_id", user.id)
    .eq("estado", "convidado");

  // Avisos ainda não lidos — os mesmos de Minhas partidas, mesma consulta.
  const { data: avisosRaw } = await supabase
    .from("avisos")
    .select(
      "id, tipo, sets ( partida_id, partidas ( quadras ( clubes ( nome ) ), inicio ) )"
    )
    .eq("jogador_id", user.id)
    .is("lido_em", null);

  const avisos = (avisosRaw ?? []).map((a) => {
    const s = a.sets as unknown as {
      partida_id: string;
      partidas: { inicio: string; quadras: { clubes: { nome: string } } } | null;
    } | null;
    const nome = s?.partidas
      ? `${s.partidas.quadras.clubes.nome} · ${new Date(
          s.partidas.inicio
        ).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
      : null;
    return { id: a.id, tipo: a.tipo, partidaId: s?.partida_id ?? null, partidaNome: nome };
  });

  const convites = (convitesRaw ?? [])
    .map(
      (c) =>
        c.partidas as unknown as {
          id: string;
          inicio: string;
          status: string;
          quadras: { clubes: { nome: string } };
        } | null
    )
    .filter((p) => !!p && p.status !== "cancelada");

  const { data: pagos } = await supabase
    .from("pagamentos")
    .select("partida_id, status")
    .eq("jogador_id", user.id)
    .eq("status", "pago");
  const pagouSet = new Set((pagos ?? []).map((p) => p.partida_id));

  const partidas = (vinculos ?? [])
    .map((v) => v.partidas as unknown)
    .filter(
      (p): p is NonNullable<typeof p> =>
        !!p && (p as { status: string }).status !== "cancelada"
    )
    .map(
      (p) =>
        p as {
          id: string;
          reserva_id: string;
          inicio: string;
          fim: string;
          quadras: { nome: string; clubes: { nome: string } };
        }
    );

  // Pendência de pagamento só existe em partida que JÁ aconteceu.
  const jogadas = partidas.filter((p) => statusDaPartida(p.fim) === "jogada");
  const inadimplentes = jogadas.filter(
    (p) => statusDoPagamento(p.fim, pagouSet.has(p.id)) === "inadimplente"
  ).length;
  const aguardando = jogadas.filter(
    (p) => statusDoPagamento(p.fim, pagouSet.has(p.id)) === "aguardando"
  ).length;

  // Minhas reservas futuras.
  const { data: reservas } = await supabase
    .from("reservas")
    .select("id, inicio, quadras ( nome, clubes ( nome ) )")
    .eq("jogador_id", user.id)
    .eq("status", "confirmada")
    .gte("fim", new Date().toISOString())
    .order("inicio", { ascending: true });

  // A reserva que existe POR BAIXO de uma partida minha é descartada aqui:
  // quem cria partida aberta também vira dono da reserva, e sem isto o
  // mesmo jogo apareceria duas vezes na lista.
  const reservasDePartida = new Set(partidas.map((p) => p.reserva_id));

  const proximos: ProximoJogo[] = [
    ...partidas
      .filter((p) => statusDaPartida(p.fim) === "futura")
      .map((p) => ({
        chave: `partida-${p.id}`,
        href: `/app/partidas/${p.id}`,
        etiqueta: "Partida",
        clube: p.quadras.clubes.nome,
        quadra: p.quadras.nome,
        inicio: p.inicio,
      })),
    ...(reservas ?? [])
      .map(
        (r) =>
          r as unknown as {
            id: string;
            inicio: string;
            quadras: { nome: string; clubes: { nome: string } };
          }
      )
      .filter((r) => !reservasDePartida.has(r.id))
      .map((r) => ({
        chave: `reserva-${r.id}`,
        href: "/app/reservas",
        etiqueta: "Reserva",
        clube: r.quadras.clubes.nome,
        quadra: r.quadras.nome,
        inicio: r.inicio,
      })),
  ]
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())
    .slice(0, 4);

  // Clube da reserva mais recente — alimenta o atalho "Reservar".
  // Quando favoritar clubes existir, troca a fonte e o atalho melhora.
  const { data: ultima } = await supabase
    .from("reservas")
    .select("quadras ( clubes ( id, nome ) )")
    .eq("jogador_id", user.id)
    .eq("status", "confirmada")
    .order("inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  const clubeRecente =
    (
      ultima as unknown as {
        quadras?: { clubes?: { id: string; nome: string } };
      } | null
    )?.quadras?.clubes ?? null;

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center gap-3">
          {jogador.foto_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={jogador.foto_url}
              alt=""
              className="h-11 w-11 rounded-full object-cover ring-2 ring-primaria/30"
            />
          )}
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Olá, {jogador.nome.split(" ")[0]}!
          </h1>
        </header>

        <div className="mt-6 rounded-2xl bg-superficie p-6 shadow-lg ring-1 ring-black/5">
          <p className="text-sm text-tinta-suave">Sua categoria</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-primaria">
            {jogador.categoria}ª{" "}
            <span className="text-lg font-bold text-tinta-suave">
              {ROTULO_NIVEL[jogador.nivel_categoria] ?? jogador.nivel_categoria}
            </span>
          </p>
          {jogador.em_calibracao && (
            <span className="mt-3 inline-block rounded-full bg-destaque px-3 py-1 text-xs font-bold text-destaque-tinta">
              ⚖️ Em calibração
            </span>
          )}
        </div>

        {/* Inadimplente é o caso urgente: bloqueia reservar e entrar em jogo. */}
        {inadimplentes > 0 ? (
          <Link
            href="/app/partidas/minhas"
            className="mt-4 block rounded-2xl bg-red-100 p-5 shadow-lg ring-1 ring-red-200 transition hover:brightness-105"
          >
            <p className="font-display text-base font-bold text-red-700">
              ⚠️{" "}
              {inadimplentes === 1
                ? "Você tem 1 jogo não pago"
                : `Você tem ${inadimplentes} jogos não pagos`}
            </p>
            <p className="mt-1 text-sm text-red-700/80">
              Enquanto não pagar, não dá para reservar quadra nem entrar em
              partidas. Toque para acertar.
            </p>
          </Link>
        ) : (
          aguardando > 0 && (
            <Link
              href="/app/partidas/minhas"
              className="mt-4 block rounded-2xl bg-amber-100 p-5 shadow-lg ring-1 ring-amber-200 transition hover:brightness-105"
            >
              <p className="font-display text-base font-bold text-amber-800">
                💸{" "}
                {aguardando === 1
                  ? "1 pagamento a acertar"
                  : `${aguardando} pagamentos a acertar`}
              </p>
              <p className="mt-1 text-sm text-amber-800/80">
                Toque para ver e pagar sua parte
              </p>
            </Link>
          )
        )}

        {/* Os avisos também vivem aqui, e não só em Minhas partidas: eles
            têm prazo de 24h, e a tela inicial é onde a pessoa cai. Sem
            isto, "quem não contestar concordou" dependia de ela ir
            procurar — o oposto do que a regra pretende. */}
        <AvisosPendentes avisos={avisos} />

        {convites.length > 0 && (
          <section className="mt-4">
            <h2 className="font-display text-base font-bold text-tinta">
              {convites.length === 1
                ? "Você tem um convite"
                : `Você tem ${convites.length} convites`}
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
                      {formatarQuando(c!.inicio)} · toque para aceitar ou
                      recusar
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href="/app/descobrir?agora=1"
            className="rounded-2xl bg-primaria p-5 shadow-lg transition hover:brightness-110"
          >
            <p className="font-display text-base font-bold text-white">
              ⚡ Jogar agora
            </p>
            <p className="mt-1 text-xs text-white/80">
              Quadras livres nas próximas 3h
            </p>
          </Link>

          <Link
            href={
              clubeRecente
                ? `/app/clubes/${clubeRecente.id}/reservar`
                : "/app/descobrir"
            }
            className="rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
          >
            <p className="font-display text-base font-bold text-tinta">
              🎾 Reservar
            </p>
            <p className="mt-1 truncate text-xs text-tinta-suave">
              {clubeRecente ? clubeRecente.nome : "Escolher no mapa"}
            </p>
          </Link>
        </div>

        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-tinta">
            Seus próximos jogos
          </h2>

          {proximos.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-superficie p-5 text-sm text-tinta-suave shadow-lg ring-1 ring-black/5">
              Nenhum jogo marcado. Entre numa partida aberta ou reserve uma
              quadra pelos atalhos acima.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {proximos.map((jogo) => (
                <li key={jogo.chave}>
                  <Link
                    href={jogo.href}
                    className="block rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display text-base font-bold text-tinta">
                        {jogo.clube}
                      </p>
                      <span className="shrink-0 rounded-full bg-fundo px-2.5 py-1 text-[11px] font-bold text-tinta-suave">
                        {jogo.etiqueta}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-tinta-suave">
                      {jogo.quadra} · {formatarQuando(jogo.inicio)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          href="/app/partidas"
          className="mt-6 block rounded-2xl bg-superficie p-5 text-center shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
        >
          <p className="font-display text-base font-bold text-tinta">
            👥 Ver partidas abertas
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            Entre em jogos do seu nível ou monte o seu
          </p>
        </Link>
      </div>
    </main>
  );
}
