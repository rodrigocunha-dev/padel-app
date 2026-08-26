// Tipos compartilhados das partidas (feed e tela da partida).
// A partida carrega seu próprio horário/quadra (dados públicos); a reserva
// que segura a quadra é privada e não entra aqui.

export type PartidaFeed = {
  id: string;
  // O feed deixou de ser só de partida aberta: a sessão privada que anuncia
  // vaga ("falta um") também aparece aqui. É a mesma tabela, e quem separa
  // os dois casos na tela é este campo.
  tipo: string;
  vagas_abertas: number;
  categoria_min: number;
  categoria_max: number;
  competitiva: boolean;
  sexo_jogo: string;
  max_jogadores: number;
  status: string;
  organizador_id: string;
  inicio: string;
  fim: string;
  quadras: {
    nome: string;
    clubes: { id: string; nome: string; cidade: string };
  };
  partida_jogadores: { jogador_id: string; papel: string; estado: string }[];
};
