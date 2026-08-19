// Os campos que o cadastro e a edição de perfil têm em comum.
//
// Estavam só dentro do OnboardingJogador. Quando a edição de perfil nasceu,
// duplicar essas listas significaria que um dia alguém acrescentaria um
// turno num lugar e não no outro — e o jogador veria opções diferentes
// dependendo de por onde chegou.

export const DIAS = [
  { id: "seg", rotulo: "Seg" },
  { id: "ter", rotulo: "Ter" },
  { id: "qua", rotulo: "Qua" },
  { id: "qui", rotulo: "Qui" },
  { id: "sex", rotulo: "Sex" },
  { id: "sab", rotulo: "Sáb" },
  { id: "dom", rotulo: "Dom" },
];

export const TURNOS = [
  { id: "manha", rotulo: "Manhã" },
  { id: "tarde", rotulo: "Tarde" },
  { id: "noite", rotulo: "Noite" },
];

export const RAIOS = [5, 10, 20, 30, 50];

export const POSICOES = [
  { id: "esquerda", rotulo: "Esquerda" },
  { id: "direita", rotulo: "Direita" },
  { id: "ambas", rotulo: "Tanto faz" },
];

// A disponibilidade é gravada como lista no banco
// ([{dia, turnos}]) e usada como mapa na tela ({dia: [turnos]}).
// As duas conversões ficam aqui para não divergirem.
export type DisponibilidadeMapa = Record<string, string[]>;

export function paraMapa(lista: unknown): DisponibilidadeMapa {
  if (!Array.isArray(lista)) return {};
  const mapa: DisponibilidadeMapa = {};
  for (const item of lista) {
    const d = item as { dia?: string; turnos?: string[] };
    if (d?.dia && Array.isArray(d.turnos)) mapa[d.dia] = d.turnos;
  }
  return mapa;
}

export function paraLista(mapa: DisponibilidadeMapa) {
  return Object.entries(mapa)
    .filter(([, turnos]) => turnos.length > 0)
    .map(([dia, turnos]) => ({ dia, turnos }));
}
