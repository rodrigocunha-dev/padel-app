import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente para componentes/rotas que rodam no servidor.
// Lê a sessão dos cookies da requisição.
export async function criarClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado a partir de um Server Component: cookies são
            // gravados pelo proxy.ts, então ignorar aqui é seguro.
          }
        },
      },
    }
  );
}

// Quem está logado — UMA vez por requisição, não uma por componente.
//
// `auth.getUser()` não lê o cookie e pronto: ele vai ao servidor do Supabase
// validar o token, e isso é ida e volta de rede. O layout do app chamava, a
// página chamava de novo, e cada tela pagava o dobro sem precisar.
//
// `cache()` é do React: dentro da MESMA renderização, a segunda chamada
// devolve o resultado da primeira. Entre requisições diferentes não guarda
// nada — ninguém corre risco de ver a sessão de outra pessoa.
export const usuarioAtual = cache(async () => {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// O perfil de quem está logado, pelo mesmo motivo e com a mesma regra.
// A barra de navegação pede nome e foto; a Início pede categoria e nível.
// Buscar as colunas das duas de uma vez custa o mesmo que buscar as de uma —
// o caro é a viagem até o banco, não o tamanho da linha.
export const perfilAtual = cache(async (jogadorId: string) => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("jogadores")
    .select("nome, foto_url, categoria, nivel_categoria, em_calibracao, sexo")
    .eq("id", jogadorId)
    .maybeSingle();
  return data;
});
