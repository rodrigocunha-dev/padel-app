import type { Metadata } from "next";
import Link from "next/link";
import { ApagarConta } from "./ApagarConta";

export const metadata: Metadata = {
  title: "Seus dados — padel",
};

// Módulo 1.8 — os direitos do titular, num lugar só.
//
// Privacidade por design (RLS, telefone fechado, agenda pública sem dado
// pessoal) já existia desde o Sprint 1, mas é OUTRA coisa: protege o dado de
// terceiros. Esta tela é o que dá direito a QUEM É DONO do dado.
export default function PaginaPrivacidade() {
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
          Seus dados
        </h1>
        <p className="mt-2 text-sm text-tinta-suave">
          Você decide o que fazer com as suas informações.
        </p>

        <section className="mt-6 rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
          <p className="font-display text-base font-bold text-tinta">
            📄 O que guardamos sobre você
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            Seu perfil, seus jogos, suas reservas e seus pagamentos — tudo num
            arquivo só.
          </p>
          {/* Link normal, e não botão: o navegador precisa tratar isto como
              download de arquivo. */}
          <a
            href="/api/meus-dados"
            className="mt-4 inline-block rounded-xl bg-primaria px-5 py-3 font-display font-bold text-white shadow transition hover:brightness-110"
          >
            Baixar meus dados
          </a>
          <p className="mt-3 text-xs text-tinta-suave">
            O nome de quem jogou com você aparece, porque faz parte dos jogos.
            O telefone dessas pessoas, não.
          </p>
        </section>

        <Link
          href="/app/perfil/dados-fiscais"
          className="mt-4 block rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
        >
          <p className="font-display text-base font-bold text-tinta">
            🧾 Dados para nota
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            Opcional — só se quiser nota fiscal das suas reservas
          </p>
        </Link>

        <a
          href="/politica-privacidade"
          target="_blank"
          rel="noreferrer"
          className="mt-3 block rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
        >
          <p className="font-display text-base font-bold text-tinta">
            📘 Política de privacidade
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            O que guardamos, quem enxerga e quais são seus direitos
          </p>
        </a>

        <section className="mt-6">
          <h2 className="font-display text-base font-bold text-tinta">
            Sair do app de vez
          </h2>
          <ApagarConta />
        </section>

        <p className="mt-8 text-xs text-tinta-suave">
          Dúvida sobre privacidade? Fale com a gente no WhatsApp: [DEFINIR]
        </p>
      </div>
    </main>
  );
}
