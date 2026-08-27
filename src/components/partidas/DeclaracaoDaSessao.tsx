"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

// "Este jogo vale rating?" — na sessão privada.
//
// Ficou de fora em 08/08/2026: sessão privada contava sempre, e quem não
// quisesse que contasse não registrava o set. O caso que trouxe a decisão de
// volta é real: um jogador mais forte jogando com um amigo mais fraco quer o
// jogo no histórico, mas não quer arriscar a categoria numa derrota. Sem
// meio-termo, ele perde as três coisas de uma vez.
//
// Não é escapatória: a escolha acontece ANTES de existir resultado, e o
// servidor congela tudo quando o jogo começa.
//
// Segue a mesma lógica da partida aberta: sozinho vale na hora; com gente
// dentro, todo mundo precisa aprovar.
type Proposta = {
  id: string;
  competitiva: boolean | null;
  proposta_por: string;
  jaVotei: boolean;
};

const ERROS: Record<string, string> = {
  PARTIDA_JA_COMECOU:
    "O jogo já começou — a declaração não muda mais.",
  JA_HA_PROPOSTA:
    "Já existe um pedido de mudança esperando resposta.",
  JA_ESTA_ASSIM: "O jogo já está assim.",
  SO_O_ORGANIZADOR: "Só o organizador pode mudar isso.",
};

function traduzir(msg: string): string {
  const chave = Object.keys(ERROS).find((k) => msg.includes(k));
  return chave ? ERROS[chave] : "Não conseguimos concluir. Tente de novo.";
}

export function DeclaracaoDaSessao({
  partidaId,
  competitiva,
  souOrganizador,
  souParticipante,
  jaComecou,
  cancelada,
  proposta,
  meuId,
}: {
  partidaId: string;
  competitiva: boolean;
  souOrganizador: boolean;
  souParticipante: boolean;
  jaComecou: boolean;
  cancelada: boolean;
  proposta: Proposta | null;
  meuId: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // A proposta só interessa aqui se ela mexe na declaração. Uma proposta de
  // partida aberta (faixa, sexo, tamanho) tem `competitiva` preenchida
  // também, mas em sessão privada a única que existe é esta.
  const propostaDaDeclaracao =
    proposta && proposta.competitiva !== null ? proposta : null;

  async function propor(novo: boolean) {
    setOcupado(true);
    setErro(null);
    setAviso(null);

    const supabase = criarClienteNavegador();
    const { data, error } = await supabase.rpc("propor_declaracao_sessao", {
      p_partida_id: partidaId,
      p_competitiva: novo,
    });
    setOcupado(false);

    if (error) {
      setErro(traduzir(error.message));
      return;
    }

    const r = data as { aplicada: boolean; faltam: number };
    posthog.capture("declaracao_sessao_proposta", { aplicada: r.aplicada });
    if (!r.aplicada) {
      setAviso(
        `Pedido enviado. ${
          r.faltam === 1
            ? "1 jogador precisa"
            : `${r.faltam} jogadores precisam`
        } aprovar.`
      );
    }
    router.refresh();
  }

  async function responder(aprovou: boolean) {
    if (!propostaDaDeclaracao) return;
    setOcupado(true);
    setErro(null);

    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc("responder_edicao_partida", {
      p_edicao_id: propostaDaDeclaracao.id,
      p_aprovou: aprovou,
    });
    setOcupado(false);

    if (error) {
      setErro(traduzir(error.message));
      return;
    }
    posthog.capture("edicao_partida_respondida", { aprovou });
    router.refresh();
  }

  async function cancelar() {
    if (!propostaDaDeclaracao) return;
    setOcupado(true);
    const supabase = criarClienteNavegador();
    await supabase.rpc("cancelar_edicao_partida", {
      p_edicao_id: propostaDaDeclaracao.id,
    });
    setOcupado(false);
    router.refresh();
  }

  // ---------- Há um pedido esperando resposta ----------
  if (propostaDaDeclaracao) {
    const souAutor = propostaDaDeclaracao.proposta_por === meuId;
    const querCompetitiva = propostaDaDeclaracao.competitiva === true;

    return (
      <section className="mt-4 rounded-2xl bg-destaque p-5 shadow-lg">
        <p className="font-display text-base font-bold text-destaque-tinta">
          ✏️ Querem mudar este jogo
        </p>
        {/* Em palavras, não só o valor novo: quem vota não lembra como era. */}
        <p className="mt-1 text-sm text-destaque-tinta/90">
          De <strong>{competitiva ? "vale rating" : "amistoso"}</strong> para{" "}
          <strong>{querCompetitiva ? "vale rating" : "amistoso"}</strong>.
        </p>
        <p className="mt-2 text-xs text-destaque-tinta/80">
          {querCompetitiva
            ? "Os sets deste jogo passariam a mexer na categoria de todo mundo."
            : "Os sets continuariam sendo registrados, mas não mexeriam na categoria de ninguém."}
        </p>

        {souAutor ? (
          <button
            type="button"
            onClick={cancelar}
            disabled={ocupado}
            className="mt-4 rounded-full border border-black/10 bg-white/70 px-5 py-2.5 text-sm font-bold text-destaque-tinta transition hover:bg-white disabled:opacity-50"
          >
            Cancelar o pedido
          </button>
        ) : propostaDaDeclaracao.jaVotei ? (
          <p className="mt-4 text-sm font-medium text-destaque-tinta">
            Você já respondeu. Falta o resto do grupo.
          </p>
        ) : souParticipante ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => responder(true)}
              disabled={ocupado}
              className="flex-1 rounded-full bg-primaria px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Aprovar
            </button>
            <button
              type="button"
              onClick={() => responder(false)}
              disabled={ocupado}
              className="rounded-full border border-black/10 bg-white/70 px-5 py-2.5 text-sm font-bold text-destaque-tinta transition hover:bg-white disabled:opacity-50"
            >
              Recusar
            </button>
          </div>
        ) : null}

        {erro && (
          <p className="mt-3 text-sm font-medium text-red-700">{erro}</p>
        )}
      </section>
    );
  }

  // ---------- Sem pedido: só o organizador muda ----------
  if (!souOrganizador || jaComecou || cancelada) return null;

  return (
    <section className="mt-3">
      <button
        type="button"
        onClick={() => propor(!competitiva)}
        disabled={ocupado}
        className="text-xs font-bold text-primaria underline underline-offset-2 transition hover:opacity-80 disabled:opacity-50"
      >
        {competitiva
          ? "Marcar como amistoso (não mexe na categoria)"
          : "Marcar como vale rating"}
      </button>
      {aviso && (
        <p className="mt-2 text-sm font-medium text-tinta-suave">{aviso}</p>
      )}
      {erro && <p className="mt-2 text-sm font-medium text-red-700">{erro}</p>}
    </section>
  );
}
