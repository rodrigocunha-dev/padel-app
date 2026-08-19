import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor, usuarioAtual } from "@/lib/supabase/server";
import { Relatorios } from "@/components/clube/Relatorios";

export const metadata: Metadata = {
  title: "Relatórios — painel do clube",
};

// Módulo 1.7. Até 17/08/2026 o clube só tinha o mapa de calor da agenda, que
// mostra ocupação de forma visual mas não é relatório: não dá para responder
// "quanto faturei" nem "quanto do que eu tinha para vender foi vendido".
export default async function PaginaRelatorios() {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual();
  if (!user) redirect("/entrar");

  const { data: clube } = await supabase
    .from("clubes")
    .select("id, nome")
    .eq("dono_id", user.id)
    .maybeSingle();

  if (!clube) redirect("/clube");

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Relatórios
          </h1>
          <Link
            href="/clube"
            className="text-sm font-medium text-tinta-suave hover:text-tinta"
          >
            ← Painel
          </Link>
        </header>
        <p className="mt-1 text-sm text-tinta-suave">{clube.nome}</p>

        <div className="mt-6">
          <Relatorios clubeId={clube.id} />
        </div>
      </div>
    </main>
  );
}
