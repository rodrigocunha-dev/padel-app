"use client";

import { useEffect, useState } from "react";

type Linha = { rotulo: string; valor: string; ok: boolean | null };

export function PainelDiagnostico() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    (async () => {
      const L = window.screen.width;
      const A = window.screen.height;
      const D = window.devicePixelRatio;

      // O 13 Pro é 390x844 com densidade 3. Se estes números vierem
      // diferentes, a media query nunca casou — e aí o problema é outro.
      const esperado = `${L}x${A} @${D}`;

      const links = Array.from(
        document.querySelectorAll('link[rel="apple-touch-startup-image"]')
      );

      // A pergunta central: ALGUMA das imagens casa com ESTE aparelho?
      const casaram = links.filter((l) => {
        const m = l.getAttribute("media");
        return m ? window.matchMedia(m).matches : false;
      });
      const coringa = links.filter((l) => !l.getAttribute("media"));

      // Instalado na tela de início ou aberto pelo Safari? A tela de abertura
      // só existe no app instalado.
      const instalado =
        window.matchMedia("(display-mode: standalone)").matches ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).standalone === true;

      let manifesto = "não carregou";
      try {
        const r = await fetch("/manifest.webmanifest", { cache: "no-store" });
        const j = await r.json();
        manifesto = `${j.display} · fundo ${j.background_color}`;
      } catch {
        /* fica com "não carregou" */
      }

      setLinhas([
        { rotulo: "Tela do aparelho", valor: esperado, ok: null },
        {
          rotulo: "Está instalado na tela de início?",
          valor: instalado ? "sim" : "NÃO — aberto pelo navegador",
          ok: instalado,
        },
        {
          rotulo: "Imagens de abertura na página",
          valor: `${links.length} (sendo ${coringa.length} coringa)`,
          ok: links.length > 0,
        },
        {
          rotulo: "Alguma casa com este aparelho?",
          valor: casaram.length ? `sim (${casaram.length})` : "NENHUMA",
          ok: casaram.length > 0,
        },
        { rotulo: "Manifesto", valor: manifesto, ok: manifesto !== "não carregou" },
        {
          rotulo: "Versão do sistema",
          valor: navigator.userAgent,
          ok: null,
        },
      ]);
    })();
  }, []);

  if (!linhas) {
    return <p className="mt-6 text-sm text-tinta-suave">Lendo o aparelho…</p>;
  }

  const texto = linhas.map((l) => `${l.rotulo}: ${l.valor}`).join("\n");

  return (
    <>
      <ul className="mt-6 space-y-3">
        {linhas.map((l) => (
          <li
            key={l.rotulo}
            className="rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">
              {l.rotulo}
            </p>
            <p
              className={`mt-1 break-words font-display text-sm font-bold ${
                l.ok === false ? "text-red-700" : "text-tinta"
              }`}
            >
              {l.ok === false ? "⚠️ " : ""}
              {l.valor}
            </p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
          } catch {
            setCopiado(false);
          }
        }}
        className="mt-5 w-full rounded-2xl bg-primaria px-5 py-4 font-display font-bold text-white shadow-lg transition hover:brightness-110"
      >
        {copiado ? "Copiado ✓" : "Copiar para me mandar"}
      </button>
    </>
  );
}
