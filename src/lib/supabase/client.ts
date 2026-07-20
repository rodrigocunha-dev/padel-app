import { createBrowserClient } from "@supabase/ssr";

// Cliente para componentes que rodam no navegador.
// Guarda a sessão em cookies, para o servidor também enxergar o login.
export function criarClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
