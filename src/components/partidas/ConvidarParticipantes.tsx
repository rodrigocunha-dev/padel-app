"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { ROTULO_CATEGORIA } from "@/lib/partidas";
import { AvisoPendencia } from "@/components/partidas/AvisoPendencia";

export type Participante = {
  jogador_id: string | null;
  estado: string;
  papel: string;
  desistiu_em: string | null;
  perfil: { nome: string; foto_url: string | null; categoria: number } | null;
};

const ROTULO_ESTADO: Record<string, string> = {
  aceito: "Confirmado",
  convidado: "Convidado",
  recusado: "Recusou",
};

const CLASSE_ESTADO: Record<string, string> = {
  aceito: "bg-primaria/10 text-primaria",
  convidado: "bg-amber-100 text-amber-800",
  recusado: "bg-red-100 text-red-700",
};

// Mensagens do servidor traduzidas. O banco fala em código; o jogador, não.
const ERROS: Record<string, string> = {
  PRECISA_TER_CONTA: "Essa pessoa ainda não tem conta no app.",
  PARTIDA_CHEIA: "Todas as vagas já estão preenchidas ou convidadas.",
  PARTIDA_JA_COMECOU: "O jogo já começou — não dá mais para convidar.",
  SO_O_ORGANIZADOR_CONVIDA: "Só quem montou o jogo pode convidar.",
  CONVITE_JA_RESPONDIDO: "Você já respondeu a este convite.",
  PENDENCIA: "Você tem um jogo não pago. Acerte antes de entrar em outro.",
  SEM_VAGA_ABERTA:
    "O grupo já está fechado. Só dá para convidar se alguém recusar ou desistir.",
  SO_QUEM_ACEITOU_DESISTE: "Só quem já confirmou pode desistir.",
  NADA_PARA_CANCELAR: "Você não tinha avisado que ia desistir.",
};

function traduzir(msg: string | undefined): string {
  if (!msg) return "Não deu certo. Tente de novo.";
  const chave = Object.keys(ERROS).find((k) => msg.includes(k));
  return chave ? ERROS[chave] : "Não deu certo. Tente de novo.";
}

export function ConvidarParticipantes({
  partidaId,
  meuId,
  souOrganizador,
  jaComecou,
  participantes,
}: {
  partidaId: string;
  meuId: string;
  souOrganizador: boolean;
  jaComecou: boolean;
  participantes: Participante[];
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<
    { id: string; nome: string; categoria: number }[]
  >([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Pendência não é um erro qualquer: tem caminho de saída, então vira link.
  const [ehPendencia, setEhPendencia] = useState(false);

  const meuConvite = participantes.find((p) => p.jogador_id === meuId);
  const jaNaLista = new Set(participantes.map((p) => p.jogador_id));

  // Tempo real: quem aceitar aparece sem recarregar.
  useEffect(() => {
    const supabase = criarClienteNavegador();
    const canal = supabase
      .channel(`sessao-${partidaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partida_jogadores" },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [partidaId, router]);

  async function procurar(texto: string) {
    setBusca(texto);
    setErro(null);
    if (texto.trim().length < 3) {
      setAchados([]);
      return;
    }
    const supabase = criarClienteNavegador();
    // O telefone é fechado no banco, então a busca é por nome. Convidar
    // por telefone (inclusive quem ainda não tem conta) é a próxima etapa.
    const { data } = await supabase
      .from("jogadores")
      .select("id, nome, categoria")
      .ilike("nome", `%${texto.trim()}%`)
      .limit(8);
    setAchados((data ?? []).filter((j) => !jaNaLista.has(j.id)));
  }

  async function convidar(jogadorId: string, nome: string) {
    setOcupado(true);
    setErro(null);
    setEhPendencia(false);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc("convidar_participante", {
      p_partida_id: partidaId,
      p_jogador_id: jogadorId,
    });
    setOcupado(false);
    if (error) {
      setEhPendencia(error.message.includes("PENDENCIA"));
      setErro(traduzir(error.message));
      return;
    }
    posthog.capture("participante_convidado");
    setBusca("");
    setAchados([]);
    router.refresh();
    void nome;
  }

  // "Desistir" NÃO tira você do jogo: avisa o grupo que a vaga está
  // disponível. Você só sai de fato quando alguém assumir — e dá para
  // voltar atrás enquanto isso não acontece.
  async function desistir(voltarAtras: boolean) {
    setOcupado(true);
    setErro(null);
    setEhPendencia(false);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc(
      voltarAtras ? "cancelar_desistencia" : "desistir_da_sessao",
      { p_partida_id: partidaId }
    );
    setOcupado(false);
    if (error) {
      setEhPendencia(error.message.includes("PENDENCIA"));
      setErro(traduzir(error.message));
      return;
    }
    posthog.capture(voltarAtras ? "desistencia_cancelada" : "desistiu_da_sessao");
    router.refresh();
  }

  async function responder(aceito: boolean) {
    setOcupado(true);
    setErro(null);
    setEhPendencia(false);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc("responder_convite", {
      p_partida_id: partidaId,
      p_aceito: aceito,
    });
    setOcupado(false);
    if (error) {
      setEhPendencia(error.message.includes("PENDENCIA"));
      setErro(traduzir(error.message));
      return;
    }
    posthog.capture(aceito ? "convite_aceito" : "convite_recusado");
    router.refresh();
  }

  const aceitos = participantes.filter((p) => p.estado === "aceito").length;

  return (
    <section className="mt-6">
      {/* Fica no TOPO de propósito: quem tem convite pendente tem uma ação a
          fazer aqui, e ela não pode exigir rolagem.
          Aparece MESMO depois de a partida começar — o servidor permite
          aceitar, e esconder aqui travava o jogo para sempre: sem os quatro
          confirmados, nenhum set pode ser registrado. */}
      {meuConvite?.estado === "convidado" && (
        <div className="mb-6 rounded-2xl bg-destaque p-5 shadow-lg">
          <p className="font-display font-bold text-destaque-tinta">
            Você foi convidado para este jogo
          </p>
          <p className="mt-1 text-sm text-destaque-tinta/80">
            Aceitando, você entra na partida e na divisão do valor da quadra.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => responder(true)}
              className="flex-1 rounded-full bg-primaria px-5 py-2.5 font-display font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              Aceitar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => responder(false)}
              className="rounded-full px-5 py-2.5 font-display font-bold text-destaque-tinta ring-1 ring-destaque-tinta/30 transition hover:bg-white/30 disabled:opacity-50"
            >
              Recusar
            </button>
          </div>
        </div>
      )}

      <h2 className="font-display text-lg font-bold text-tinta">
        Quem vai jogar
      </h2>
      <p className="mt-1 text-sm text-tinta-suave">
        {aceitos} confirmado{aceitos === 1 ? "" : "s"}. Convidado não conta
        até aceitar.
      </p>

      <ul className="mt-3 space-y-2">
        {participantes.map((p, i) => (
          <li
            key={p.jogador_id ?? `sem-conta-${i}`}
            className="flex items-center justify-between gap-3 rounded-2xl bg-superficie p-4 shadow ring-1 ring-black/5"
          >
            <div className="min-w-0">
              <p className="truncate font-display font-bold text-tinta">
                {p.perfil?.nome ?? "Jogador"}
              </p>
              {p.perfil && (
                <p className="text-xs text-tinta-suave">
                  {ROTULO_CATEGORIA[p.perfil.categoria]} categoria
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                p.desistiu_em
                  ? "bg-amber-100 text-amber-800"
                  : CLASSE_ESTADO[p.estado] ?? "bg-fundo text-tinta-suave"
              }`}
            >
              {p.desistiu_em
                ? "Vaga disponível"
                : ROTULO_ESTADO[p.estado] ?? p.estado}
            </span>
          </li>
        ))}
      </ul>

      {/* Já confirmei e ainda dá tempo: posso avisar que talvez não vá */}
      {meuConvite?.estado === "aceito" && !jaComecou && (
        <div className="mt-4 rounded-2xl bg-superficie p-5 shadow ring-1 ring-black/5">
          {meuConvite.desistiu_em ? (
            <>
              <p className="font-display font-bold text-tinta">
                O grupo sabe que sua vaga está disponível
              </p>
              <p className="mt-1 text-sm text-tinta-suave">
                Você continua no jogo até alguém assumir. Se ninguém assumir
                até a hora de jogar, a vaga segue sua.
              </p>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => desistir(true)}
                className="mt-3 rounded-full bg-primaria px-5 py-2.5 font-display font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                Voltar atrás, eu vou jogar
              </button>
            </>
          ) : (
            <>
              <p className="font-display font-bold text-tinta">
                Não vai conseguir ir?
              </p>
              <p className="mt-1 text-sm text-tinta-suave">
                Avise o grupo que sua vaga está disponível. Você{" "}
                <strong>não sai do jogo</strong> — só sai se alguém assumir
                seu lugar.
              </p>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => desistir(false)}
                className="mt-3 rounded-full px-5 py-2.5 font-display font-bold text-tinta ring-1 ring-black/10 transition hover:ring-primaria/40 disabled:opacity-50"
              >
                Avisar que posso não ir
              </button>
            </>
          )}
        </div>
      )}

      {/* Só o organizador convida, e só antes do jogo começar */}
      {souOrganizador && !jaComecou && (
        <div className="mt-4 rounded-2xl bg-superficie p-5 shadow ring-1 ring-black/5">
          <label
            htmlFor="busca-jogador"
            className="font-display font-bold text-tinta"
          >
            Convidar alguém
          </label>
          <p className="mt-1 text-xs text-tinta-suave">
            Digite pelo menos 3 letras do nome. A pessoa precisa ter conta no
            app e vai receber um convite para aceitar.
          </p>
          <input
            id="busca-jogador"
            type="text"
            value={busca}
            onChange={(e) => procurar(e.target.value)}
            placeholder="Nome do jogador"
            className="mt-3 w-full rounded-xl border-0 bg-fundo px-4 py-3 text-tinta ring-1 ring-black/10 focus:ring-2 focus:ring-primaria"
          />

          {achados.length > 0 && (
            <ul className="mt-3 space-y-2">
              {achados.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => convidar(j.id, j.nome)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-fundo p-3 text-left transition hover:ring-1 hover:ring-primaria/40 disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-tinta">
                        {j.nome}
                      </span>
                      <span className="text-xs text-tinta-suave">
                        {ROTULO_CATEGORIA[j.categoria]} categoria
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-primaria">
                      Convidar
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {busca.trim().length >= 3 && achados.length === 0 && (
            <p className="mt-3 text-sm text-tinta-suave">
              Ninguém com esse nome. Quem ainda não tem conta não aparece aqui.
            </p>
          )}
        </div>
      )}

      {erro &&
        (ehPendencia ? (
          <AvisoPendencia texto={erro} />
        ) : (
          <p className="mt-3 rounded-xl bg-red-100 p-3 text-sm font-medium text-red-700">
            {erro}
          </p>
        ))}
    </section>
  );
}
