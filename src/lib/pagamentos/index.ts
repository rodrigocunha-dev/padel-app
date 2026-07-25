import type { GatewayPagamento } from "./tipos";
import { gatewaySimulado } from "./simulado";

// ============================================================
// CHAVE DE TROCA DO GATEWAY
// ============================================================
// Uma variável de ambiente decide qual gateway o app usa. Hoje só existe
// o "simulado". Quando o real chegar, importe-o aqui e adicione ao mapa —
// nada além deste arquivo muda.
//
//   NEXT_PUBLIC_PAGAMENTO_PROVEDOR=simulado   (padrão)
//   NEXT_PUBLIC_PAGAMENTO_PROVEDOR=iugu        (futuro)

const PROVEDOR = process.env.NEXT_PUBLIC_PAGAMENTO_PROVEDOR ?? "simulado";

const gateways: Record<string, GatewayPagamento> = {
  simulado: gatewaySimulado,
  // iugu: gatewayIugu,          // ← futuro
  // mercadopago: gatewayMercadoPago,
};

export const gatewayPagamento: GatewayPagamento =
  gateways[PROVEDOR] ?? gatewaySimulado;

// Atalho usado pelas telas para mostrar/esconder o botão "simular
// pagamento" (que só existe enquanto o gateway é o simulado).
export const pagamentoEhSimulado = gatewayPagamento.simulado;

export type { GatewayPagamento, CobrancaPix, DadosCobranca } from "./tipos";
