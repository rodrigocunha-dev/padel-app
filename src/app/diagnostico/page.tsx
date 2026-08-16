import type { Metadata } from "next";
import { PainelDiagnostico } from "./PainelDiagnostico";

export const metadata: Metadata = {
  title: "Diagnóstico — padel",
  // Página de apoio, não faz parte do produto.
  robots: { index: false, follow: false },
};

// Página temporária de diagnóstico do aparelho.
//
// Existe porque a tela de abertura não apareceu no iPhone do fundador e eu
// já tinha errado um palpite sobre o motivo (achei que o modelo estava fora
// da lista; o 13 Pro está nela). Em vez de arriscar outro, esta página
// mostra os números do aparelho dele.
//
// ⚠️ APAGAR quando o assunto da tela de abertura estiver fechado.
export default function PaginaDiagnostico() {
  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display text-2xl font-extrabold text-tinta">
          Diagnóstico do aparelho
        </h1>
        <p className="mt-2 text-sm text-tinta-suave">
          Esta página não faz parte do app. Ela mostra informações do seu
          celular para eu entender por que a tela de abertura não apareceu.
        </p>

        <PainelDiagnostico />
      </div>
    </main>
  );
}
