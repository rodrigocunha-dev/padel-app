"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

// ============================================================
// PEDIR PERMISSÃO DE NOTIFICAÇÃO — e só quando faz sentido
// ============================================================
// A regra "quem não contestar em 24h concordou" só é justa se a pessoa teve
// chance real de saber. O aviso dentro do app alcança quem abre o app; o
// push alcança quem não abriu.
//
// ⚠️ Este bloco NÃO aparece no primeiro acesso. Pedir permissão antes de a
// pessoa entender para quê é o jeito mais rápido de levar um "não" que o
// navegador guarda para sempre — e aí não há segunda chance. Ele aparece
// depois que ela já tem jogo, que é quando o aviso passa a ter utilidade.
//
// ⚠️ NO IPHONE, o Safari não deixa nem PEDIR permissão se o app não estiver
// na tela de início (confirmado em 12/08/2026, vale desde o iOS 16.4 e
// alcança também Chrome e Edge no iPhone, que usam o mesmo motor). Por isso
// existe o ramo "instale primeiro" — sem ele, no iPhone o botão daria erro
// silencioso e ninguém entenderia por quê.

type Estado =
  | "verificando"
  | "sem-suporte"
  | "precisa-instalar"
  | "pode-ativar"
  | "ativando"
  | "ativo"
  | "bloqueado";

// A chave pública identifica nosso servidor para o navegador. É pública por
// natureza — vai no código do cliente de qualquer jeito.
function chaveParaBytes(base64: string): Uint8Array {
  const preenchido = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const bruto = atob(preenchido);
  return Uint8Array.from([...bruto].map((c) => c.charCodeAt(0)));
}

export function AtivarNotificacoes() {
  const [estado, setEstado] = useState<Estado>("verificando");

  useEffect(() => {
    async function verificar() {
      const temSuporte =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!temSuporte) {
        // No iPhone fora da tela de início é exatamente aqui que se cai: o
        // PushManager nem existe. Distinguir dos navegadores realmente sem
        // suporte olhando se é iOS.
        const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const instalado =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as { standalone?: boolean }).standalone === true;
        setEstado(ehIOS && !instalado ? "precisa-instalar" : "sem-suporte");
        return;
      }

      if (Notification.permission === "denied") {
        setEstado("bloqueado");
        return;
      }

      const registro = await navigator.serviceWorker.getRegistration();
      const inscricao = await registro?.pushManager.getSubscription();
      setEstado(inscricao ? "ativo" : "pode-ativar");
    }
    verificar();
  }, []);

  async function ativar() {
    setEstado("ativando");
    try {
      const registro = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "bloqueado" : "pode-ativar");
        posthog.capture("push_permissao_negada");
        return;
      }

      const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!chave) {
        console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada");
        setEstado("sem-suporte");
        return;
      }

      const inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveParaBytes(chave) as BufferSource,
      });

      const dados = inscricao.toJSON();
      const supabase = criarClienteNavegador();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // `upsert` pelo endpoint: se o navegador reinscreveu o mesmo aparelho,
      // atualiza a linha em vez de criar uma segunda.
      const { error } = await supabase.from("push_inscricoes").upsert(
        {
          jogador_id: user.id,
          endpoint: inscricao.endpoint,
          p256dh: dados.keys?.p256dh ?? "",
          auth: dados.keys?.auth ?? "",
          invalidado_em: null,
        },
        { onConflict: "endpoint" }
      );
      if (error) {
        console.error("Erro ao salvar inscrição de push:", error.message);
        setEstado("pode-ativar");
        return;
      }

      posthog.capture("push_ativado");
      setEstado("ativo");
    } catch (e) {
      console.error("Erro ao ativar notificações:", e);
      setEstado("pode-ativar");
    }
  }

  if (estado === "verificando" || estado === "ativo" || estado === "sem-suporte") {
    return null;
  }

  if (estado === "precisa-instalar") {
    return (
      <div className="mt-4 rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5">
        <p className="font-display text-sm font-bold text-tinta">
          📲 Instale o app para receber avisos
        </p>
        <p className="mt-1 text-xs text-tinta-suave">
          No iPhone, os avisos só funcionam com o app na tela de início. Toque
          em <strong>Compartilhar</strong> (o quadrado com a seta) e depois em{" "}
          <strong>Adicionar à Tela de Início</strong>. Abra por lá e o botão de
          ativar aparece aqui.
        </p>
      </div>
    );
  }

  if (estado === "bloqueado") {
    return (
      <div className="mt-4 rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5">
        <p className="font-display text-sm font-bold text-tinta">
          🔕 Avisos bloqueados neste aparelho
        </p>
        <p className="mt-1 text-xs text-tinta-suave">
          Você recusou as notificações antes, e o navegador guarda essa
          escolha. Para voltar atrás, libere as notificações deste site nos
          ajustes do navegador.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={ativar}
      disabled={estado === "ativando"}
      className="mt-4 block w-full rounded-2xl bg-superficie p-4 text-left shadow ring-1 ring-black/5 transition hover:ring-primaria/40 disabled:opacity-60"
    >
      <p className="font-display text-sm font-bold text-tinta">
        🔔 {estado === "ativando" ? "Ativando..." : "Ativar avisos no celular"}
      </p>
      <p className="mt-1 text-xs text-tinta-suave">
        Para saber quando registrarem um resultado seu — você tem 24h para
        contestar, e o aviso chega mesmo com o app fechado.
      </p>
    </button>
  );
}
