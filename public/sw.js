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
    (async () => {
      const abas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // App fechado: abre direto no destino. Simples e sem atraso.
      const aba = abas.find((a) => "focus" in a);
      if (!aba) return self.clients.openWindow(destino);

      // App já aberto em segundo plano. Aqui `aba.navigate()` funcionaria,
      // mas recarrega a página inteira — e no iPhone o efeito é feio: o
      // sistema restaura o app na tela onde a pessoa estava e só depois a
      // navegação acontece, com alguns segundos de salto visível.
      //
      // Então pedimos à própria página que navegue por dentro (a mesma
      // navegação de quando se toca num link), que é quase instantânea.
      await aba.focus();

      const respondeu = await new Promise((resolve) => {
        const canal = new MessageChannel();
        const prazo = setTimeout(() => resolve(false), 500);
        canal.port1.onmessage = () => {
          clearTimeout(prazo);
          resolve(true);
        };
        aba.postMessage({ tipo: "ir-para", url: destino }, [canal.port2]);
      });

      // Se a página não respondeu (versão antiga em cache, aba sem o
      // ouvinte), cai no caminho antigo. Lento, mas nunca deixa de levar a
      // pessoa ao lugar certo — que é o que não pode falhar.
      if (!respondeu) return aba.navigate(destino);
    })()
  );
});
