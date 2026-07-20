import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { AgendaDia } from "@/components/clube/AgendaDia";

export const metadata: Metadata = {
  title: "Agenda — painel do clube",
};

export default async function PaginaAgenda() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: clube } = await supabase
    .from("clubes")
    .select("id, nome, quadras ( id, nome, esporte )")
    .eq("dono_id", user.id)
    .maybeSingle();

  if (!clube) redirect("/clube");

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Agenda — {clube.nome}
          </h1>
          <Link
            href="/clube"
            className="text-sm font-medium text-tinta-suave hover:text-tinta"
          >
            ← Painel
          </Link>
        </header>

        <AgendaDia
          quadras={clube.quadras}
          usuarioId={user.id}
        />
      </div>
    </main>
  );
}
