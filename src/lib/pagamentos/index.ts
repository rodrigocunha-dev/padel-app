import type { GatewayPagamento } from "./tipos";
import { gatewaySimulado } from "./simulado";

// ============================================================
// O QUE A TELA PODE SABER SOBRE PAGAMENTO
// ============================================================
// ⚠️ Este arquivo é importado por componentes de tela, então NÃO pode
// conhecer o gateway real: ele carregaria o token de acesso junto, e token
// no navegador é token entregue a quem quiser.
//
// Quem escolhe o gateway de verdade é `servidor.ts`, que é `server-only`.
// Aqui fica só o que a tela precisa saber: se o pagamento é de mentira, para
// mostrar ou esconder o botão "simular pagamento".
//
// A criação da cobrança passou para `POST /api/pagamentos/criar`.

// Diz apenas se estamos em modo simulado. Não decide nada — quem decide é o
// servidor; esta é a informação que a tela usa para se desenhar.
export const pagamentoEhSimulado =
  (process.env.NEXT_PUBLIC_PAGAMENTO_SIMULADO ?? "sim") !== "nao";

// Para telas que só precisam do rótulo do provedor simulado.
export const gatewaySimuladoParaTela: GatewayPagamento = gatewaySimulado;

export type { GatewayPagamento, CobrancaPix, DadosCobranca } from "./tipos";
