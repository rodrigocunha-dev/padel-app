import { criarClienteServidor } from "@/lib/supabase/server";
import type { ItemDaFila } from "@/components/partidas/BlocoNaFila";

// Onde estou na fila de substitutos, e de quais partidas.
//
// A posição não é gravada em lugar nenhum: ela sai da `ordem` — quantos
// substitutos entraram antes de mim naquela partida. Derivar em vez de
// guardar evita a classe de bug em que alguém sai da fila e as posições
// gravadas ficam mentindo.
export async function minhaFila(jogadorId: string): Promise<ItemDaFila[]> {
  const supabase = await criarClienteServidor();

  const { data: meus } = await supabase
    .from("partida_jogadores")
    .select(
      "partida_id, ordem, partidas ( id, status, inicio, fim, quadras ( nome, clubes ( nome ) ) )"
    )
    .eq("jogador_id", jogadorId)
    .eq("papel", "substituto")
    .eq("estado", "aceito");

  const vivas = (meus ?? []).filter((m) => {
    const p = m.partidas as unknown as { status: string; fim: string } | null;
    // Partida cancelada ou que já terminou não é mais fila de nada.
    return p && p.status !== "cancelada" && new Date(p.fim) > new Date();
  });

  if (vivas.length === 0) return [];

  // Os outros substitutos das mesmas partidas, para saber quem vem antes.
  const { data: fila } = await supabase
    .from("partida_jogadores")
    .select("partida_id, ordem")
    .in(
      "partida_id",
      vivas.map((v) => v.partida_id)
    )
    .eq("papel", "substituto")
    .eq("estado", "aceito");

  return vivas.map((m) => {
    const p = m.partidas as unknown as {
      id: string;
      inicio: string;
      quadras: { nome: string; clubes: { nome: string } };
    };
    const antes = (fila ?? []).filter(
      (f) => f.partida_id === m.partida_id && f.ordem < m.ordem
    ).length;
    return {
      partidaId: p.id,
      clube: p.quadras.clubes.nome,
      quadra: p.quadras.nome,
      inicio: p.inicio,
      posicao: antes + 1,
    };
  });
}
