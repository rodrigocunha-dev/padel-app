"use client";

// Mensagem que aparece SEMPRE à vista, presa logo acima da barra de
// navegação. Antes o erro era renderizado no fim da seção — quem estava
// no topo da tela não via nada acontecer e repetia a ação achando que não
// tinha funcionado.
//
// Camada 1050: acima da barra (1000) e abaixo de qualquer pop-up (1100).
// Ver a regra de camadas em BarraNavegacao.tsx.
export function MensagemFlutuante({
  children,
  tom = "erro",
  aoFechar,
}: {
  children: React.ReactNode;
  tom?: "erro" | "aviso";
  aoFechar: () => void;
}) {
  const cor =
    tom === "erro"
      ? "bg-red-100 ring-red-200 text-red-700"
      : "bg-amber-100 ring-amber-200 text-amber-800";

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-[5rem] z-[1050] px-4"
    >
      <div
        className={`mx-auto flex max-w-md items-start gap-3 rounded-2xl p-4 shadow-lg ring-1 ${cor}`}
      >
        <div className="min-w-0 flex-1 text-sm font-medium">{children}</div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar aviso"
          className="shrink-0 rounded-full px-2 text-lg leading-none opacity-70 transition hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
