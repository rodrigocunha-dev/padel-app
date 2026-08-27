"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  faixaCategoria,
  ROTULO_CATEGORIA,
  ROTULO_SEXO_JOGO,
} from "@/lib/partidas";

// "Falta um": a sessão privada anuncia vagas para quem não é do grupo.
//
// Este bloco tem TRÊS leitores diferentes na mesma tela, e cada um precisa
// ver uma coisa só:
//   • o organizador — abre e fecha a vaga
//   • quem não está no jogo — entra pela vaga
//   • quem entrou PELA vaga — sai por aqui (o convidado sai por "Desistir",
//     que é outra coisa: lá a vaga fica em troca e o pagamento continua)
export function VagasNaSessao({
  partidaId,
  souOrganizador,
  jaEstou,
  entreiPelaVaga,
  jaComecou,
  cancelada,
  vagasAbertas,
  categoriaMin,
  categoriaMax,
  sexoJogo,
  minhaCategoria,
}: {
  partidaId: string;
  souOrganizador: boolean;
  jaEstou: boolean;
  entreiPelaVaga: boolean;
  jaComecou: boolean;
  cancelada: boolean;
  vagasAbertas: number;
  categoriaMin: number | null;
  categoriaMax: number | null;
  sexoJogo: string | null;
  minhaCategoria: number | null;
}) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [acao, setAcao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // A faixa nasce sugerida na categoria de quem organiza — é o jogo dele, e
  // quase sempre é gente do mesmo nível que ele quer. Se já anunciou antes,
  // o servidor guardou a escolha e ela volta preenchida.
  const [min, setMin] = useState<number>(categoriaMin ?? minhaCategoria ?? 4);
  const [max, setMax] = useState<number>(categoriaMax ?? minhaCategoria ?? 4);
  const [sexo, setSexo] = useState<string>(sexoJogo ?? "mista");
  const [quantas, setQuantas] = useState<number>(1);

  async function chamar(
    rpc: string,
    args: Record<string, unknown>,
    evento: string
  ) {
    setErro(null);
    setAcao(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc(rpc, args);
    setAcao(false);

    if (error) {
      console.error(`Erro em ${rpc}:`, error.message);
      if (error.message.includes("PASSA_DO_TAMANHO")) {
        setErro(
          "Não cabe mais gente nesse jogo. Se alguém já pagou, o valor por pessoa está fechado e o grupo não pode crescer."
        );
      } else if (error.message.includes("PARTIDA_JA_COMECOU")) {
        setErro("O jogo já começou — não dá mais para anunciar vaga.");
      } else if (error.message.includes("PENDENCIA")) {
        setErro(
          "Você tem uma parte em aberto de outra partida. Acerte antes de entrar em uma nova."
        );
      } else if (error.message.includes("INCOMPATIVEL")) {
        setErro("Esse jogo não é do seu nível ou do seu tipo de partida.");
      } else if (error.message.includes("SO_POR_CONVITE")) {
        setErro("A vaga acabou de ser preenchida por outra pessoa.");
      } else if (error.message.includes("PAGOU_USE_DESISTIR")) {
        setErro(
          "Você já pagou sua parte. Use “Desistir” — assim a vaga fica para troca e o valor continua valendo para o clube."
        );
      } else {
        setErro("Não conseguimos concluir. Tente de novo.");
      }
      return;
    }

    posthog.capture(evento);
    setAbrindo(false);
    router.refresh();
  }

  if (cancelada) return null;

  // ---------- Quem não é do jogo, vendo uma vaga anunciada ----------
  if (!jaEstou) {
    if (vagasAbertas < 1 || jaComecou) return null;
    return (
      <section className="mt-4 rounded-2xl bg-destaque p-5 shadow-lg">
        <p className="font-display text-base font-bold text-destaque-tinta">
          🎾 Esse grupo tem {vagasAbertas === 1 ? "uma vaga" : `${vagasAbertas} vagas`}
        </p>
        <p className="mt-1 text-sm text-destaque-tinta/80">
          É um jogo de um grupo que já está formado. Entrando, você joga com
          eles e divide o valor da quadra por igual.
        </p>
        <button
          type="button"
          onClick={() =>
            chamar("entrar_na_partida", { p_partida_id: partidaId }, "entrou_pela_vaga")
          }
          disabled={acao}
          className="mt-4 w-full rounded-full bg-primaria px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {acao ? "Entrando…" : "Entrar no jogo"}
        </button>
        {erro && <p className="mt-3 text-sm font-medium text-red-700">{erro}</p>}
      </section>
    );
  }

  // ---------- Quem entrou pela vaga ----------
  if (jaEstou && !souOrganizador) {
    if (!entreiPelaVaga || jaComecou) return null;
    return (
      <section className="mt-4">
        <button
          type="button"
          onClick={() =>
            chamar("sair_da_partida", { p_partida_id: partidaId }, "saiu_pela_vaga")
          }
          disabled={acao}
          className="rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
        >
          {acao ? "Saindo…" : "Sair do jogo"}
        </button>
        <p className="mt-2 text-xs text-tinta-suave">
          Você entrou por uma vaga aberta. Saindo, a vaga volta a ser
          anunciada.
        </p>
        {erro && <p className="mt-3 text-sm font-medium text-red-700">{erro}</p>}
      </section>
    );
  }

  // ---------- O organizador ----------
  if (!souOrganizador || jaComecou) return null;

  if (vagasAbertas > 0) {
    return (
      <section className="mt-4 rounded-2xl bg-superficie p-5 ring-1 ring-black/5">
        <p className="font-display text-base font-bold text-tinta">
          📣 {vagasAbertas === 1 ? "1 vaga anunciada" : `${vagasAbertas} vagas anunciadas`}
        </p>
        <p className="mt-1 text-sm text-tinta-suave">
          Aparece no feed de partidas abertas para jogadores{" "}
          {categoriaMin && categoriaMax
            ? faixaCategoria(categoriaMin, categoriaMax)
            : ""}
          {sexoJogo ? ` · ${ROTULO_SEXO_JOGO[sexoJogo]}` : ""}.
        </p>
        <p className="mt-2 text-xs text-tinta-suave">
          O valor por pessoa já conta a vaga: ninguém do grupo vai pagar a
          mais nem a menos quando alguém entrar.
        </p>
        <button
          type="button"
          onClick={() =>
            chamar("fechar_vagas", { p_partida_id: partidaId }, "vagas_fechadas")
          }
          disabled={acao}
          className="mt-4 rounded-full border border-black/10 bg-fundo px-5 py-2.5 text-sm font-bold text-tinta transition hover:bg-black/5 disabled:opacity-50"
        >
          {acao ? "Fechando…" : "Fechar as vagas"}
        </button>
        {erro && <p className="mt-3 text-sm font-medium text-red-700">{erro}</p>}
      </section>
    );
  }

  if (!abrindo) {
    return (
      <section className="mt-4">
        <button
          type="button"
          onClick={() => setAbrindo(true)}
          className="w-full rounded-2xl border border-dashed border-black/15 bg-superficie px-5 py-4 text-sm font-bold text-tinta transition hover:bg-black/5"
        >
          🎾 Falta alguém? Anunciar vaga
        </button>
        <p className="mt-2 text-xs text-tinta-suave">
          O jogo continua sendo do grupo. Quem entra pela vaga passa a fazer
          parte dele: joga, conversa e divide o valor igual aos outros.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-2xl bg-superficie p-5 ring-1 ring-black/5">
      <p className="font-display text-base font-bold text-tinta">
        Anunciar vaga
      </p>

      <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-tinta-suave">
        Quantas vagas
      </label>
      <div className="mt-2 flex gap-2">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setQuantas(n)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${
              quantas === n
                ? "bg-primaria text-white"
                : "bg-fundo text-tinta-suave ring-1 ring-black/10"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* A faixa existe para FILTRAR ESTRANHOS — é a única informação que
          quem está de fora tem sobre o nível do jogo antes de entrar. */}
      <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-tinta-suave">
        Categoria aceita
      </label>
      <div className="mt-2 flex items-center gap-2">
        <select
          value={min}
          onChange={(e) => {
            const v = Number(e.target.value);
            setMin(v);
            if (v > max) setMax(v);
          }}
          className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-tinta"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((c) => (
            <option key={c} value={c}>
              {ROTULO_CATEGORIA[c]}
            </option>
          ))}
        </select>
        <span className="text-sm text-tinta-suave">até</span>
        <select
          value={max}
          onChange={(e) => {
            const v = Number(e.target.value);
            setMax(v);
            if (v < min) setMin(v);
          }}
          className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-tinta"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((c) => (
            <option key={c} value={c}>
              {ROTULO_CATEGORIA[c]}
            </option>
          ))}
        </select>
      </div>

      <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-tinta-suave">
        Jogo
      </label>
      <div className="mt-2 flex gap-2">
        {["masculino", "feminino", "mista"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSexo(s)}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${
              sexo === s
                ? "bg-primaria text-white"
                : "bg-fundo text-tinta-suave ring-1 ring-black/10"
            }`}
          >
            {ROTULO_SEXO_JOGO[s]}
          </button>
        ))}
      </div>

      {/* ⚠️ O jogo era invisível para quem não foi convidado. Anunciar muda
          isso, e quem foi convidado não escolheu — o organizador escolhe
          por todos. Decisão do fundador (26/08/2026): avisar em vez de
          pedir aprovação, porque "falta um" é urgente por natureza e uma
          votação chegaria depois do jogo. */}
      <div className="mt-5 rounded-xl bg-fundo p-3 ring-1 ring-black/5">
        <p className="text-xs text-tinta-suave">
          <strong className="text-tinta">Enquanto a vaga estiver aberta</strong>
          , qualquer jogador do app vê este jogo e quem está nele — nome, foto
          e categoria, como em qualquer partida aberta. Telefone, valores e a
          conversa continuam só para quem está dentro.
        </p>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() =>
            chamar(
              "abrir_vagas",
              {
                p_partida_id: partidaId,
                p_vagas: quantas,
                p_categoria_min: min,
                p_categoria_max: max,
                p_sexo_jogo: sexo,
              },
              "vagas_abertas"
            )
          }
          disabled={acao}
          className="flex-1 rounded-full bg-primaria px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {acao ? "Anunciando…" : "Anunciar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbrindo(false);
            setErro(null);
          }}
          className="rounded-full border border-black/10 bg-fundo px-5 py-3 text-sm font-bold text-tinta transition hover:bg-black/5"
        >
          Cancelar
        </button>
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-700">{erro}</p>}
    </section>
  );
}
