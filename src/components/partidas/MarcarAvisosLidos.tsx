"use client";

import { useEffect } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";

// O aviso deixa de ser "não lido" quando a pessoa CHEGA no jogo, não quando
// toca no bloco. Marcar no toque tinha dois defeitos, os dois vistos no
// teste do fundador (08/08/2026):
//
//  1. Um toque que não chegou a abrir o jogo apagava o aviso do mesmo jeito.
//     Tentando abrir cinco avisos, ele apagou os cinco e viu só um.
//  2. A gravação corria junto com a navegação, então às vezes o toque não
//     levava a lugar nenhum — só apagava.
//
// ⚠️ Passa a marcar por PARTIDA, não por set (12/08/2026). O aviso de
// promoção não tem set, e pela busca antiga ele nunca era encontrado: o
// bloco ficava na tela mesmo depois de a pessoa abrir o jogo. Marcar por
// partida cobre os três tipos e não quebra quando surgir um quarto.
// ⚠️ Ganhou o clube em 17/08/2026, junto com o aviso de horário livre. Esse
// aviso NÃO tem partida — ele aponta para o clube —, e sem isto ficaria na
// tela para sempre, porque nada nunca o encontraria. Mesma armadilha da
// correção anterior, com outro campo.
export function MarcarAvisosLidos({
  partidaId,
  clubeId,
}: {
  partidaId?: string;
  clubeId?: string;
}) {
  useEffect(() => {
    if (!partidaId && !clubeId) return;

    const supabase = criarClienteNavegador();
    const consulta = supabase
      .from("avisos")
      .update({ lido_em: new Date().toISOString() })
      .is("lido_em", null);

    (partidaId
      ? consulta.eq("partida_id", partidaId)
      : consulta.eq("clube_id", clubeId!)
    ).then(() => {});
  }, [partidaId, clubeId]);

  return null;
}
