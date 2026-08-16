import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { BotaoSair } from "@/components/BotaoSair";
import { BarraDeProgresso } from "@/components/rating/BarraDeProgresso";
import { AtivarNotificacoes } from "@/components/AtivarNotificacoes";
import { ConvidarParaOApp } from "@/components/ConvidarParaOApp";
import { estadoDoRating } from "@/lib/rating";

export const metadata: Metadata = {
  title: "Meu perfil — padel",
};

export default async function PaginaPerfil() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: jogador } = await supabase
    .from("jogadores")
    .select("nome, foto_url, cidade")
    .eq("id", user.id)
    .maybeSingle();

  if (!jogador) redirect("/app/onboarding");

  // O rating bruto fica no servidor: daqui sai só categoria, nível e
  // posições em porcentagem (ver `src/lib/rating.ts`).
  const rating = await estadoDoRating(user.id);

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-8">
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display text-2xl font-extrabold text-tinta">
          Meu perfil
        </h1>

        <div className="mt-6 flex items-center gap-4">
          {jogador.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={jogador.foto_url}
              alt=""
              className="h-16 w-16 rounded-full object-cover ring-2 ring-primaria/30"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-16 w-16 items-center justify-center rounded-full bg-superficie text-2xl ring-2 ring-primaria/30"
            >
              🎾
            </div>
          )}
          <div>
            <p className="font-display text-xl font-extrabold text-tinta">
              {jogador.nome}
            </p>
            {jogador.cidade && (
              <p className="text-sm text-tinta-suave">{jogador.cidade}</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          {rating && <BarraDeProgresso estado={rating} />}
        </div>

        {/* Fica no Perfil, e não na Início, de propósito: pedir permissão
            antes de a pessoa entender para quê rende um "não" que o
            navegador guarda para sempre. */}
        <AtivarNotificacoes />

        <Link
          href="/app/perfil/rating"
          className="mt-3 block rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
        >
          <p className="font-display text-base font-bold text-tinta">
            📈 Como minha categoria mudou
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            O que cada jogo fez com o seu nível
          </p>
        </Link>

        <Link
          href="/app/reservas"
          className="mt-4 block rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
        >
          <p className="font-display text-base font-bold text-tinta">
            🎾 Minhas reservas
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            Cancelar ou remarcar suas quadras
          </p>
        </Link>

        <Link
          href="/app/partidas/minhas"
          className="mt-3 block rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
        >
          <p className="font-display text-base font-bold text-tinta">
            📋 Minhas partidas
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            Seus jogos e pagamentos — futuros e passados
          </p>
        </Link>

        <ConvidarParaOApp />

        {/* ⚠️ TEMPORÁRIO — apagar junto com /app/diagnostico.
            Está aqui porque o app instalado na tela de início não tem barra
            de endereço: sem um link por dentro, não há como chegar numa
            página que não esteja no menu. */}
        <Link
          href="/app/diagnostico"
          className="mt-3 block rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
        >
          <p className="font-display text-base font-bold text-tinta">
            🔧 Diagnóstico do aparelho
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            Página de apoio, temporária — não faz parte do app
          </p>
        </Link>

        <div className="mt-8 border-t border-black/5 pt-6">
          <BotaoSair />
        </div>
      </div>
    </main>
  );
}
