"use client";

import { useState } from "react";

type Tema = "verde" | "azul";

export function TemaToggle() {
  const [tema, setTema] = useState<Tema>("verde");

  function alternar(novoTema: Tema) {
    setTema(novoTema);
    document.documentElement.setAttribute("data-tema", novoTema);
  }

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-1 rounded-full bg-superficie/90 p-1 text-xs shadow-md ring-1 ring-black/5 backdrop-blur">
      <button
        type="button"
        onClick={() => alternar("verde")}
        className={`rounded-full px-3 py-1.5 font-medium transition ${
          tema === "verde"
            ? "bg-primaria text-white"
            : "text-tinta-suave hover:text-tinta"
        }`}
      >
        Verde-quadra
      </button>
      <button
        type="button"
        onClick={() => alternar("azul")}
        className={`rounded-full px-3 py-1.5 font-medium transition ${
          tema === "azul"
            ? "bg-primaria text-white"
            : "text-tinta-suave hover:text-tinta"
        }`}
      >
        Azul-quadra
      </button>
    </div>
  );
}
