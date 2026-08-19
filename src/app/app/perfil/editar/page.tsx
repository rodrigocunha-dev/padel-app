import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor, usuarioAtual } from "@/lib/supabase/server";
import { paraMapa } from "@/lib/perfil-campos";
import { EditarPerfil } from "./EditarPerfil";

export const metadata: Metadata = {
  title: "Editar perfil — padel",
};

// Até 17/08/2026 NÃO EXISTIA edição de perfil nenhuma: o jogador preenchia
// tudo no cadastro e não podia mudar nem o nome. O buraco passou por duas
// auditorias sem ser visto, e apareceu quando o fundador perguntou como a
// pessoa trocaria de telefone.
export default async function PaginaEditarPerfil() {
  const supabase = await criarClienteServidor();
  const user = await usuarioAtual();
  if (!user) redirect("/entrar");

  const { data: jogador } = await supabase
    .from("jogadores")
    .select("nome, foto_url, cidade, posicao, raio_km, disponibilidade")
    .eq("id", user.id)
    .maybeSingle();

  if (!jogador) redirect("/app/onboarding");

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/app/perfil"
          className="text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          ← Perfil
        </Link>

        <h1 className="mt-4 font-display text-2xl font-extrabold text-tinta">
          Editar perfil
        </h1>
        <p className="mt-2 text-sm text-tinta-suave">
          Sua categoria não fica aqui: ela vem dos seus jogos, não de escolha.
        </p>

        <EditarPerfil
          usuarioId={user.id}
          inicial={{
            nome: jogador.nome,
            fotoUrl: jogador.foto_url,
            cidade: jogador.cidade,
            posicao: jogador.posicao,
            raioKm: jogador.raio_km ?? 10,
            disponibilidade: paraMapa(jogador.disponibilidade),
          }}
        />
      </div>
    </main>
  );
}
