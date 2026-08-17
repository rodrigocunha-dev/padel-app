import { NextResponse } from "next/server";
import { criarClienteServidor, usuarioAtual } from "@/lib/supabase/server";

// Download dos próprios dados (LGPD, direito de acesso e portabilidade).
//
// É uma rota, e não uma ação de tela, porque o resultado é um ARQUIVO: o
// navegador precisa de uma resposta com `Content-Disposition` para oferecer
// o "salvar como". Uma ação de servidor devolveria o conteúdo para dentro da
// página, sem virar arquivo.
//
// Quem decide o que entra é `meus_dados()` no banco (script 038), e não esta
// rota — a regra fica de um lado só, junto do dado.
export async function GET() {
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ erro: "Precisa estar logado." }, { status: 401 });
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("meus_dados");

  if (error) {
    return NextResponse.json(
      { erro: "Não foi possível montar seus dados agora." },
      { status: 500 }
    );
  }

  const dia = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-padel-${dia}.json"`,
      // Dado pessoal não pode ficar guardado em cache de navegador ou de
      // intermediário no caminho.
      "Cache-Control": "no-store, private",
    },
  });
}
