import { criarClienteServidor } from "@/lib/supabase/server";
import type { EstadoDoRating } from "@/components/rating/BarraDeProgresso";

// ============================================================
// O NÚMERO PARA AQUI
// ============================================================
// Este arquivo é o único lugar que enxerga o rating bruto, e só devolve o
// que pode ser mostrado: categoria, nível e posições em porcentagem. O
// número nunca vira propriedade de componente nem aparece no HTML.
//
// Isso não depende de disciplina: o arquivo importa `criarClienteServidor`,
// que usa `next/headers`. Qualquer componente de cliente que tentar
// importá-lo QUEBRA NA COMPILAÇÃO. A regra é do build, não do combinado.
//
// Decisões que isto implementa (CLAUDE.md, "Motor de rating", itens 19-20):
//  · o jogador vê categoria + barra, nunca o número absoluto;
//  · a barra é só dele — terceiros veem apenas categoria e nível.

const ROTULO_NIVEL_CURTO = ["Fraco", "Médio", "Forte"];

function rotuloDoDegrau(degrau: number): string {
  const d = Math.max(0, Math.min(20, degrau));
  return `${7 - Math.floor(d / 3)}ª ${ROTULO_NIVEL_CURTO[d % 3]}`;
}

export async function estadoDoRating(
  jogadorId: string
): Promise<EstadoDoRating | null> {
  const supabase = await criarClienteServidor();

  const [{ data: r }, { data: par }, { data: j }] = await Promise.all([
    supabase
      .from("rating_jogadores")
      .select("rating, degrau, degrau_exibido, peso_acumulado, peso_abaixo")
      .eq("jogador_id", jogadorId)
      .maybeSingle(),
    supabase
      .from("rating_parametros")
      .select("escala_base, escala_passo, calibracao_alvo, peso_protecao_queda")
      .maybeSingle(),
    supabase
      .from("jogadores")
      .select("categoria, nivel_categoria, em_calibracao")
      .eq("id", jogadorId)
      .maybeSingle(),
  ]);

  if (!j) return null;

  // Quem ainda não tem rating (nenhum set válido) vê a categoria do
  // cadastro, sem barra — não há posição dentro da faixa para mostrar.
  if (!r || !par) {
    return {
      categoria: j.categoria,
      nivel: j.nivel_categoria,
      posicao: 0,
      emCalibracao: j.em_calibracao ?? true,
      progressoCalibracao: 0,
      provaDeQueda: null,
    };
  }

  const base = Number(par.escala_base);
  const passo = Number(par.escala_passo);
  const rating = Number(r.rating);

  // A faixa do degrau EXIBIDO — que durante um período de prova pode não
  // ser o degrau real. É a faixa da categoria que a pessoa vê, e é sobre
  // ela que a barra faz sentido.
  const centro = base + passo * r.degrau_exibido;
  const piso = centro - passo / 2;
  const posicao = ((rating - piso) / passo) * 100;

  const alvoCalib = Number(par.calibracao_alvo);
  const peso = Number(r.peso_acumulado);

  const caindo = r.degrau < r.degrau_exibido;

  return {
    categoria: j.categoria,
    nivel: j.nivel_categoria,
    posicao: Math.max(0, Math.min(100, posicao)),
    emCalibracao: j.em_calibracao ?? peso < alvoCalib,
    progressoCalibracao: Math.min(100, (peso / alvoCalib) * 100),
    provaDeQueda: caindo
      ? {
          progresso:
            (Number(r.peso_abaixo) / Number(par.peso_protecao_queda)) * 100,
          cairPara: rotuloDoDegrau(r.degrau),
        }
      : null,
  };
}

// ============================================================
// A TRILHA — "quanto mudou e por quê" (regra nº 4)
// ============================================================
// Um item por DIA, porque o bloco de um dia é a unidade do motor: a sessão
// é uma noite, não quatro eventos separados. Os sets aparecem como
// categoria e nível de quem jogou — nunca o rating deles (item 20).
export type DiaDaTrilha = {
  dia: string;
  variacao: number;      // em pontos de rating: é o SEU, pode aparecer
  // ONDE foi o jogo daquele dia, e o caminho para abri-lo. Sem isto a
  // trilha dizia "nesta noite você subiu 12 pontos" sem dizer que noite —
  // e o jogador tinha que abrir partida por partida para descobrir.
  clube: string | null;
  partidaId: string | null;
  sets: {
    venceu: boolean;
    parceiro: string;    // categoria + nível
    adversarios: string; // categoria + nível (média da dupla)
    // Quanto ESTE set moveu. A soma dos sets do dia fecha exatamente com a
    // variação do dia — não é rateio, é a mesma conta aberta (script 029).
    variacao: number | null;
    // O placar VÁLIDO, visto por quem está olhando. Sem ele, dois sets com
    // a mesma explicação exibiam números diferentes sem motivo aparente —
    // foi o que o fundador estranhou, com razão (script 030).
    placar: string | null;
  }[];
};

export async function trilhaDoRating(
  jogadorId: string,
  limite = 20
): Promise<DiaDaTrilha[]> {
  const supabase = await criarClienteServidor();

  const { data: blocos } = await supabase
    .from("rating_blocos")
    .select("id, dia, rating_antes, rating_depois")
    .eq("jogador_id", jogadorId)
    .order("dia", { ascending: false })
    .limit(limite);

  if (!blocos?.length) return [];

  const { data: sets } = await supabase
    .from("rating_bloco_sets")
    .select(
      "bloco_id, venceu, degrau_adversarios, degrau_parceiro, variacao, games_meus, games_deles, sets ( partida_id, partidas ( quadras ( clubes ( nome ) ) ) )"
    )
    .in(
      "bloco_id",
      blocos.map((b) => b.id)
    );

  return blocos.map((b) => {
    const doDia = (sets ?? []).filter((s) => s.bloco_id === b.id);
    // Todos os sets de um bloco são do mesmo dia, e na prática do mesmo
    // jogo. Se um dia tiver jogos em clubes diferentes, mostra o primeiro:
    // é melhor que não mostrar nada, e a lista de sets logo abaixo deixa
    // claro que foi mais de um.
    const origem = doDia
      .map((s) => s.sets as unknown as {
        partida_id: string;
        partidas: { quadras: { clubes: { nome: string } } } | null;
      } | null)
      .find((x) => !!x);

    return {
    dia: b.dia,
    clube: origem?.partidas?.quadras?.clubes?.nome ?? null,
    partidaId: origem?.partida_id ?? null,
    // A variação é do PRÓPRIO jogador, então o número dele pode aparecer:
    // a decisão fecha o rating absoluto, não o quanto ele se moveu — e sem
    // isto a regra nº 4 não teria como ser cumprida.
    variacao: Number(b.rating_depois) - Number(b.rating_antes),
    sets: doDia
      .map((s) => ({
        venceu: s.venceu,
        parceiro: rotuloDoDegrau(s.degrau_parceiro),
        adversarios: rotuloDoDegrau(s.degrau_adversarios),
        variacao: s.variacao === null ? null : Number(s.variacao),
        placar:
          s.games_meus === null || s.games_deles === null
            ? null
            : `${s.games_meus} x ${s.games_deles}`,
      })),
    };
  });
}
