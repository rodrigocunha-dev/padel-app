"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

export type Pessoa = { id: string; nome: string };

export type SetDaSessao = {
  id: string;
  ordem: number;
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  games_a: number;
  games_b: number;
  registrado_por: string;
  registrado_em: string;
  contestacao: {
    contestado_por: string;
    games_a: number;
    games_b: number;
  } | null;
  meuVoto: string | null;
  situacao: { games_a: number; games_b: number; conta: boolean; motivo: string };
};

// O banco devolve um código; aqui ele vira frase de jogador.
const ROTULO_MOTIVO: Record<string, string> = {
  AGUARDANDO_JANELA: "Aguardando 24h — dá para contestar",
  ACEITO_POR_SILENCIO: "Confirmado — vale para o rating",
  SET_INCOMPLETO: "Não conta: placar de set incompleto",
  EM_DISPUTA: "Em disputa — ninguém venceu a votação",
  VOTACAO_ORIGINAL: "Confirmado pela votação do grupo",
  VOTACAO_CONTESTADO: "Corrigido pela votação do grupo",
  AMISTOSA: "Amistoso — não conta para o rating",
  FORA_DO_APP: "Não conta: o jogo não nasceu no app",
};

const CLASSE_MOTIVO: Record<string, string> = {
  ACEITO_POR_SILENCIO: "bg-primaria/10 text-primaria",
  VOTACAO_ORIGINAL: "bg-primaria/10 text-primaria",
  VOTACAO_CONTESTADO: "bg-primaria/10 text-primaria",
  AGUARDANDO_JANELA: "bg-amber-100 text-amber-800",
  EM_DISPUTA: "bg-red-100 text-red-700",
};

const ERROS: Record<string, string> = {
  TETO_DE_SETS: "Já foram registrados todos os sets que cabem nesta reserva.",
  FORA_DA_JANELA: "O prazo para isso já passou.",
  PARTIDA_NAO_COMECOU: "O jogo ainda não começou.",
  JOGADOR_NAO_ESTA_NA_SESSAO: "Só quem está confirmado no jogo pode aparecer no set.",
  QUEM_REGISTROU_NAO_CONTESTA: "Quem registrou o placar não pode contestá-lo.",
  EM_DISPUTA_NAO_VOTA: "Quem está na disputa não vota.",
  COOLDOWN: "Você já avisou o grupo há pouco. Espere um pouco para avisar de novo.",
  SEM_CONTESTACAO: "Não há disputa neste set.",
};

function traduzir(msg?: string): string {
  if (!msg) return "Não deu certo. Tente de novo.";
  const k = Object.keys(ERROS).find((x) => msg.includes(x));
  return k ? ERROS[k] : "Não deu certo. Tente de novo.";
}

export function SetsDaSessao({
  partidaId,
  meuId,
  jaComecou,
  participantes,
  sets,
  teto,
}: {
  partidaId: string;
  meuId: string;
  jaComecou: boolean;
  participantes: Pessoa[];
  sets: SetDaSessao[];
  teto: number;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [abrirForm, setAbrirForm] = useState(false);
  const [duplas, setDuplas] = useState<Record<string, "A" | "B" | null>>({});
  const [ga, setGa] = useState("6");
  const [gb, setGb] = useState("4");
  const [contestando, setContestando] = useState<string | null>(null);
  const [cga, setCga] = useState("6");
  const [cgb, setCgb] = useState("4");

  const nome = (id: string) =>
    participantes.find((p) => p.id === id)?.nome.split(" ")[0] ?? "Jogador";

  const timeA = Object.entries(duplas).filter(([, v]) => v === "A").map(([k]) => k);
  const timeB = Object.entries(duplas).filter(([, v]) => v === "B").map(([k]) => k);
  const podeRegistrar = timeA.length === 2 && timeB.length === 2;

  function alternar(id: string) {
    setDuplas((d) => {
      const atual = d[id] ?? null;
      const proximo = atual === null ? "A" : atual === "A" ? "B" : null;
      return { ...d, [id]: proximo };
    });
  }

  async function registrar() {
    setOcupado(true);
    setErro(null);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc("registrar_set", {
      p_partida_id: partidaId,
      p_a1: timeA[0], p_a2: timeA[1], p_b1: timeB[0], p_b2: timeB[1],
      p_games_a: Number(ga), p_games_b: Number(gb),
    });
    setOcupado(false);
    if (error) return setErro(traduzir(error.message));
    posthog.capture("set_registrado");
    setAbrirForm(false);
    setDuplas({});
    router.refresh();
  }

  async function contestar(setId: string) {
    setOcupado(true);
    setErro(null);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc("contestar_set", {
      p_set_id: setId, p_games_a: Number(cga), p_games_b: Number(cgb),
    });
    setOcupado(false);
    if (error) return setErro(traduzir(error.message));
    posthog.capture("set_contestado");
    setContestando(null);
    router.refresh();
  }

  async function votar(setId: string, voto: "original" | "contestado") {
    setOcupado(true);
    setErro(null);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc("votar_set", { p_set_id: setId, p_voto: voto });
    setOcupado(false);
    if (error) return setErro(traduzir(error.message));
    posthog.capture("set_votado", { voto });
    router.refresh();
  }

  async function avisar(setId: string) {
    setOcupado(true);
    setErro(null);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc("avisar_votacao", { p_set_id: setId });
    setOcupado(false);
    if (error) return setErro(traduzir(error.message));
    posthog.capture("votacao_avisada");
    router.refresh();
  }

  const souParticipante = participantes.some((p) => p.id === meuId);

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-tinta">Sets jogados</h2>
      <p className="mt-1 text-sm text-tinta-suave">
        Qualquer um do grupo registra. O placar vale se ninguém contestar em 24
        horas. {sets.length} de {teto} sets registrados.
      </p>

      {sets.length === 0 && (
        <p className="mt-3 rounded-2xl bg-superficie p-5 text-sm text-tinta-suave shadow ring-1 ring-black/5">
          Nenhum set registrado ainda.
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {sets.map((s) => {
          const emDisputa = !!s.contestacao;
          const souRegistrador = s.registrado_por === meuId;
          const souContestador = s.contestacao?.contestado_por === meuId;
          // Quem sabe se a janela de 24h ainda está aberta é o servidor —
          // ele devolve AGUARDANDO_JANELA enquanto der para contestar.
          const dentroDaJanela = s.situacao.motivo === "AGUARDANDO_JANELA";
          const possoContestar =
            souParticipante && !souRegistrador && !emDisputa && dentroDaJanela;
          const possoVotar =
            souParticipante && emDisputa && !souRegistrador && !souContestador;

          return (
            <li
              key={s.id}
              className="rounded-2xl bg-superficie p-5 shadow ring-1 ring-black/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-tinta-suave">
                    SET {s.ordem}
                  </p>
                  <p className="mt-1 font-display font-bold text-tinta">
                    {nome(s.a1)} e {nome(s.a2)}{" "}
                    <span className="text-primaria">
                      {s.games_a} x {s.games_b}
                    </span>{" "}
                    {nome(s.b1)} e {nome(s.b2)}
                  </p>
                  <p className="mt-1 text-xs text-tinta-suave">
                    Registrado por {nome(s.registrado_por)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    CLASSE_MOTIVO[s.situacao.motivo] ?? "bg-fundo text-tinta-suave"
                  }`}
                >
                  {s.situacao.conta ? "Conta" : "Não conta"}
                </span>
              </div>

              <p className="mt-2 text-xs text-tinta-suave">
                {ROTULO_MOTIVO[s.situacao.motivo] ?? s.situacao.motivo}
              </p>

              {emDisputa && (
                <div className="mt-3 rounded-xl bg-fundo p-3">
                  <p className="text-sm font-bold text-tinta">
                    {nome(s.contestacao!.contestado_por)} diz que foi{" "}
                    {s.contestacao!.games_a} x {s.contestacao!.games_b}
                  </p>
                  {possoVotar && (
                    <>
                      <p className="mt-1 text-xs text-tinta-suave">
                        Você estava lá. Qual placar está certo?
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => votar(s.id, "original")}
                          className={`rounded-full px-4 py-2 text-sm font-bold ring-1 transition disabled:opacity-50 ${
                            s.meuVoto === "original"
                              ? "bg-primaria text-white ring-primaria"
                              : "bg-superficie text-tinta ring-black/10 hover:ring-primaria/40"
                          }`}
                        >
                          {s.games_a} x {s.games_b}
                        </button>
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => votar(s.id, "contestado")}
                          className={`rounded-full px-4 py-2 text-sm font-bold ring-1 transition disabled:opacity-50 ${
                            s.meuVoto === "contestado"
                              ? "bg-primaria text-white ring-primaria"
                              : "bg-superficie text-tinta ring-black/10 hover:ring-primaria/40"
                          }`}
                        >
                          {s.contestacao!.games_a} x {s.contestacao!.games_b}
                        </button>
                      </div>
                    </>
                  )}
                  {souParticipante && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => avisar(s.id)}
                      className="mt-3 text-xs font-bold text-primaria hover:underline disabled:opacity-50"
                    >
                      Avisar o grupo para votar
                    </button>
                  )}
                </div>
              )}

              {possoContestar && contestando !== s.id && (
                <button
                  type="button"
                  onClick={() => setContestando(s.id)}
                  className="mt-3 text-sm font-bold text-tinta-suave hover:text-tinta"
                >
                  Não foi esse o placar
                </button>
              )}

              {contestando === s.id && (
                <div className="mt-3 rounded-xl bg-fundo p-3">
                  <p className="text-sm font-bold text-tinta">
                    Qual foi o placar certo?
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number" min={0} max={7} value={cga}
                      onChange={(e) => setCga(e.target.value)}
                      aria-label={`Games de ${nome(s.a1)} e ${nome(s.a2)}`}
                      className="w-16 rounded-lg border-0 bg-superficie px-3 py-2 text-center ring-1 ring-black/10"
                    />
                    <span className="text-tinta-suave">x</span>
                    <input
                      type="number" min={0} max={7} value={cgb}
                      onChange={(e) => setCgb(e.target.value)}
                      aria-label={`Games de ${nome(s.b1)} e ${nome(s.b2)}`}
                      className="w-16 rounded-lg border-0 bg-superficie px-3 py-2 text-center ring-1 ring-black/10"
                    />
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => contestar(s.id)}
                      className="ml-auto rounded-full bg-primaria px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Contestar
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-tinta-suave">
                    O grupo vota para decidir qual placar vale.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Registrar set novo */}
      {jaComecou && souParticipante && sets.length < teto && (
        <div className="mt-4">
          {!abrirForm ? (
            <button
              type="button"
              onClick={() => setAbrirForm(true)}
              className="w-full rounded-2xl bg-primaria p-4 font-display font-bold text-white shadow transition hover:brightness-110"
            >
              + Registrar um set
            </button>
          ) : (
            <div className="rounded-2xl bg-superficie p-5 shadow ring-1 ring-black/5">
              <p className="font-display font-bold text-tinta">Quem jogou?</p>
              <p className="mt-1 text-xs text-tinta-suave">
                Toque para montar as duplas: primeiro toque põe na dupla A,
                segundo na dupla B.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {participantes.map((p) => {
                  const lado = duplas[p.id] ?? null;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => alternar(p.id)}
                      className={`rounded-full px-4 py-2 text-sm font-bold ring-1 transition ${
                        lado === "A"
                          ? "bg-primaria text-white ring-primaria"
                          : lado === "B"
                            ? "bg-destaque text-destaque-tinta ring-destaque"
                            : "bg-fundo text-tinta-suave ring-black/10"
                      }`}
                    >
                      {p.nome.split(" ")[0]}
                      {lado && ` · ${lado}`}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <input
                  type="number" min={0} max={7} value={ga}
                  onChange={(e) => setGa(e.target.value)}
                  aria-label="Games da dupla A"
                  className="w-16 rounded-lg border-0 bg-fundo px-3 py-2 text-center ring-1 ring-black/10"
                />
                <span className="text-tinta-suave">x</span>
                <input
                  type="number" min={0} max={7} value={gb}
                  onChange={(e) => setGb(e.target.value)}
                  aria-label="Games da dupla B"
                  className="w-16 rounded-lg border-0 bg-fundo px-3 py-2 text-center ring-1 ring-black/10"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={ocupado || !podeRegistrar}
                  onClick={registrar}
                  className="flex-1 rounded-full bg-primaria px-5 py-2.5 font-display font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  Salvar set
                </button>
                <button
                  type="button"
                  onClick={() => setAbrirForm(false)}
                  className="px-4 text-sm font-medium text-tinta-suave hover:text-tinta"
                >
                  Cancelar
                </button>
              </div>
              {!podeRegistrar && (
                <p className="mt-2 text-xs text-tinta-suave">
                  Escolha 2 jogadores para cada dupla.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {erro && (
        <p className="mt-3 rounded-xl bg-red-100 p-3 text-sm font-medium text-red-700">
          {erro}
        </p>
      )}
    </section>
  );
}
