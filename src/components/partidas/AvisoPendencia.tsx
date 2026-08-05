import Link from "next/link";

// A mensagem "você tem jogo não pago" aparece em vários lugares (criar
// partida, entrar, reservar, aceitar convite). Em todos, ela dizia o
// problema e deixava a pessoa procurar a dívida sozinha.
// Aqui ela vira um caminho: leva direto para Minhas partidas já filtrada
// pelo que está em aberto.
export function AvisoPendencia({ texto }: { texto?: string }) {
  return (
    <Link
      href="/app/partidas/minhas?filtro=inadimplente"
      className="mt-3 block rounded-xl bg-red-100 p-3 ring-1 ring-red-200 transition hover:brightness-105"
    >
      <p className="text-sm font-medium text-red-700">
        {texto ?? "Você tem um jogo não pago. Acerte antes de entrar em outro."}
      </p>
      <p className="mt-1 text-xs font-bold text-red-700">
        Toque para ver e pagar →
      </p>
    </Link>
  );
}
