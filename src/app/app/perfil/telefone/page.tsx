import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor, usuarioAtual } from "@/lib/supabase/server";
import { TrocarTelefone } from "./TrocarTelefone";

export const metadata: Metadata = {
  title: "Trocar telefone — padel",
};

export default async function PaginaTelefone() {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual();
  if (!user) redirect("/entrar");

  const { data: jogador } = await supabase
    .from("jogadores")
    .select("telefone")
    .eq("id", user.id)
    .maybeSingle();

  if (!jogador) redirect("/app/onboarding");

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/app/perfil/editar"
          className="text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          ← Editar perfil
        </Link>

        <h1 className="mt-4 font-display text-2xl font-extrabold text-tinta">
          Trocar meu telefone
        </h1>
        <p className="mt-2 text-sm text-tinta-suave">
          É com este número que você entra no app.
        </p>

        <TrocarTelefone atual={jogador.telefone} />

        <p className="mt-6 text-xs text-tinta-suave">
          Convites que amigos mandaram para o número antigo e você ainda não
          aceitou não vão te encontrar depois da troca — peça para convidarem
          de novo pelo número novo.
        </p>
      </div>
    </main>
  );
}
