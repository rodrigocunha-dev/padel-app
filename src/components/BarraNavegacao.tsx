"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

// Telas de cadastro não recebem a barra: quem ainda não terminou o
// onboarding não deve conseguir escapar dele pela navegação.
const ROTAS_SEM_BARRA = ["/app/onboarding", "/app/completar-perfil"];

type Destino = {
  href: string;
  rotulo: string;
  icone: string;
  // Outras rotas que acendem este item. Ex.: a página de um clube
  // pertence a "Descobrir", que é de onde o jogador chegou nela.
  tambem?: string[];
  // Em vez do emoji, mostra a foto do jogador (ou a inicial do nome).
  // Convenção que todo mundo já conhece de outros apps.
  avatar?: boolean;
};

const DESTINOS: Destino[] = [
  { href: "/app", rotulo: "Início", icone: "🏠" },
  {
    href: "/app/descobrir",
    rotulo: "Descobrir",
    icone: "🗺️",
    tambem: ["/app/clubes"],
  },
  { href: "/app/partidas", rotulo: "Partidas", icone: "👥" },
  {
    href: "/app/perfil",
    rotulo: "Perfil",
    icone: "👤",
    tambem: ["/app/reservas"],
    avatar: true,
  },
];

function estaAtivo(caminho: string, destino: Destino): boolean {
  // "/app" é exato, senão acenderia em todas as telas.
  if (destino.href === "/app") return caminho === "/app";
  if (caminho === destino.href || caminho.startsWith(`${destino.href}/`)) {
    return true;
  }
  return (destino.tambem ?? []).some(
    (rota) => caminho === rota || caminho.startsWith(`${rota}/`)
  );
}

export function BarraNavegacao({
  nome,
  fotoUrl,
}: {
  nome?: string | null;
  fotoUrl?: string | null;
}) {
  const caminho = usePathname();

  if (ROTAS_SEM_BARRA.some((rota) => caminho.startsWith(rota))) return null;

  const inicial = nome?.trim()?.[0]?.toUpperCase() ?? null;

  return (
    <>
      {/* Espaçador: sem ele a barra tapa o fim do conteúdo na rolagem. */}
      <div className="h-[4.5rem] shrink-0" aria-hidden />

      {/* CAMADAS — regra do app do jogador, respeitar ao criar pop-up novo:
            Leaflet (mapa) usa até 800 nos controles
            barra de navegação .... 1000
            pop-up / modal ........ 1100 ou mais
          A barra precisa ficar acima do mapa, e qualquer modal acima dela —
          senão a barra tapa os botões do modal (foi o que aconteceu com o
          pop-up de reservar, que estava em z-50). */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-[1000] border-t border-black/5 bg-superficie/95 backdrop-blur"
      >
        <ul className="mx-auto flex w-full max-w-md">
          {DESTINOS.map((destino) => {
            const ativo = estaAtivo(caminho, destino);
            return (
              <li key={destino.href} className="flex-1">
                <Link
                  href={destino.href}
                  aria-current={ativo ? "page" : undefined}
                  onClick={() =>
                    posthog.capture("navegacao_barra", {
                      destino: destino.href,
                    })
                  }
                  className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition ${
                    ativo
                      ? "text-primaria"
                      : "text-tinta-suave hover:text-tinta"
                  }`}
                >
                  {destino.avatar && (fotoUrl || inicial) ? (
                    fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fotoUrl}
                        alt=""
                        aria-hidden
                        className={`h-5 w-5 rounded-full object-cover ${
                          ativo ? "ring-2 ring-primaria" : "ring-1 ring-black/10"
                        }`}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold ${
                          ativo
                            ? "bg-primaria text-white"
                            : "bg-fundo text-tinta-suave ring-1 ring-black/10"
                        }`}
                      >
                        {inicial}
                      </span>
                    )
                  ) : (
                    <span aria-hidden className="text-xl leading-none">
                      {destino.icone}
                    </span>
                  )}
                  {destino.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
