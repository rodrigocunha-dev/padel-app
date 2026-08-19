"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

type Mensagem = {
  id: string;
  autor_id: string;
  texto: string;
  criado_em: string;
};

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) =>
    a.toDateString() === b.toDateString();

  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ChatPartida({
  partidaId,
  meuId,
  participantes,
}: {
  partidaId: string;
  meuId: string;
  participantes: { id: string; nome: string }[];
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement | null>(null);

  const nomeDe = useCallback(
    (id: string) =>
      participantes.find((p) => p.id === id)?.nome.split(" ")[0] ?? "Alguém",
    [participantes]
  );

  // "Li até aqui". É SEPARADO do `lido_em` do aviso, de propósito: um
  // responde "vi que tem mensagem" (e faz o bloco sumir da Início), o outro
  // responde "li até onde" (e zera o contador de não lidas). Marcar só um
  // deixaria o outro mentindo.
  const marcarLido = useCallback(async () => {
    const supabase = criarClienteNavegador();
    await supabase.rpc("marcar_chat_lido", { p_partida_id: partidaId });
  }, [partidaId]);

  useEffect(() => {
    const supabase = criarClienteNavegador();
    let vivo = true;

    (async () => {
      const { data } = await supabase
        .from("mensagens")
        .select("id, autor_id, texto, criado_em")
        .eq("partida_id", partidaId)
        .order("criado_em", { ascending: true })
        .limit(200);

      if (!vivo) return;
      setMensagens(data ?? []);
      setCarregando(false);
      marcarLido();
    })();

    // Tempo real: a mensagem do outro aparece sem recarregar. A RLS continua
    // valendo aqui — quem não está na conversa não recebe o evento.
    const canal = supabase
      .channel(`chat-${partidaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `partida_id=eq.${partidaId}`,
        },
        (payload) => {
          const nova = payload.new as Mensagem;
          setMensagens((atual) =>
            // O `insert` local já colocou a minha na lista; sem esta guarda
            // ela apareceria duas vezes.
            atual.some((m) => m.id === nova.id) ? atual : [...atual, nova]
          );
          if (nova.autor_id !== meuId) marcarLido();
        }
      )
      .subscribe();

    return () => {
      vivo = false;
      supabase.removeChannel(canal);
    };
  }, [partidaId, meuId, marcarLido]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "nearest" });
  }, [mensagens]);

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo) return;

    setEnviando(true);
    setErro(null);

    const supabase = criarClienteNavegador();
    const { data, error } = await supabase
      .from("mensagens")
      .insert({ partida_id: partidaId, autor_id: meuId, texto: limpo })
      .select("id, autor_id, texto, criado_em")
      .single();

    setEnviando(false);

    if (error) {
      setErro("Não conseguimos enviar. Tente de novo.");
      return;
    }

    setTexto("");
    setMensagens((atual) =>
      atual.some((m) => m.id === data.id) ? atual : [...atual, data]
    );
    posthog.capture("mensagem_enviada");
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-tinta">
        💬 Conversa do jogo
      </h2>
      <p className="mt-1 text-sm text-tinta-suave">
        Só quem está jogando vê e escreve aqui.
      </p>

      <div className="mt-3 rounded-2xl bg-superficie p-4 shadow-lg ring-1 ring-black/5">
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {carregando ? (
            <p className="py-4 text-center text-sm text-tinta-suave">
              Carregando…
            </p>
          ) : mensagens.length === 0 ? (
            <p className="py-6 text-center text-sm text-tinta-suave">
              Ninguém falou nada ainda. Combine o horário, quem leva as bolas,
              quem dá carona.
            </p>
          ) : (
            mensagens.map((m, i) => {
              const meu = m.autor_id === meuId;
              const anterior = mensagens[i - 1];
              const mudouDia =
                !anterior || dia(anterior.criado_em) !== dia(m.criado_em);

              return (
                <div key={m.id}>
                  {mudouDia && (
                    <p className="my-3 text-center text-xs font-medium text-tinta-suave">
                      {dia(m.criado_em)}
                    </p>
                  )}
                  <div className={meu ? "flex justify-end" : "flex"}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                        meu
                          ? "bg-primaria text-white"
                          : "bg-fundo text-tinta"
                      }`}
                    >
                      {!meu && (
                        <p className="text-xs font-bold text-primaria">
                          {nomeDe(m.autor_id)}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {m.texto}
                      </p>
                      <p
                        className={`mt-0.5 text-right text-[10px] ${
                          meu ? "text-white/70" : "text-tinta-suave"
                        }`}
                      >
                        {hora(m.criado_em)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={fim} />
        </div>

        {erro && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </p>
        )}

        <div className="mt-3 flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra linha. No celular o teclado
              // manda "Enter" de verdade só quando a pessoa toca em enviar.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={1}
            placeholder="Escreva para o grupo…"
            className="max-h-24 flex-1 resize-none rounded-xl border border-black/10 px-3 py-2.5 text-sm text-tinta outline-none focus:border-primaria"
          />
          <button
            type="button"
            disabled={enviando || texto.trim().length === 0}
            onClick={enviar}
            className="rounded-xl bg-primaria px-4 py-2.5 font-display font-bold text-white disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </section>
  );
}
