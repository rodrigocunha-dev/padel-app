"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

export type Proposta = {
  id: string;
  proposta_por: string;
  categoria_min: number | null;
  categoria_max: number | null;
  competitiva: boolean | null;
  sexo_jogo: string | null;
  max_jogadores: number | null;
  jaVotei: boolean;
};

type Atual = {
  categoria_min: number;
  categoria_max: number;
  competitiva: boolean;
  sexo_jogo: string;
  max_jogadores: number;
};

const SEXO: Record<string, string> = {
  masculino: "Masculina",
  feminino: "Feminina",
  mista: "Mista",
};

const ERROS: Record<string, string> = {
  COMPETITIVA_SO_COM_4: "Partida competitiva é só com 4 jogadores.",
  MENOS_QUE_OS_JOGADORES:
    "Não dá para deixar menos vagas do que gente já dentro da partida.",
  JA_HA_PROPOSTA: "Já existe uma mudança esperando resposta.",
  PARTIDA_JA_COMECOU: "A partida já começou.",
  FAIXA_INVALIDA: "A categoria mínima não pode ser maior que a máxima.",
  PROPOSTA_ENCERRADA: "Essa mudança já foi resolvida.",
};

function traduzir(mensagem: string): string {
  const chave = Object.keys(ERROS).find((k) => mensagem.includes(k));
  return chave ? ERROS[chave] : "Não conseguimos concluir. Tente de novo.";
}

// Descreve a mudança em palavras, campo a campo. Mostrar só os valores novos
// obrigaria quem vota a lembrar como era — e ninguém lembra.
function diferencas(atual: Atual, p: Proposta): string[] {
  const lista: string[] = [];
  if (p.categoria_min !== null && p.categoria_max !== null &&
      (p.categoria_min !== atual.categoria_min || p.categoria_max !== atual.categoria_max)) {
    lista.push(
      `Categorias: de ${atual.categoria_min}ª–${atual.categoria_max}ª para ${p.categoria_min}ª–${p.categoria_max}ª`
    );
  }
  if (p.competitiva !== null && p.competitiva !== atual.competitiva) {
    lista.push(
      `Passa a ser ${p.competitiva ? "competitiva (vale rating)" : "amistosa (não vale rating)"}`
    );
  }
  if (p.sexo_jogo && p.sexo_jogo !== atual.sexo_jogo) {
    lista.push(`Partida: de ${SEXO[atual.sexo_jogo]} para ${SEXO[p.sexo_jogo]}`);
  }
  if (p.max_jogadores !== null && p.max_jogadores !== atual.max_jogadores) {
    lista.push(
      `Jogadores: de ${atual.max_jogadores} para ${p.max_jogadores}`
    );
  }
  return lista;
}

export function EditarPartidaAberta({
  partidaId,
  meuId,
  souOrganizador,
  souJogador,
  jaComecou,
  atual,
  proposta,
}: {
  partidaId: string;
  meuId: string;
  souOrganizador: boolean;
  souJogador: boolean;
  jaComecou: boolean;
  atual: Atual;
  proposta: Proposta | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [catMin, setCatMin] = useState(atual.categoria_min);
  const [catMax, setCatMax] = useState(atual.categoria_max);
  const [competitiva, setCompetitiva] = useState(atual.competitiva);
  const [sexo, setSexo] = useState(atual.sexo_jogo);
  const [maxJog, setMaxJog] = useState(atual.max_jogadores);

  async function propor() {
    setOcupado(true);
    setErro(null);
    setAviso(null);

    const supabase = criarClienteNavegador();
    const { data, error } = await supabase.rpc("propor_edicao_partida", {
      p_partida_id: partidaId,
      p_categoria_min: catMin,
      p_categoria_max: catMax,
      p_competitiva: competitiva,
      p_sexo_jogo: sexo,
      p_max_jogadores: maxJog,
    });
    setOcupado(false);

    if (error) {
      setErro(traduzir(error.message));
      return;
    }

    const r = data as { aplicada: boolean; faltam: number };
    posthog.capture("partida_editada", { aplicada: r.aplicada });
    setAberto(false);
    if (!r.aplicada) {
      setAviso(
        `Pedido enviado. ${r.faltam === 1 ? "1 jogador precisa" : `${r.faltam} jogadores precisam`} aprovar.`
      );
    }
    router.refresh();
  }

  async function responder(aprovou: boolean) {
    if (!proposta) return;
    setOcupado(true);
    setErro(null);

    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc("responder_edicao_partida", {
      p_edicao_id: proposta.id,
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
    if (!proposta) return;
    setOcupado(true);
    const supabase = criarClienteNavegador();
    await supabase.rpc("cancelar_edicao_partida", { p_edicao_id: proposta.id });
    setOcupado(false);
    router.refresh();
  }

  // ---------- Há uma mudança esperando resposta ----------
  if (proposta) {
    const mudancas = diferencas(atual, proposta);
    const souAutor = proposta.proposta_por === meuId;

    return (
      <section className="mt-4 rounded-2xl bg-destaque p-5 shadow-lg">
        <p className="font-display text-base font-bold text-destaque-tinta">
          ✏️ {souAutor ? "Sua mudança está esperando" : "O organizador quer mudar a partida"}
        </p>

        <ul className="mt-3 space-y-1.5">
          {mudancas.length === 0 ? (
            <li className="text-sm text-destaque-tinta/80">
              Sem diferença em relação ao que já está valendo.
            </li>
          ) : (
            mudancas.map((m) => (
              <li key={m} className="text-sm text-destaque-tinta">
                • {m}
              </li>
            ))
          )}
        </ul>

        {erro && (
          <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-red-700">
            {erro}
          </p>
        )}

        {souAutor ? (
          <>
            <p className="mt-3 text-xs text-destaque-tinta/80">
              Só vale quando todos os jogadores aprovarem.
            </p>
            <button
              type="button"
              disabled={ocupado}
              onClick={cancelar}
              className="mt-3 w-full rounded-xl bg-white/80 px-4 py-3 font-display font-bold text-destaque-tinta disabled:opacity-50"
            >
              Desistir da mudança
            </button>
          </>
        ) : proposta.jaVotei ? (
          <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm font-medium text-destaque-tinta">
            Você já aprovou. Falta o resto do grupo.
          </p>
        ) : (
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => responder(false)}
              className="flex-1 rounded-xl bg-white/80 px-4 py-3 font-display font-bold text-destaque-tinta disabled:opacity-50"
            >
              Recusar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => responder(true)}
              className="flex-1 rounded-xl bg-primaria px-4 py-3 font-display font-bold text-white disabled:opacity-50"
            >
              Aprovar
            </button>
          </div>
        )}

        {!souAutor && !proposta.jaVotei && (
          <p className="mt-3 text-xs text-destaque-tinta/80">
            Se você recusar, a partida continua como está.
          </p>
        )}
      </section>
    );
  }

  // ---------- Sem proposta: só o organizador vê o botão ----------
  if (!souOrganizador || jaComecou || !souJogador) return null;

  if (!aberto) {
    return (
      <>
        {aviso && (
          <p className="mt-4 rounded-2xl bg-primaria/10 p-4 text-sm font-bold text-primaria">
            {aviso}
          </p>
        )}
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="mt-4 w-full rounded-2xl bg-superficie p-5 text-left shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
        >
          <p className="font-display text-base font-bold text-tinta">
            ✏️ Editar partida
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            Categoria, tipo de jogo e número de jogadores
          </p>
        </button>
      </>
    );
  }

  return (
    <section className="mt-4 rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
      <p className="font-display text-base font-bold text-tinta">
        Editar partida
      </p>

      <div className="mt-4">
        <p className="text-sm font-medium text-tinta">Categorias aceitas</p>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={catMin}
            onChange={(e) => setCatMin(Number(e.target.value))}
            className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm text-tinta"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((c) => (
              <option key={c} value={c}>
                {c}ª
              </option>
            ))}
          </select>
          <span className="text-sm text-tinta-suave">até</span>
          <select
            value={catMax}
            onChange={(e) => setCatMax(Number(e.target.value))}
            className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm text-tinta"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((c) => (
              <option key={c} value={c}>
                {c}ª
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-tinta">Tipo</p>
        <div className="mt-2 flex gap-2">
          {[
            [true, "Competitiva"],
            [false, "Amistosa"],
          ].map(([v, r]) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setCompetitiva(v as boolean)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
                competitiva === v
                  ? "bg-primaria text-white"
                  : "bg-fundo text-tinta-suave"
              }`}
            >
              {r as string}
            </button>
          ))}
        </div>
        {competitiva && (
          <p className="mt-1.5 text-xs text-tinta-suave">
            Competitiva é só com 4 jogadores.
          </p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-tinta">Quem pode jogar</p>
        <div className="mt-2 flex gap-2">
          {Object.entries(SEXO).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSexo(id)}
              className={`flex-1 rounded-xl px-2 py-2 text-xs font-bold ${
                sexo === id ? "bg-primaria text-white" : "bg-fundo text-tinta-suave"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-tinta">Número de jogadores</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMaxJog(n)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                maxJog === n ? "bg-primaria text-white" : "bg-fundo text-tinta-suave"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setErro(null);
          }}
          className="flex-1 rounded-xl bg-fundo px-4 py-3 font-display font-bold text-tinta-suave"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={propor}
          className="flex-1 rounded-xl bg-primaria px-4 py-3 font-display font-bold text-white disabled:opacity-50"
        >
          {ocupado ? "Salvando…" : "Salvar"}
        </button>
      </div>

      <p className="mt-3 text-xs text-tinta-suave">
        Se já houver outros jogadores, a mudança só vale depois que todos
        aprovarem.
      </p>
    </section>
  );
}
