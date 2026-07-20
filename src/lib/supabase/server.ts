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
