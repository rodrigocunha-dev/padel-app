// ============================================================
// CONTRATO DE PAGAMENTO — a "costura" para trocar de gateway
// ============================================================
// Todo o app conversa só com este contrato, nunca com um gateway
// específico. Para ligar o gateway real (Iugu, Mercado Pago, etc.)
// no futuro, basta escrever um arquivo que implemente `GatewayPagamento`
// e apontar a variável de ambiente NEXT_PUBLIC_PAGAMENTO_PROVEDOR para
// ele. Nenhuma tela ou regra do app precisa mudar.

// Uma cobrança PIX gerada pelo gateway.
export type CobrancaPix = {
  cobrancaId: string; // id da cobrança no gateway (no simulado, um id fake)
  qrCode: string; // imagem do QR em data: URL (no simulado, um QR fake)
  copiaECola: string; // o "PIX copia e cola" (no simulado, um texto fake)
  simulado: boolean; // true = não é dinheiro de verdade
};

export type DadosCobranca = {
  valorCentavos: number;
  descricao: string; // ex.: "Sua parte — Quadra 2, sex 20h"
  referencia: string; // nosso id do pagamento, volta no webhook de confirmação
};

// O que qualquer gateway (simulado ou real) precisa saber fazer.
export interface GatewayPagamento {
  readonly nome: string;
  readonly simulado: boolean;
  criarCobranca(dados: DadosCobranca): Promise<CobrancaPix>;
}
