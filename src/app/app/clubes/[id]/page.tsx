import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { AvaliarClube } from "@/components/AvaliarClube";

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
      "id, nome, cidade, endereco, telefone, clube_fotos ( id, url ), quadras ( id, nome, esporte, tipo, coberta, quadra_precos ( id, dias, hora_inicio, hora_fim, preco_centavos ) )"
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
