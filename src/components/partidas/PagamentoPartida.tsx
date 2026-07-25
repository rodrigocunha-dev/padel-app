"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { gatewayPagamento, pagamentoEhSimulado } from "@/lib/pagamentos";
import { dividirValor } from "@/lib/partidas";

type JogadorPag = {
  jogador_id: string;
  nome: string;
  ehOrganizador: boolean;
};

type Pagamento = {
  jogador_id: string;
  status: string;
  cobranca_externa_id: string | null;
};

function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function PagamentoPartida({
  partidaId,
  meuId,
  souOrganizador,
  totalCentavos,
  maxJogadores,
  jogadores, // ordenados por ordem de entrada
  resumoPartida, // ex.: "Quadra 2, sex 20h — Clube Teste"
}: {
  partidaId: string;
  meuId: string;
  souOrganizador: boolean;
  totalCentavos: number;
  maxJogadores: number;
  jogadores: JogadorPag[];
  resumoPartida: string;
}) {
  const router = useRouter();
  const supabase = criarClienteNavegador();
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cobranca, setCobranca] = useState<{
    qrCode: string;
    copiaECola: string;
    cobrancaId: string;
  } | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  // Cada jogador paga uma parte igual; a sobra de centavos vai para os
  // primeiros da lista. O total é dividido pelo número de vagas da partida.
  const partes = dividirValor(totalCentavos, maxJogadores);

  async function carregar() {
    const { data } = await supabase
      .from("pagamentos")
      .select("jogador_id, status, cobranca_externa_id")
      .eq("partida_id", partidaId);
    setPagamentos((data as Pagamento[]) ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    const canal = supabase
      .channel(`pagamentos-${partidaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pagamentos" },
        () => carregar()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaId]);

  const statusDe = (jid: string) =>
    pagamentos.find((p) => p.jogador_id === jid)?.status ?? "sem";

  const minhaParte = (() => {
    const idx = jogadores.findIndex((j) => j.jogador_id === meuId);
    return idx >= 0 ? partes[idx] ?? 0 : 0;
  })();
  const jaPaguei = statusDe(meuId) === "pago";
  const souJogador = jogadores.some((j) => j.jogador_id === meuId);

  async function pagar() {
    setErro(null);
    setGerando(true);
    try {
      // 1) Pede a cobrança ao gateway (hoje o simulado gera um QR fake).
      const cob = await gatewayPagamento.criarCobranca({
        valorCentavos: minhaParte,
        descricao: `Sua parte — ${resumoPartida}`,
        referencia: `${partidaId}:${meuId}`,
      });

      // 2) Registra o pagamento como pendente (cria ou reaproveita a linha).
      const { error } = await supabase.from("pagamentos").upsert(
        {
          partida_id: partidaId,
          jogador_id: meuId,
          valor_centavos: minhaParte,
          status: "pendente",
          provedor: gatewayPagamento.nome,
          cobranca_externa_id: cob.cobrancaId,
          qr_code: cob.qrCode,
          copia_e_cola: cob.copiaECola,
        },
        { onConflict: "partida_id,jogador_id" }
      );
      if (error) throw error;

      setCobranca({
        qrCode: cob.qrCode,
        copiaECola: cob.copiaECola,
        cobrancaId: cob.cobrancaId,
      });
      posthog.capture("pagamento_iniciado", { valor_centavos: minhaParte });
    } catch (e) {
      console.error("Erro ao gerar cobrança:", e);
      setErro("Não conseguimos gerar o PIX. Tente de novo.");
    }
    setGerando(false);
  }

  // Só existe enquanto o gateway é o simulado. Chama o MESMO endpoint que
  // o gateway real vai chamar quando o PIX cair.
  async function simularConfirmado() {
    if (!cobranca) return;
    setConfirmando(true);
    const resp = await fetch("/api/pagamentos/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cobrancaId: cobranca.cobrancaId }),
    });
    setConfirmando(false);
    if (!resp.ok) {
      setErro("Não conseguimos confirmar. Tente de novo.");
      return;
    }
    posthog.capture("pagamento_confirmado_simulado");
    setCobranca(null);
    carregar();
    router.refresh();
  }

  // Organizador cobra um jogador pelo WhatsApp: busca o contato (só o
  // organizador pode) e abre a conversa com a mensagem pronta.
  async function cobrarNoWhatsapp(jid: string, nome: string, parte: number) {
    const { data, error } = await supabase.rpc("contato_jogadores_partida", {
      p_partida_id: partidaId,
    });
    if (error || !data) {
      setErro("Não conseguimos abrir o WhatsApp agora.");
      return;
    }
    const contato = (data as { jogador_id: string; telefone: string }[]).find(
      (c) => c.jogador_id === jid
    );
    if (!contato?.telefone) {
      setErro("Esse jogador não tem WhatsApp cadastrado.");
      return;
    }
    const msg =
      `Oi ${nome.split(" ")[0]}! Falta a sua parte de ${formatarReais(parte)} ` +
      `da nossa partida (${resumoPartida}). Consegue acertar pelo app? Valeu!`;
    const numero = contato.telefone.replace(/\D/g, "");
    posthog.capture("cobranca_whatsapp_aberta");
    window.open(
      `https://wa.me/55${numero}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }

  if (totalCentavos <= 0) return null;

  const quantosPagaram = jogadores.filter(
    (j) => statusDe(j.jogador_id) === "pago"
  ).length;

  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-bold text-tinta">
        Divisão do pagamento
      </h2>
      <p className="mt-1 text-sm text-tinta-suave">
        {quantosPagaram}/{jogadores.length} pagaram · a quadra sai por{" "}
        {formatarReais(totalCentavos)}, dividida sem taxa nenhuma.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {jogadores.map((j, i) => {
          const st = statusDe(j.jogador_id);
          const parte = partes[i] ?? 0;
          const pago = st === "pago";
          return (
            <div
              key={j.jogador_id}
              className="flex items-center justify-between gap-2 rounded-xl bg-superficie p-3 shadow ring-1 ring-black/5"
            >
              <div>
                <p className="text-sm font-medium text-tinta">
                  {j.nome}
                  {j.jogador_id === meuId && (
                    <span className="text-tinta-suave"> (você)</span>
                  )}
                </p>
                <p className="text-xs text-tinta-suave">
                  {formatarReais(parte)} ·{" "}
                  {pago ? (
                    <span className="font-bold text-primaria">pago ✓</span>
                  ) : (
                    <span className="text-tinta-suave">em aberto</span>
                  )}
                </p>
              </div>
              {/* Organizador cobra os pendentes (menos ele mesmo) */}
              {souOrganizador && !pago && j.jogador_id !== meuId && (
                <button
                  type="button"
                  onClick={() => cobrarNoWhatsapp(j.jogador_id, j.nome, parte)}
                  className="shrink-0 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-95"
                >
                  💬 Cobrar
                </button>
              )}
            </div>
          );
        })}
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-600">{erro}</p>}

      {/* Minha parte */}
      {souJogador && !jaPaguei && !cobranca && (
        <button
          type="button"
          onClick={pagar}
          disabled={gerando}
          className="mt-4 w-full rounded-full bg-destaque px-6 py-3 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
        >
          {gerando
            ? "Gerando PIX..."
            : `Pagar minha parte (${formatarReais(minhaParte)})`}
        </button>
      )}

      {souJogador && jaPaguei && (
        <p className="mt-4 rounded-xl bg-primaria/10 p-3 text-center text-sm font-bold text-primaria">
          Sua parte está paga. 🎾
        </p>
      )}

      {/* QR da cobrança */}
      {cobranca && (
        <div className="mt-4 rounded-2xl bg-superficie p-5 text-center shadow ring-1 ring-black/5">
          <p className="text-sm font-medium text-tinta">
            Pague {formatarReais(minhaParte)} com este PIX
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cobranca.qrCode}
            alt="QR do PIX"
            className="mx-auto mt-3 h-44 w-44"
          />
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(cobranca.copiaECola)}
            className="mt-3 text-sm font-medium text-primaria hover:underline"
          >
            Copiar PIX copia e cola
          </button>

          {pagamentoEhSimulado && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-800">
                Modo teste — nenhum dinheiro é movimentado.
              </p>
              <button
                type="button"
                onClick={simularConfirmado}
                disabled={confirmando}
                className="mt-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-60"
              >
                {confirmando ? "Confirmando..." : "Simular pagamento confirmado"}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCobranca(null)}
            className="mt-3 block w-full text-sm text-tinta-suave hover:text-tinta"
          >
            Fechar
          </button>
        </div>
      )}
    </section>
  );
}
