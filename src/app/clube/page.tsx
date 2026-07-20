import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CadastroClube } from "@/components/clube/CadastroClube";
import { GerenciarQuadras } from "@/components/clube/GerenciarQuadras";
import { LocalizacaoClube } from "@/components/clube/LocalizacaoClube";
import { BotaoSair } from "@/components/BotaoSair";

export const metadata: Metadata = {
  title: "Painel do clube — padel",
};

export default async function PaginaClube() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const { data: clube } = await supabase
    .from("clubes")
    .select("id, nome, cidade, endereco, telefone, latitude, longitude")
    .eq("dono_id", user.id)
    .maybeSingle();

  if (!clube) {
    return (
      <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-10">
        <div className="mx-auto w-full max-w-md">
          <CadastroClube donoId={user.id} />
        </div>
      </main>
    );
  }

  const { data: quadras } = await supabase
    .from("quadras")
    .select(
      "id, nome, esporte, tipo, coberta, quadra_precos ( id, dias, hora_inicio, hora_fim, preco_centavos )"
    )
    .eq("clube_id", clube.id)
    .order("criado_em", { ascending: true });

  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-tinta">
              {clube.nome}
            </h1>
            <p className="text-sm text-tinta-suave">{clube.cidade}</p>
          </div>
          <BotaoSair />
        </header>

        <GerenciarQuadras clubeId={clube.id} quadras={quadras ?? []} />

        <LocalizacaoClube
          clubeId={clube.id}
          enderecoAtual={clube.endereco}
          latitude={clube.latitude}
          longitude={clube.longitude}
        />
      </div>
    </main>
  );
}
