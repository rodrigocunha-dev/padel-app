"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  PERGUNTAS,
  sugerirCategoria,
} from "@/lib/calibracao";

const DIAS = [
  { id: "seg", rotulo: "Seg" },
  { id: "ter", rotulo: "Ter" },
  { id: "qua", rotulo: "Qua" },
  { id: "qui", rotulo: "Qui" },
  { id: "sex", rotulo: "Sex" },
  { id: "sab", rotulo: "Sáb" },
  { id: "dom", rotulo: "Dom" },
];
const TURNOS = [
  { id: "manha", rotulo: "Manhã" },
  { id: "tarde", rotulo: "Tarde" },
  { id: "noite", rotulo: "Noite" },
];
const RAIOS = [5, 10, 20, 30, 50];

const ROTULO_CATEGORIA: Record<number, string> = {
  2: "2ª — muito forte",
  3: "3ª — forte",
  4: "4ª — intermediário-avançado",
  5: "5ª — intermediário",
  6: "6ª — iniciante-intermediário",
  7: "7ª — iniciante",
};

type Props = { usuarioId: string; telefone: string };

export function OnboardingJogador({ usuarioId, telefone }: Props) {
  const router = useRouter();
  const supabase = criarClienteNavegador();

  // Etapas: 0 nome/cidade · 1 foto · 2..2+N perguntas · depois categoria,
  // posição, disponibilidade/raio
  const [etapa, setEtapa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [categoria, setCategoria] = useState<number | null>(null);
  const [posicao, setPosicao] = useState<string | null>(null);
  const [disponibilidade, setDisponibilidade] = useState<
    Record<string, string[]>
  >({});
  const [raioKm, setRaioKm] = useState(10);

  const primeiraPergunta = 2;
  const etapaCategoria = primeiraPergunta + PERGUNTAS.length;
  const etapaPosicao = etapaCategoria + 1;
  const etapaDisponibilidade = etapaPosicao + 1;
  const totalEtapas = etapaDisponibilidade + 1;

  const pontos = Object.values(respostas).reduce((a, b) => a + b, 0);
  const sugerida = sugerirCategoria(pontos);

  function alternarTurno(dia: string, turno: string) {
    setDisponibilidade((atual) => {
      const turnos = atual[dia] ?? [];
      const novos = turnos.includes(turno)
        ? turnos.filter((t) => t !== turno)
        : [...turnos, turno];
      const proximo = { ...atual, [dia]: novos };
      if (novos.length === 0) delete proximo[dia];
      return proximo;
    });
  }

  async function concluir() {
    setErro(null);
    setSalvando(true);

    let fotoUrl: string | null = null;
    if (foto) {
      const caminho = `${usuarioId}/perfil-${Date.now()}.jpg`;
      const { error: erroUpload } = await supabase.storage
        .from("fotos")
        .upload(caminho, foto, { upsert: true });
      if (erroUpload) {
        console.error("Erro no upload da foto:", erroUpload.message);
        // Foto é opcional: segue sem ela em vez de travar o cadastro.
      } else {
        fotoUrl = supabase.storage.from("fotos").getPublicUrl(caminho)
          .data.publicUrl;
      }
    }

    const { error } = await supabase.from("jogadores").insert({
      id: usuarioId,
      nome: nome.trim(),
      foto_url: fotoUrl,
      cidade: cidade.trim(),
      telefone,
      categoria,
      posicao,
      disponibilidade: Object.entries(disponibilidade).map(
        ([dia, turnos]) => ({ dia, turnos })
      ),
      raio_km: raioKm,
      em_calibracao: true,
      calibracao_respostas: {
        respostas,
        pontos,
        categoria_sugerida: sugerida,
        categoria_escolhida: categoria,
      },
    });

    setSalvando(false);
    if (error) {
      console.error("Erro ao salvar perfil:", error.message);
      setErro("Não conseguimos salvar seu perfil. Tente de novo.");
      return;
    }

    posthog.capture("onboarding_concluido", {
      categoria_sugerida: sugerida,
      categoria_escolhida: categoria,
      ajustou_sugestao: categoria !== sugerida,
      cidade: cidade.trim(),
      raio_km: raioKm,
      tem_foto: !!fotoUrl,
    });
    router.replace("/app");
  }

  const barra = (
    <div className="mb-6">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-primaria/15">
        <div
          className="h-full rounded-full bg-primaria transition-all"
          style={{ width: `${((etapa + 1) / totalEtapas) * 100}%` }}
        />
      </div>
    </div>
  );

  const cartao = "rounded-2xl bg-superficie p-6 shadow-lg ring-1 ring-black/5";
  const botaoPrimario =
    "mt-6 w-full rounded-full bg-destaque px-6 py-3 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-50";
  const botaoOpcao = (ativo: boolean) =>
    `w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
      ativo
        ? "border-primaria bg-primaria/10 text-primaria"
        : "border-black/10 bg-white text-tinta hover:border-primaria/40"
    }`;
  const estiloInput =
    "w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-tinta placeholder:text-tinta-suave/60 focus:border-primaria focus:outline-none focus:ring-2 focus:ring-primaria/30";

  // ---------- Etapa 0: nome e cidade ----------
  if (etapa === 0) {
    return (
      <div>
        {barra}
        <div className={cartao}>
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Vamos criar seu perfil
          </h1>
          <label className="mt-5 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-tinta">Nome</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo"
              autoComplete="name"
              className={estiloInput}
            />
          </label>
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-tinta">Cidade</span>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex.: Novo Hamburgo"
              autoComplete="address-level2"
              className={estiloInput}
            />
          </label>
          <button
            type="button"
            disabled={!nome.trim() || !cidade.trim()}
            onClick={() => {
              posthog.capture("onboarding_iniciado");
              setEtapa(1);
            }}
            className={botaoPrimario}
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // ---------- Etapa 1: foto (opcional) ----------
  if (etapa === 1) {
    return (
      <div>
        {barra}
        <div className={cartao}>
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Sua foto
          </h1>
          <p className="mt-2 text-sm text-tinta-suave">
            Perfis com foto passam mais confiança na hora de fechar partida.
          </p>
          <label className="mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primaria/30 bg-primaria/5 px-4 py-8 text-center">
            <span className="text-3xl">📷</span>
            <span className="text-sm font-medium text-primaria">
              {foto ? foto.name : "Escolher foto da galeria"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={() => setEtapa(primeiraPergunta)}
            className={botaoPrimario}
          >
            {foto ? "Continuar" : "Pular por enquanto"}
          </button>
        </div>
      </div>
    );
  }

  // ---------- Etapas das perguntas de calibração ----------
  if (etapa >= primeiraPergunta && etapa < etapaCategoria) {
    const pergunta = PERGUNTAS[etapa - primeiraPergunta];
    return (
      <div>
        {barra}
        <div className={cartao}>
          <p className="text-xs font-bold uppercase tracking-wide text-primaria">
            Calibração · {etapa - primeiraPergunta + 1} de {PERGUNTAS.length}
          </p>
          <h1 className="mt-2 font-display text-xl font-extrabold text-tinta">
            {pergunta.titulo}
          </h1>
          <div className="mt-5 flex flex-col gap-2.5">
            {pergunta.opcoes.map((opcao) => (
              <button
                key={opcao.rotulo}
                type="button"
                className={botaoOpcao(respostas[pergunta.id] === opcao.pontos)}
                onClick={() => {
                  setRespostas((r) => ({ ...r, [pergunta.id]: opcao.pontos }));
                  setTimeout(() => setEtapa(etapa + 1), 150);
                }}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Etapa: categoria sugerida ----------
  if (etapa === etapaCategoria) {
    const escolhida = categoria ?? sugerida;
    return (
      <div>
        {barra}
        <div className={cartao}>
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Sua categoria de largada
          </h1>
          <p className="mt-2 text-sm text-tinta-suave">
            Pelas suas respostas, sugerimos a{" "}
            <strong className="text-primaria">
              {ROTULO_CATEGORIA[sugerida]}
            </strong>
            . Pode ajustar se achar que não te representa.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            {[2, 3, 4, 5, 6, 7].map((c) => (
              <button
                key={c}
                type="button"
                className={botaoOpcao(escolhida === c)}
                onClick={() => setCategoria(c)}
              >
                {ROTULO_CATEGORIA[c]}
                {c === sugerida && (
                  <span className="ml-2 rounded-full bg-destaque px-2 py-0.5 text-xs font-bold text-destaque-tinta">
                    sugerida
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-primaria/5 p-3 text-xs text-tinta-suave">
            ⚖️ Seu perfil nasce com o selo <strong>“em calibração”</strong>:
            nas primeiras partidas o sistema confirma sua categoria e o selo
            some. Jogar na categoria certa é mais divertido para todo mundo.
          </div>
          <button
            type="button"
            onClick={() => {
              if (categoria === null) setCategoria(sugerida);
              posthog.capture("calibracao_concluida", {
                pontos,
                categoria_sugerida: sugerida,
              });
              setEtapa(etapaPosicao);
            }}
            className={botaoPrimario}
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // ---------- Etapa: posição ----------
  if (etapa === etapaPosicao) {
    return (
      <div>
        {barra}
        <div className={cartao}>
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Em que lado você joga?
          </h1>
          <div className="mt-5 flex flex-col gap-2.5">
            {[
              { id: "esquerda", rotulo: "Esquerda (revés)" },
              { id: "direita", rotulo: "Direita (saque)" },
              { id: "ambas", rotulo: "Tanto faz — jogo dos dois lados" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={botaoOpcao(posicao === p.id)}
                onClick={() => {
                  setPosicao(p.id);
                  setTimeout(() => setEtapa(etapaDisponibilidade), 150);
                }}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Etapa final: disponibilidade + raio ----------
  return (
    <div>
      {barra}
      <div className={cartao}>
        <h1 className="font-display text-2xl font-extrabold text-tinta">
          Quando você costuma jogar?
        </h1>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr>
                <th />
                {TURNOS.map((t) => (
                  <th
                    key={t.id}
                    className="pb-2 font-medium text-tinta-suave"
                  >
                    {t.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIAS.map((d) => (
                <tr key={d.id}>
                  <td className="py-1 pr-2 text-left font-medium text-tinta">
                    {d.rotulo}
                  </td>
                  {TURNOS.map((t) => {
                    const ativo = (disponibilidade[d.id] ?? []).includes(t.id);
                    return (
                      <td key={t.id} className="p-1">
                        <button
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => alternarTurno(d.id, t.id)}
                          className={`h-9 w-full rounded-lg border text-xs font-bold transition ${
                            ativo
                              ? "border-primaria bg-primaria text-white"
                              : "border-black/10 bg-white text-tinta-suave hover:border-primaria/40"
                          }`}
                        >
                          {ativo ? "✓" : "·"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="mt-6 flex flex-col gap-1.5">
          <span className="text-sm font-medium text-tinta">
            Até que distância você toparia jogar?
          </span>
          <div className="flex gap-2">
            {RAIOS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRaioKm(r)}
                className={`flex-1 rounded-lg border px-2 py-2 text-sm font-bold transition ${
                  raioKm === r
                    ? "border-primaria bg-primaria text-white"
                    : "border-black/10 bg-white text-tinta-suave hover:border-primaria/40"
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </label>

        {erro && (
          <p className="mt-4 text-sm font-medium text-red-600">{erro}</p>
        )}

        <button
          type="button"
          disabled={salvando || Object.keys(disponibilidade).length === 0}
          onClick={concluir}
          className={botaoPrimario}
        >
          {salvando ? "Salvando..." : "Concluir meu perfil 🎾"}
        </button>
      </div>
    </div>
  );
}
