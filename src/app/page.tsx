import { ListaEsperaForm } from "@/components/ListaEsperaForm";
import { TemaToggle } from "@/components/TemaToggle";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo">
      <TemaToggle />

      <section className="flex flex-1 flex-col items-center justify-center gap-12 px-6 py-16 lg:flex-row lg:items-start lg:gap-20 lg:py-24">
        <div className="max-w-md text-center lg:pt-6 lg:text-left">
          <span className="inline-block rounded-full bg-primaria/10 px-4 py-1.5 text-sm font-semibold text-primaria">
            Em breve na sua cidade
          </span>

          <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight text-tinta sm:text-5xl">
            Ache seu parceiro de padel e reserve a quadra{" "}
            <span className="text-primaria">sem taxa</span> nenhuma.
          </h1>

          <p className="mt-5 text-lg text-tinta-suave">
            Partidas abertas com gente do seu nível, ranking por categoria
            brasileira e reserva com PIX dividido — direto pelo celular.
          </p>

          <ul className="mt-8 space-y-3 text-left text-tinta-suave">
            <Beneficio texto="Jogador nunca paga taxa de conveniência" />
            <Beneficio texto="Encontre parceiros pela sua categoria (1ª a 7ª)" />
            <Beneficio texto="PIX dividido automaticamente entre os jogadores" />
          </ul>
        </div>

        <div className="w-full max-w-md">
          <ListaEsperaForm />
          <p className="mt-4 text-center text-xs text-tinta-suave">
            Seus dados são usados só para te avisar do lançamento. Nada de
            spam.
          </p>
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-xs text-tinta-suave">
        Novo Hamburgo e Vale dos Sinos — RS
      </footer>
    </main>
  );
}

function Beneficio({ texto }: { texto: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destaque text-xs font-bold text-destaque-tinta"
      >
        ✓
      </span>
      <span>{texto}</span>
    </li>
  );
}
