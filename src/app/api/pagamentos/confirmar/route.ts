import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

// ============================================================
// /api/pagamentos/confirmar — o "furo" único por onde um pagamento vira PAGO
// ============================================================
// Este é EXATAMENTE o endereço que o gateway real vai chamar (webhook)
// quando o PIX cair de verdade. No modo simulado, quem chama é o botão
// "Simular pagamento confirmado" (só visível em teste). Trocar pelo
// gateway real = manter este endpoint e ajustar só a forma de AUTORIZAR
// (hoje: sessão do jogador; no real: verificar a assinatura do webhook do
// gateway e usar uma chave de serviço).

export async function POST(request: NextRequest) {
  let corpo: { cobrancaId?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });
  }

  const cobrancaId = corpo.cobrancaId;
  if (!cobrancaId) {
    return NextResponse.json({ erro: "cobrancaId ausente" }, { status: 400 });
  }

  const supabase = await criarClienteServidor();

  // ----- AUTORIZAÇÃO (modo simulado) -----
  // Só o próprio jogador logado confirma o pagamento dele. O RLS garante
  // que o update abaixo só atinge a linha do próprio jogador.
  //
  // GATEWAY REAL: aqui, em vez de exigir sessão, verificar a assinatura do
  // webhook do gateway e marcar como pago com uma chave de serviço.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("pagamentos")
    .update({ status: "pago", pago_em: new Date().toISOString() })
    .eq("cobranca_externa_id", cobrancaId)
    .eq("status", "pendente")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Erro ao confirmar pagamento:", error.message);
    return NextResponse.json({ erro: "falha ao confirmar" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { erro: "cobrança não encontrada ou já paga" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, pagamentoId: data.id });
}
