// Service worker do app do jogador.
//
// Ele existe por dois motivos, nesta ordem de importância:
//  1. Sem service worker não há Web Push — o navegador entrega a mensagem
//     AQUI, e não na página, porque o app pode estar fechado.
//  2. Ele é parte do que torna o app instalável ("Adicionar à Tela de
//     Início"), que no iPhone é obrigatório até para PEDIR permissão.
//
// ⚠️ De propósito, ele NÃO faz cache de nada. Cache offline é outro
// assunto, com outros riscos (tela velha, dado desatualizado), e misturar
// as duas coisas numa entrega só é como se erra feio em PWA.

self.addEventListener("install", () => {
  // Assume o controle sem esperar o usuário fechar todas as abas.
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    // Push sem corpo ou com corpo inválido: mostra algo genérico em vez de
    // engolir o aviso.
    dados = {};
  }

  const titulo = dados.titulo || "Padel";
  const opcoes = {
    body: dados.corpo || "Você tem uma novidade no app.",
    icon: "/icone-192.png",
    badge: "/icone-192.png",
    // A tag agrupa avisos do mesmo tipo: em vez de cinco notificações
    // iguais empilhadas, a última substitui a anterior.
    tag: dados.tag || "aviso",
    data: { url: dados.url || "/app" },
  };

  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/app";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      // Se o app já está aberto, leva a aba existente para o destino em vez
      // de abrir uma segunda cópia.
      for (const aba of abas) {
        if ("focus" in aba) {
          aba.navigate(destino);
          return aba.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
