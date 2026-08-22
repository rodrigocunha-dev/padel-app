import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { mascararTelefoneBr } from "@/lib/telefone";
import { TrocarTelefone } from "./TrocarTelefone";

export const metadata: Metadata = {
  title: "Trocar telefone — padel",
};

export default async function PaginaTelefone() {
  const user = await usuarioAtual();
  if (!user) redirect("/entrar");

  // ⚠️ O telefone vem do LOGIN, e não da tabela `jogadores`.
  //
  // Ler `jogadores.telefone` parecia o caminho óbvio e QUEBRAVA a tela: essa
  // coluna está fechada por permissão desde o Sprint 4, de propósito — é o
  // que impede um jogador de ler o telefone de outro. A consulta era negada,
  // o app concluía que a pessoa não tinha perfil e a mandava embora, caindo
  // na Início. Era o bug que o fundador viu.
  //
  // E o telefone do login é o certo aqui de qualquer forma: é ele que a
  // pessoa usa para entrar, e é ele que a tela vai trocar.
  const atual = user.phone
    ? mascararTelefoneBr(user.phone.replace(/^55/, ""))
    : "—";

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

        <TrocarTelefone atual={atual} />

        <p className="mt-6 text-xs text-tinta-suave">
          Se alguém já tinha te convidado pelo número novo, o convite aparece
          para você assim que a troca terminar.
        </p>
      </div>
    </main>
  );
}
