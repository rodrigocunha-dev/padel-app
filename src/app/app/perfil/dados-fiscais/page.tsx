import type { Metadata } from "next";
import Link from "next/link";
import { FormularioFiscal } from "./FormularioFiscal";

export const metadata: Metadata = {
  title: "Dados para nota — padel",
};

// Os campos existem desde o script 038 e são TODOS opcionais: a emissão de
// nota/cupom ainda não está ligada. Nascem antes porque acrescentar coluna
// depois, com histórico já acumulado, é o caro.
export default function PaginaDadosFiscais() {
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
          Dados para nota
        </h1>
        <p className="mt-2 text-sm text-tinta-suave">
          Nada aqui é obrigatório. Preencha se quiser receber nota fiscal das
          suas reservas — os clubes vão poder emitir em breve.
        </p>

        <FormularioFiscal />

        <p className="mt-6 text-xs text-tinta-suave">
          Estes dados vão só para o clube onde você jogar, na hora de emitir a
          nota. Nenhum outro jogador enxerga.
        </p>
      </div>
    </main>
  );
}
