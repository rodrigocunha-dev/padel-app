import { ROTULO_NIVEL } from "@/lib/partidas";

// ============================================================
// A BARRA — onde você está DENTRO da sua faixa
// ============================================================
// Decisão do fundador (09/08/2026): o jogador vê **categoria + barra**, e
// nunca o número absoluto. A barra funciona nos dois sentidos: perto de
// subir e perto de cair. É visível só para o próprio jogador — terceiros
// veem apenas categoria e nível.
//
// ⚠️ O componente recebe a POSIÇÃO já calculada (0 a 100), não o rating.
// Isso é de propósito: a conta é feita no servidor e o número nunca chega
// ao navegador — nem no HTML, nem em variável de página. Passar o rating
// para cá "só para calcular aqui" furaria a decisão sem ninguém perceber.

export type EstadoDoRating = {
  categoria: number;
  nivel: string;
  posicao: number;            // 0 a 100 dentro da faixa
  emCalibracao: boolean;
  progressoCalibracao: number; // 0 a 100
  // Período de prova da queda: só existe quando o rating está abaixo da
  // faixa exibida. `null` quando não há queda em curso.
  provaDeQueda: { progresso: number; cairPara: string } | null;
};

export function BarraDeProgresso({ estado }: { estado: EstadoDoRating }) {
  const emProva = estado.provaDeQueda !== null;

  return (
    <div className="rounded-2xl bg-superficie p-6 shadow-lg ring-1 ring-black/5">
      <p className="text-sm text-tinta-suave">Sua categoria</p>
      <p className="mt-1 font-display text-3xl font-extrabold text-primaria">
        {estado.categoria}ª{" "}
        <span className="text-lg font-bold text-tinta-suave">
          {ROTULO_NIVEL[estado.nivel] ?? estado.nivel}
        </span>
      </p>

      {estado.emCalibracao && (
        <span className="mt-3 inline-block rounded-full bg-destaque px-3 py-1 text-xs font-bold text-destaque-tinta">
          ⚖️ Em calibração
        </span>
      )}

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-xs text-tinta-suave">
          <span>{estado.categoria}ª {ROTULO_NIVEL[estado.nivel]}</span>
          <span>próximo degrau</span>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className={`h-full rounded-full transition-all ${
              emProva ? "bg-red-500" : "bg-primaria"
            }`}
            style={{ width: `${Math.max(2, Math.min(100, estado.posicao))}%` }}
          />
        </div>
      </div>

      {emProva ? (
        // Só aparece quando a queda já está em curso. Avisar antes seria
        // ansiedade sem ação possível — não há o que "fazer" a não ser jogar.
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-800 ring-1 ring-red-100">
          <p className="font-bold">
            Você está abaixo da faixa da {estado.categoria}ª{" "}
            {ROTULO_NIVEL[estado.nivel]}
          </p>
          <p className="mt-1">
            Sua categoria está segurada por enquanto. Se os resultados
            continuarem assim, ela passa a ser{" "}
            <strong>{estado.provaDeQueda!.cairPara}</strong>. Voltar para
            dentro da faixa cancela isso.
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-red-200">
            <div
              className="h-full rounded-full bg-red-500"
              style={{
                width: `${Math.min(100, estado.provaDeQueda!.progresso)}%`,
              }}
            />
          </div>
        </div>
      ) : estado.emCalibracao ? (
        <p className="mt-4 text-xs text-tinta-suave">
          Nas primeiras partidas sua categoria se move mais, até o sistema
          conhecer seu jogo. Faltam cerca de{" "}
          <strong>{Math.max(1, Math.round((100 - estado.progressoCalibracao) / 5))}</strong>{" "}
          sets para o selo sair.
        </p>
      ) : null}
    </div>
  );
}
