"use client";

import { useState } from "react";
import Link from "next/link";

export type Aviso = {
  id: string;
  tipo: string;
  partidaId: string | null;
  // Aviso de horário livre não tem partida: ele aponta para o CLUBE.
  clubeId?: string | null;
  clubeNome?: string | null;
  partidaNome: string | null;
  // Qual set — dois avisos do mesmo jogo apareciam como linhas idênticas.
  setRotulo: string | null;
};

const TITULO: Record<string, string> = {
  set_registrado: "Registraram um resultado do seu jogo",
  votacao_aberta: "Há um placar em disputa — seu voto decide",
  promovido: "Você saiu da fila e entrou no jogo",
  horario_livre: "Um clube perto de você tem quadra livre",
  edicao_proposta: "O organizador quer mudar uma partida sua",
  chat_novas_mensagens: "Tem mensagem nova no chat da partida",
  vaga_aberta: "Abriu vaga numa partida do seu nível",
  horarios_livres: "Um clube perto de você tem horários livres",
};

const DETALHE: Record<string, string> = {
  set_registrado:
    "Confira. Se não estiver certo, você tem 24h para contestar.",
  votacao_aberta:
    "Você estava lá. Toque para dizer qual placar está certo.",
  promovido: "Abriu vaga e ela é sua. Confira o horário e a quadra.",
  horario_livre: "Sobrou horário. Toque para ver a agenda e reservar.",
  edicao_proposta: "Nada muda sem a sua aprovação. Toque para ver o que ele pediu.",
  chat_novas_mensagens: "Toque para ler e responder.",
  vaga_aberta: "Alguém saiu e a vaga está livre. Toque para entrar.",
  horarios_livres: "Separamos os que combinam com os seus dias e horários.",
};

const ICONE: Record<string, string> = {
  set_registrado: "📋",
  votacao_aberta: "🗳️",
  promovido: "🎉",
  horario_livre: "🎾",
  edicao_proposta: "✏️",
  chat_novas_mensagens: "💬",
  vaga_aberta: "🎯",
  horarios_livres: "📣",
};

// Um bloco por TIPO, não um por aviso: com 3 resultados registrados a tela
// virava uma pilha de blocos iguais. Quando há mais de um do mesmo tipo, o
// bloco abre a lista das partidas envolvidas.
export function AvisosPendentes({ avisos }: { avisos: Aviso[] }) {
  const [aberto, setAberto] = useState<string | null>(null);

  const tipos = [...new Set(avisos.map((a) => a.tipo))];
  if (tipos.length === 0) return null;

  // Quem marca o aviso como lido é a página do jogo (MarcarAvisosLidos), não
  // o toque aqui. Ver o porquê lá — em resumo: toque não é chegada, e gravar
  // durante a navegação fazia o link não levar a lugar nenhum.

  return (
    <ul className="mt-4 space-y-2">
      {tipos.map((tipo) => {
        const doTipo = avisos.filter((a) => a.tipo === tipo);
        const unico = doTipo.length === 1;
        const destino = !unico
          ? null
          : doTipo[0].partidaId
            ? `/app/partidas/${doTipo[0].partidaId}`
            : doTipo[0].clubeId
              ? `/app/clubes/${doTipo[0].clubeId}`
              : null;

        const conteudo = (
          <>
            <p className="font-display text-sm font-bold text-amber-800">
              {ICONE[tipo]} {TITULO[tipo] ?? "Aviso"}
              {!unico && ` (${doTipo.length})`}
            </p>
            <p className="mt-0.5 text-xs text-amber-800/80">
              {unico && doTipo[0].partidaNome
                ? doTipo[0].partidaNome
                : DETALHE[tipo] ?? ""}
            </p>
          </>
        );

        return (
          <li key={tipo}>
            {destino ? (
              <Link
                href={destino}
                className="block rounded-2xl bg-amber-100 p-4 shadow ring-1 ring-amber-200 transition hover:brightness-105"
              >
                {conteudo}
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAberto(aberto === tipo ? null : tipo)}
                  className="block w-full rounded-2xl bg-amber-100 p-4 text-left shadow ring-1 ring-amber-200 transition hover:brightness-105"
                >
                  {conteudo}
                  <p className="mt-1 text-xs font-bold text-amber-800">
                    {aberto === tipo ? "Fechar" : "Ver quais jogos →"}
                  </p>
                </button>

                {aberto === tipo && (
                  <ul className="mt-2 space-y-2 pl-3">
                    {doTipo.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={a.partidaId ? `/app/partidas/${a.partidaId}` : a.clubeId ? `/app/clubes/${a.clubeId}` : "#"}
                          className="flex items-center justify-between gap-3 rounded-xl bg-superficie p-3 shadow ring-1 ring-black/5 transition hover:ring-primaria/40"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-tinta">
                              {a.partidaNome ?? "Ver jogo"}
                            </span>
                            {a.setRotulo && (
                              <span className="block text-xs text-tinta-suave">
                                {a.setRotulo}
                              </span>
                            )}
                          </span>
                          {/* A seta é o que faz a linha parecer tocável: sem
                              ela o cartão branco lia como texto, e o fundador
                              não percebeu que dava para abrir. */}
                          <span className="shrink-0 text-sm font-bold text-primaria">
                            Abrir →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
