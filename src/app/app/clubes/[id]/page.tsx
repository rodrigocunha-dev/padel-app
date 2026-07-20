import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { AvaliarClube } from "@/components/AvaliarClube";
import { ClubeMiniMapa } from "@/components/mapa/ClubeMiniMapa";
import { mascararTelefoneBr } from "@/lib/telefone";

export const metadata: Metadata = {
  title: "Clube — padel",
};

const ROTULO_ESPORTE: Record<string, string> = {
  padel: "Padel",
  beach_tennis: "Beach Tennis",
  tenis: "Tênis",
  futebol_society: "Futebol Society",
};

const ROTULO_TIPO: Record<string, string> = {
  vidro: "Vidro",
  alvenaria: "Alvenaria",
  areia: "Areia",
  saibro: "Saibro",
  grama: "Grama sintética",
};

const DIAS_ROTULO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatarReais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type FaixaHorario = { dias: number[]; hora_inicio: string; hora_fim: string };

// Horário de funcionamento derivado das faixas de preço de todas as
// quadras: o clube "abre" do início da faixa mais cedo ao fim da mais
// tarde de cada dia. Sem faixa no dia = fechado.
function horariosPorDia(faixas: FaixaHorario[]) {
  // Ordem de exibição: seg (1) ... dom (0)
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  return ordem.map((dia) => {
    const doDia = faixas.filter((f) => f.dias.includes(dia));
    if (doDia.length === 0) return { dia: DIAS_ROTULO[dia], horario: null };
    const abre = doDia.reduce(
      (min, f) => (f.hora_inicio < min ? f.hora_inicio : min),
      doDia[0].hora_inicio
    );
    const fecha = doDia.reduce(
      (max, f) => (f.hora_fim > max ? f.hora_fim : max),
      doDia[0].hora_fim
    );
    return {
      dia: DIAS_ROTULO[dia],
      horario: `${abre.slice(0, 5)}–${fecha.slice(0, 5)}`,
    };
  });
}

export default async function PaginaClubeJogador({
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

  const { data: clube } = await supabase
    .from("clubes")
    .select(
      "id, nome, cidade, endereco, telefone, latitude, longitude, clube_fotos ( id, url ), quadras ( id, nome, esporte, tipo, coberta, quadra_precos ( id, dias, hora_inicio, hora_fim, preco_centavos ) )"
    )
    .eq("id", id)
    .maybeSingle();

  if (!clube) notFound();

  const { data: avaliacoes } = await supabase
    .from("avaliacoes")
    .select("id, nota, comentario, criado_em, jogador_id, jogadores ( nome )")
    .eq("clube_id", id)
    .order("criado_em", { ascending: false });

  const lista = avaliacoes ?? [];
  const media =
    lista.length > 0
      ? lista.reduce((soma, a) => soma + a.nota, 0) / lista.length
      : null;
  const minhaAvaliacao = lista.find((a) => a.jogador_id === user.id);

  const whatsappLink = clube.telefone
    ? `https://wa.me/55${clube.telefone.replace(/\D/g, "")}`
    : null;

  const esportes = [...new Set(clube.quadras.map((q) => q.esporte))];
  const cobertas = clube.quadras.filter((q) => q.coberta).length;
  const horarios = horariosPorDia(
    clube.quadras.flatMap((q) => q.quadra_precos as FaixaHorario[])
  );
  const temHorarios = horarios.some((h) => h.horario !== null);
  const comoChegarLink =
    clube.latitude != null && clube.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${clube.latitude},${clube.longitude}`
      : null;

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/app/descobrir"
          className="text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          ← Voltar ao mapa
        </Link>

        <header className="mt-3">
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            {clube.nome}
          </h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {clube.endereco ? `${clube.endereco} · ` : ""}
            {clube.cidade}
          </p>
          {media !== null && (
            <p className="mt-1 text-sm font-bold text-primaria">
              ★ {media.toFixed(1)}{" "}
              <span className="font-normal text-tinta-suave">
                ({lista.length}{" "}
                {lista.length === 1 ? "avaliação" : "avaliações"})
              </span>
            </p>
          )}
        </header>

        {clube.clube_fotos.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {clube.clube_fotos.map((foto) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={foto.id}
                src={foto.url}
                alt={`Foto de ${clube.nome}`}
                className="h-36 w-52 shrink-0 rounded-xl object-cover"
              />
            ))}
          </div>
        )}

        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block rounded-full bg-destaque px-6 py-3 text-center font-display font-bold text-destaque-tinta transition hover:brightness-95"
          >
            💬 Chamar no WhatsApp
          </a>
        )}

        <section className="mt-6">
          <h2 className="font-display text-lg font-bold text-tinta">
            Informações
          </h2>

          <div className="mt-3 flex flex-wrap gap-2">
            {esportes.map((e) => (
              <span
                key={e}
                className="rounded-full bg-primaria/10 px-3 py-1 text-xs font-bold text-primaria"
              >
                {ROTULO_ESPORTE[e] ?? e}
              </span>
            ))}
            <span className="rounded-full bg-primaria/10 px-3 py-1 text-xs font-bold text-primaria">
              {clube.quadras.length}{" "}
              {clube.quadras.length === 1 ? "quadra" : "quadras"}
              {cobertas > 0 ? ` · ${cobertas} coberta${cobertas > 1 ? "s" : ""}` : ""}
            </span>
          </div>

          {temHorarios && (
            <div className="mt-3 rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5">
              <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">
                🕐 Horário de funcionamento
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-y-0.5 text-sm sm:grid-cols-2 sm:gap-x-6">
                {horarios.map((h) => (
                  <li
                    key={h.dia}
                    className="flex justify-between text-tinta"
                  >
                    <span className="text-tinta-suave">{h.dia}</span>
                    <span className={h.horario ? "font-medium" : "text-tinta-suave/60"}>
                      {h.horario ?? "Fechado"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {clube.latitude != null && clube.longitude != null && (
            <div className="mt-3 rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5">
              <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">
                📍 Como chegar
              </p>
              {clube.endereco && (
                <p className="mt-1 text-sm text-tinta">
                  {clube.endereco} · {clube.cidade}
                </p>
              )}
              <div className="mt-2">
                <ClubeMiniMapa
                  latitude={clube.latitude}
                  longitude={clube.longitude}
                />
              </div>
              {comoChegarLink && (
                <a
                  href={comoChegarLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-bold text-primaria hover:underline"
                >
                  Traçar rota →
                </a>
              )}
            </div>
          )}

          {clube.telefone && (
            <div className="mt-3 rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5">
              <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">
                📞 Contato
              </p>
              <a
                href={`tel:+55${clube.telefone.replace(/\D/g, "")}`}
                className="mt-1 block text-sm font-medium text-tinta hover:text-primaria"
              >
                {mascararTelefoneBr(clube.telefone)}
              </a>
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="font-display text-lg font-bold text-tinta">
            Quadras e preços
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {clube.quadras.map((quadra) => (
              <div
                key={quadra.id}
                className="rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5"
              >
                <p className="font-display font-bold text-tinta">
                  {quadra.nome}
                </p>
                <p className="text-sm text-tinta-suave">
                  {ROTULO_ESPORTE[quadra.esporte] ?? quadra.esporte} ·{" "}
                  {ROTULO_TIPO[quadra.tipo] ?? quadra.tipo} ·{" "}
                  {quadra.coberta ? "coberta" : "descoberta"}
                </p>
                {quadra.quadra_precos.length > 0 && (
                  <ul className="mt-2 text-sm text-tinta">
                    {quadra.quadra_precos.map((p) => (
                      <li key={p.id}>
                        {(p.dias as number[])
                          .slice()
                          .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
                          .map((d) => DIAS_ROTULO[d])
                          .join(", ")}{" "}
                        · {p.hora_inicio.slice(0, 5)}–{p.hora_fim.slice(0, 5)}{" "}
                        · <strong>{formatarReais(p.preco_centavos)}</strong>/h
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="font-display text-lg font-bold text-tinta">
            Avaliações
          </h2>

          <AvaliarClube
            clubeId={clube.id}
            jogadorId={user.id}
            notaAtual={minhaAvaliacao?.nota ?? null}
            comentarioAtual={minhaAvaliacao?.comentario ?? null}
          />

          <div className="mt-4 flex flex-col gap-3">
            {lista.length === 0 && (
              <p className="text-sm text-tinta-suave">
                Ainda não há avaliações — seja a primeira pessoa a avaliar!
              </p>
            )}
            {lista.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5"
              >
                <p className="text-sm font-bold text-tinta">
                  {(a.jogadores as unknown as { nome: string })?.nome ??
                    "Jogador"}{" "}
                  <span className="font-normal text-primaria">
                    {"★".repeat(a.nota)}
                    <span className="text-black/15">
                      {"★".repeat(5 - a.nota)}
                    </span>
                  </span>
                </p>
                {a.comentario && (
                  <p className="mt-1 text-sm text-tinta-suave">
                    {a.comentario}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
