"use client";

import { useState } from "react";
import posthog from "posthog-js";

// ============================================================
// "CHAMA UM AMIGO" — convite solto, sem partida nenhuma
// ============================================================
// Diferente do convite para uma sessão: aqui não há grupo, não há vaga e
// não há participante. É só um link para o app.
//
// Por isso não tem o problema de privacidade do convite por telefone —
// ninguém é exposto, porque não existe ninguém do outro lado ainda.
//
// A regra de conta obrigatória (Decisão 1) é o que torna isto útil para o
// produto: todo participante precisa ter conta, então trazer gente para o
// app é pré-requisito de montar jogo. É crescimento e utilidade ao mesmo
// tempo, não um botão de marketing pendurado.

const MENSAGEM =
  "Vem jogar padel comigo! Dá para achar parceiros do seu nível, montar partidas e reservar quadra sem taxa de conveniência:";

export function ConvidarParaOApp() {
  const [copiado, setCopiado] = useState(false);

  async function convidar() {
    // No celular, `share` abre a folha do sistema — a pessoa escolhe
    // WhatsApp, mensagem, o que quiser. Não presumimos o canal.
    const link = window.location.origin;
    const texto = `${MENSAGEM} ${link}`;

    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
        posthog.capture("convite_app_compartilhado", { via: "share" });
        return;
      } catch {
        // A pessoa fechou a folha de compartilhamento. Não é erro, e não
        // deve virar mensagem na tela nem cair no plano B.
        return;
      }
    }

    // Sem `share` (a maioria dos computadores): copia e avisa.
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      posthog.capture("convite_app_compartilhado", { via: "copia" });
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência: abre o WhatsApp Web como
      // último recurso, em vez de não fazer nada.
      window.open(
        `https://wa.me/?text=${encodeURIComponent(texto)}`,
        "_blank",
        "noopener"
      );
      posthog.capture("convite_app_compartilhado", { via: "whatsapp" });
    }
  }

  return (
    <button
      type="button"
      onClick={convidar}
      className="mt-3 block w-full rounded-2xl bg-superficie p-5 text-left shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
    >
      <p className="font-display text-base font-bold text-tinta">
        💚 Chamar um amigo para o app
      </p>
      <p className="mt-1 text-sm text-tinta-suave">
        {copiado
          ? "Link copiado! É só colar onde você quiser."
          : "Quanto mais gente por aqui, mais fácil fechar jogo"}
      </p>
    </button>
  );
}
