// Tipos compartilhados das partidas (feed e tela da partida).
// A partida carrega seu próprio horário/quadra (dados públicos); a reserva
// que segura a quadra é privada e não entra aqui.

export type PartidaFeed = {
  id: string;
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
