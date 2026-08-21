import { NextResponse } from "next/server";
import { criarClienteServidor, usuarioAtual } from "@/lib/supabase/server";
import { gatewayPagamento } from "@/lib/pagamentos/servidor";

// ============================================================
// CRIAR A COBRANÇA — no SERVIDOR
// ============================================================
// ⚠️ POR QUE ESTA ROTA EXISTE, se o app já tinha a "costura" de pagamento.
//
// A costura foi desenhada no Sprint 4 para o PIX SIMULADO, que não precisa
// de segredo nenhum — então a cobrança era criada dentro do navegador. Um
// gateway de verdade exige um token de acesso, e token no navegador é token
// entregue a quem quiser: qualquer pessoa poderia criar e consultar
// cobranças na conta do clube.
//
// Então a criação sobe para cá. A costura continua valendo e a tela continua
// sem saber qual gateway está ativo — ela só deixou de ser quem chama.
//
// O simulado passa pelo MESMO caminho, de propósito: se ele tivesse um
// atalho, o caminho do dinheiro de verdade seria o único nunca exercitado
// nos testes.

export async function POST(pedido: Request) {
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ erro: "Precisa estar logado." }, { status: 401 });
  }

  let corpo: { partidaId?: string; valorCentavos?: number; descricao?: string };
  try {
    corpo = await pedido.json();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const { partidaId, valorCentavos, descricao } = corpo;

  if (!partidaId || typeof valorCentavos !== "number" || valorCentavos <= 0) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const supabase = await criarClienteServidor();

  // ⚠️ O VALOR NÃO VEM DA TELA COMO VERDADE. Quem manda quanto pagar é o
  // servidor: o preço da partida dividido pelo divisor congelado. Confiar no
  // número enviado pelo navegador deixaria qualquer pessoa pagar R$ 0,01
  // numa quadra de R$ 200 — e o "pago" é o que libera o bloqueio de
  // inadimplente.
  const { data: partida } = await supabase
    .from("partidas")
    .select("id, preco_centavos, quadras ( nome ), inicio")
    .eq("id", partidaId)
    .maybeSingle();

  if (!partida) {
    return NextResponse.json({ erro: "Partida não encontrada." }, { status: 404 });
  }

  const { data: divisor } = await supabase.rpc("divisor_da_partida", {
    p_partida_id: partidaId,
  });

  const total = partida.preco_centavos ?? 0;
  const porPessoa = divisor && divisor > 0 ? Math.ceil(total / divisor) : 0;

  if (porPessoa <= 0) {
    return NextResponse.json(
      { erro: "Esta partida não tem valor a pagar." },
      { status: 400 }
    );
  }

  // Se a tela pediu um valor diferente do que o servidor calculou, ganha o
  // servidor — e o desencontro fica registrado, porque significa que a tela
  // está mostrando um número que não é o que será cobrado.
  if (valorCentavos !== porPessoa) {
    console.warn(
      `Valor divergente na partida ${partidaId}: tela pediu ${valorCentavos}, servidor calculou ${porPessoa}`
    );
  }

  try {
    const cobranca = await gatewayPagamento.criarCobranca({
      valorCentavos: porPessoa,
      descricao: descricao?.slice(0, 120) ?? "Sua parte da quadra",
      // Identifica o pagamento na volta do gateway. Único por jogador e
      // partida, que é a mesma chave da tabela `pagamentos`.
      referencia: `${partidaId}:${user.id}`,
    });

    return NextResponse.json({
      ...cobranca,
      valorCentavos: porPessoa,
      provedor: gatewayPagamento.nome,
    });
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "desconhecido";
    console.error("Falha ao criar cobrança:", motivo);

    // Mensagem genérica para a tela: detalhe de gateway não é assunto do
    // jogador, e pode conter informação da conta do clube.
    return NextResponse.json(
      { erro: "Não conseguimos gerar o PIX agora. Tente de novo." },
      { status: 502 }
    );
  }
}
