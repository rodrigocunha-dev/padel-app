import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { MinhasReservas } from "@/components/reservas/MinhasReservas";

export const metadata: Metadata = {
  title: "Minhas reservas — padel",
};

export default async function PaginaMinhasReservas({
  searchParams,
}: {
  searchParams: Promise<{ nova?: string }>;
}) {
  const { nova } = await searchParams;
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: reservas } = await supabase
    .from("reservas")
    .select(
      "id, inicio, fim, status, preco_centavos, quadras ( id, nome, esporte, clubes ( id, nome, cidade, horas_limite_cancelamento, politica_cancelamento ) )"
    )
    .eq("jogador_id", user.id)
    .eq("status", "confirmada")
    .gte("fim", new Date().toISOString())
    .order("inicio", { ascending: true });

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Minhas reservas
          </h1>
          <Link
            href="/app"
            className="text-sm font-medium text-tinta-suave hover:text-tinta"
          >
            ← Início
          </Link>
        </div>

        <MinhasReservas
          reservas={JSON.parse(JSON.stringify(reservas ?? []))}
          idNova={nova ?? null}
        />
      </div>
    </main>
  );
}
