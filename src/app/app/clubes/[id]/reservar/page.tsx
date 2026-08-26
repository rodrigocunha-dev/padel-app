import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ReservarQuadra } from "@/components/reservas/ReservarQuadra";

export const metadata: Metadata = {
  title: "Reservar quadra — padel",
};

export default async function PaginaReservar({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ remarcar?: string; quadra?: string; dia?: string; hora?: string }>;
}) {
  const { id } = await params;
  const { remarcar, quadra, dia, hora } = await searchParams;

  // Vem do aviso de horarios livres: abre a tela ja na quadra, no dia e na
  // hora anunciados. So vale se os TRES vierem — meio caminho levaria a
  // pessoa para um horario que ela nao escolheu.
  const sugestao =
    quadra && dia && hora && /^d{4}-d{2}-d{2}$/.test(dia)
      ? { quadraId: quadra, dia, hora: Number(hora) }
      : null;
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: clube } = await supabase
    .from("clubes")
    .select(
      "id, nome, horas_limite_cancelamento, politica_cancelamento, quadras ( id, nome, esporte, tipo, coberta, quadra_precos ( dias, hora_inicio, hora_fim, preco_centavos ) )"
    )
    .eq("id", id)
    .maybeSingle();

  if (!clube) notFound();

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link
          href={`/app/clubes/${clube.id}`}
          className="text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          ← Voltar ao clube
        </Link>
        <h1 className="mt-3 font-display text-2xl font-extrabold text-tinta">
          {remarcar ? "Remarcar" : "Reservar"} em {clube.nome}
        </h1>
        {remarcar && (
          <p className="mt-1 text-sm text-tinta-suave">
            Escolha o novo horário — sua reserva atual é movida para ele.
          </p>
        )}

        <ReservarQuadra
          clubeNome={clube.nome}
          quadras={clube.quadras}
          horasLimiteCancelamento={clube.horas_limite_cancelamento ?? 12}
          politicaTexto={clube.politica_cancelamento}
          remarcarId={remarcar ?? null}
          sugestao={sugestao}
        />
      </div>
    </main>
  );
}
