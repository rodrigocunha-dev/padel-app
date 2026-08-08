"use client";

import { useEffect } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";

// O aviso deixa de ser "não lido" quando a pessoa CHEGA no jogo, não quando
// toca no bloco. Marcar no toque tinha dois defeitos, os dois vistos no teste
// do fundador (08/08/2026):
//
//  1. Um toque que não chegou a abrir o jogo apagava o aviso do mesmo jeito.
//     Tentando abrir cinco avisos, ele apagou os cinco e viu só um resultado.
//  2. A gravação corria junto com a navegação (o `router.refresh()` do bloco
//     disputava com o `<Link>`), então às vezes o toque não levava a lugar
//     nenhum — só apagava.
//
// Aqui não há corrida: a página do jogo já abriu, e a marcação é um efeito
// solto. Só some o aviso dos sets DESTA partida — abrir um jogo não apaga o
// aviso de outro.
export function MarcarAvisosLidos({ setIds }: { setIds: string[] }) {
  useEffect(() => {
    if (setIds.length === 0) return;
    const supabase = criarClienteNavegador();
    supabase
      .from("avisos")
      .update({ lido_em: new Date().toISOString() })
      .in("set_id", setIds)
      .is("lido_em", null)
      .then(() => {});
    // A lista de sets da página é estável; o join evita refazer o efeito a
    // cada render por causa da identidade do array.
  }, [setIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
