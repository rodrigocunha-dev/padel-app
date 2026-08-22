import Link from "next/link";

// Alternador jogador ↔ clube, no topo da tela.
//
// Nasceu como dois BLOCOS grandes (um em cada lado), e o fundador pediu algo
// mais sutil: dois botões pequenos, como o alternador de cor da landing.
// Faz sentido — trocar de modo é navegação, não uma ação do dia a dia; um
// cartão do tamanho de "Minhas reservas" dava a ela um peso que ela não tem.
//
// Só aparece para quem tem clube. Para o resto, seriam dois botões em que um
// nunca leva a lugar nenhum.
export function TrocaDeModo({ modo }: { modo: "jogador" | "clube" }) {
  const base =
    "flex-1 rounded-full px-4 py-1.5 text-center text-xs font-bold transition";

  return (
    <div className="mb-4 flex gap-1 rounded-full bg-superficie p-1 ring-1 ring-black/10">
      <Link
        href="/app"
        className={`${base} ${
          modo === "jogador"
            ? "bg-primaria text-white"
            : "text-tinta-suave hover:text-tinta"
        }`}
      >
        🎾 Jogador
      </Link>
      <Link
        href="/clube"
        className={`${base} ${
          modo === "clube"
            ? "bg-primaria text-white"
            : "text-tinta-suave hover:text-tinta"
        }`}
      >
        🏟️ Clube
      </Link>
    </div>
  );
}
