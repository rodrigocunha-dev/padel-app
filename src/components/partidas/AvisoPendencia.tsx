import Link from "next/link";

// A mensagem "você tem jogo não pago" aparece em vários lugares (criar
// partida, entrar, reservar, aceitar convite). Em todos, ela dizia o
// problema e deixava a pessoa procurar a dívida sozinha.
// Aqui ela vira um caminho: leva direto para Minhas partidas já filtrada
// pelo que está em aberto.
//
// `embutido` = já está dentro de outro bloco colorido (a mensagem
// flutuante), então não repete fundo nem moldura.
export function AvisoPendencia({
  texto,
  embutido = false,
}: {
  texto?: string;
  embutido?: boolean;
}) {
  const mensagem =
    texto ?? "Você tem um jogo não pago. Acerte antes de entrar em outro.";

  if (embutido) {
    return (
      <Link href="/app/partidas/minhas?filtro=inadimplente" className="block">
        <span className="block">{mensagem}</span>
        <span className="mt-1 block text-xs font-bold underline">
          Toque para ver e pagar →
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/app/partidas/minhas?filtro=inadimplente"
      className="mt-3 block rounded-xl bg-red-100 p-3 ring-1 ring-red-200 transition hover:brightness-105"
    >
      <p className="text-sm font-medium text-red-700">{mensagem}</p>
      <p className="mt-1 text-xs font-bold text-red-700">
        Toque para ver e pagar →
      </p>
    </Link>
  );
}
