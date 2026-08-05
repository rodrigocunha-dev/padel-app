import Link from "next/link";

// A barra tem um item "Partidas" só, mas existem duas listas: as abertas
// (para entrar) e as minhas (as que já são minhas). Sem isto, "Partidas"
// levava só às abertas e "Minhas partidas" ficava escondida no Perfil.
export function AbasPartidas({ atual }: { atual: "abertas" | "minhas" }) {
  const base =
    "flex-1 rounded-full px-4 py-2 text-center text-sm font-bold transition";
  const ativa = "bg-primaria text-white shadow";
  const inativa = "bg-superficie text-tinta-suave ring-1 ring-black/10 hover:text-tinta";

  return (
    <div className="mt-4 flex gap-2 rounded-full bg-fundo p-1">
      <Link
        href="/app/partidas"
        aria-current={atual === "abertas" ? "page" : undefined}
        className={`${base} ${atual === "abertas" ? ativa : inativa}`}
      >
        Abertas
      </Link>
      <Link
        href="/app/partidas/minhas"
        aria-current={atual === "minhas" ? "page" : undefined}
        className={`${base} ${atual === "minhas" ? ativa : inativa}`}
      >
        Minhas
      </Link>
    </div>
  );
}
