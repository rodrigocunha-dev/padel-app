"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Ouve o service worker quando a pessoa toca numa notificação com o app já
// aberto em segundo plano.
//
// Por que existe: sem isto o service worker precisa mandar a aba recarregar
// (`navigate`), o que faz um carregamento de página inteiro. No iPhone o
// efeito é ruim — o sistema restaura o app na tela onde a pessoa estava e
// só alguns segundos depois pula para o jogo. Navegando por dentro, é o
// mesmo que tocar num link: quase instantâneo.
//
// O service worker espera meio segundo por uma resposta daqui. Se este
// componente não estiver montado, ele cai no recarregamento antigo — mais
// lento, porém a pessoa sempre chega ao lugar certo.
export function IrPelaNotificacao() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function aoReceber(evento: MessageEvent) {
      const dados = evento.data;
      if (!dados || dados.tipo !== "ir-para" || typeof dados.url !== "string") {
        return;
      }
      // Confirma para o service worker que assumimos a navegação — é o que
      // impede o recarregamento de acontecer por cima.
      evento.ports?.[0]?.postMessage({ ok: true });
      router.push(dados.url);
    }

    navigator.serviceWorker.addEventListener("message", aoReceber);
    return () => navigator.serviceWorker.removeEventListener("message", aoReceber);
  }, [router]);

  return null;
}
