"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  PERGUNTAS,
  sugerirDegrau,
  janelaDeDegraus,
  rotuloDoDegrau,
  categoriaDoDegrau,
} from "@/lib/calibracao";
import { VERSAO_POLITICA } from "@/lib/politica";

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

// Fora do componente de propósito: `Date.now()` dentro do corpo dele faz o
// lint acusar chamada impura em render — mesmo aqui, que só roda no clique.
function caminhoDaFoto(usuarioId: string): string {
  return `${usuarioId}/perfil-${Date.now()}.jpg`;
}

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
  const [sexo, setSexo] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  // O degrau (0 a 20) é o que a pessoa escolhe; categoria e nível saem dele.
  // Guardar os dois separados abriria espaço para divergirem.
  const [degrau, setDegrau] = useState<number | null>(null);
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
  const degrauSugerido = sugerirDegrau(pontos);
  const degrauEscolhido = degrau ?? degrauSugerido;

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
      const caminho = caminhoDaFoto(usuarioId);
      const { error: erroUpload } = await supabase.storage
        .from("fotos")
        .upload(caminho, foto);
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
      sexo,
      telefone,
      categoria: categoriaDoDegrau(degrauEscolhido).categoria,
      nivel_categoria: categoriaDoDegrau(degrauEscolhido).nivel,
      posicao,
      disponibilidade: Object.entries(disponibilidade).map(
        ([dia, turnos]) => ({ dia, turnos })
      ),
      raio_km: raioKm,
      em_calibracao: true,
      calibracao_respostas: {
        respostas,
        pontos,
        degrau_sugerido: degrauSugerido,
        degrau_escolhido: degrauEscolhido,
        // Quanto a pessoa mexeu, e para que lado. Não é usado hoje: é para
        // olhar no beta se quem se declara PIOR do que é ganha demais nos
        // primeiros jogos — essa é a manipulação que rende prêmio.
        ajuste: degrauEscolhido - degrauSugerido,
      },
    });

    setSalvando(false);
    if (error) {
      console.error("Erro ao salvar perfil:", error.message);
      setErro("Não conseguimos salvar seu perfil. Tente de novo.");
      return;
    }

    // O aceite é gravado DEPOIS do perfil existir, e de propósito: se
    // gravasse antes e o perfil falhasse, ficaria um consentimento solto de
    // alguém que nunca entrou. A versão vai junto — quando o texto mudar, é
    // o que permite pedir o aceite de novo só a quem viu o antigo.
    await supabase
      .from("consentimentos")
      .insert({ jogador_id: usuarioId, versao: VERSAO_POLITICA });

    posthog.capture("onboarding_concluido", {
      degrau_sugerido: degrauSugerido,
      degrau_escolhido: degrauEscolhido,
      ajuste: degrauEscolhido - degrauSugerido,
      cidade: cidade.trim(),
      raio_km: raioKm,
      tem_foto: !!fotoUrl,
    });

    // De onde essa pessoa veio. Dado para o dono do app; nenhuma tela
    // mostra isso a ninguém.
    let veioDe: string | null = null;
    try {
      veioDe = sessionStorage.getItem("convite_de");
      sessionStorage.removeItem("convite_de");
    } catch {
      // Armazenamento bloqueado: segue sem atribuição.
    }
    await supabase.rpc("registrar_origem", {
      p_codigo: veioDe,
      p_origem: veioDe ? "link_de_convite" : "direto",
    });

    // Fecha o ciclo do convite por telefone: quem foi convidado antes de
    // ter conta encontra os convites esperando por ele agora. Eles seguem
    // como CONVITE — criar conta não é dizer sim para um jogo.
    const { data: ligados } = await supabase.rpc("vincular_convites_do_telefone");
    if (ligados && ligados > 0) {
      posthog.capture("convites_vinculados", { quantidade: ligados });
    }

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
          <div className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-tinta">Sexo</span>
            <span className="text-xs text-tinta-suave">
              Usado para os jogos masculinos, femininos ou mistos.
            </span>
            <div className="mt-1 flex gap-2">
              {[
                { id: "masculino", rotulo: "Masculino" },
                { id: "feminino", rotulo: "Feminino" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSexo(s.id)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    sexo === s.id
                      ? "border-primaria bg-primaria/10 text-primaria"
                      : "border-black/10 bg-white text-tinta hover:border-primaria/40"
                  }`}
                >
                  {s.rotulo}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={!nome.trim() || !cidade.trim() || !sexo}
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

  // ---------- Etapa: a autoavaliação, como AJUSTE de ±2 degraus ----------
  // As quatro perguntas anteriores (fatos verificáveis) definiram o degrau.
  // Aqui entra a única coisa que elas não conseguem capturar: se dentro da
  // sua categoria você é Fraco, Médio ou Forte. A janela é curta de
  // propósito — antes desta mudança a lista era aberta e o questionário não
  // decidia nada, porque bastava tocar na 2ª e seguir.
  if (etapa === etapaCategoria) {
    return (
      <div>
        {barra}
        <div className={cartao}>
          <h1 className="font-display text-2xl font-extrabold text-tinta">
            Como você avalia seu jogo hoje?
          </h1>
          <p className="mt-2 text-sm text-tinta-suave">
            Pelas suas respostas, seu ponto de largada é{" "}
            <strong className="text-primaria">
              {rotuloDoDegrau(degrauSugerido)}
            </strong>
            . Se achar que não te representa, ajuste um pouco para cima ou
            para baixo.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            {janelaDeDegraus(degrauSugerido).map((d) => (
              <button
                key={d}
                type="button"
                className={botaoOpcao(degrauEscolhido === d)}
                onClick={() => setDegrau(d)}
              >
                {rotuloDoDegrau(d)}
                {d === degrauSugerido && (
                  <span className="ml-2 rounded-full bg-destaque px-2 py-0.5 text-xs font-bold text-destaque-tinta">
                    sugerido
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-primaria/5 p-3 text-xs text-tinta-suave">
            ⚖️ Seu perfil nasce com o selo <strong>“em calibração”</strong>:
            nas primeiras partidas o sistema confirma sua categoria e o selo
            some. Não precisa acertar em cheio agora — os primeiros jogos
            ajustam bem mais que esta escolha.
          </div>
          <button
            type="button"
            onClick={() => {
              if (degrau === null) setDegrau(degrauSugerido);
              posthog.capture("calibracao_concluida", {
                pontos,
                degrau_sugerido: degrauSugerido,
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

        {/* O consentimento fica JUNTO do botão que cria o perfil, e não numa
            tela própria antes: aceitar algo que você ainda não sabe se vai
            usar é aceite no vazio. Aqui a pessoa já viu o que o app pede e
            está decidindo entrar. O aceite é gravado com a VERSÃO do texto,
            para dar de pedir de novo quando ele mudar. */}
        <p className="mt-4 text-center text-xs text-tinta-suave">
          Ao concluir, você aceita nossa{" "}
          <a
            href="/politica-privacidade"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primaria underline"
          >
            política de privacidade
          </a>
          .
        </p>
      </div>
    </div>
  );
}
