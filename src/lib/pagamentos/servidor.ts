import "server-only";

import type { GatewayPagamento } from "./tipos";
import { gatewaySimulado } from "./simulado";
import { gatewayMercadoPago } from "./mercadopago";

// ============================================================
// QUAL GATEWAY ESTÁ VALENDO — decidido no SERVIDOR
// ============================================================
// Separado do `index.ts` de propósito. O `index.ts` é importado pelas telas
// e só pode conter o que é seguro no navegador; este arquivo é `server-only`
// e é o único que conhece o gateway real.
//
// ⚠️ A ESCOLHA NÃO É SÓ A VARIÁVEL: o gateway real só entra se as
// credenciais existirem de verdade. Sem essa segunda checagem, marcar a
// variável e esquecer a chave derrubaria o pagamento de todo mundo, com um
// erro que só apareceria na hora em que alguém tentasse pagar.
//
// Para ligar o Mercado Pago, o fundador cadastra na Vercel:
//   PAGAMENTO_PROVEDOR=mercadopago
//   MERCADOPAGO_ACCESS_TOKEN=...   ← SEGREDO, nunca no chat nem no código

const PROVEDOR = process.env.PAGAMENTO_PROVEDOR ?? "simulado";

function escolher(): GatewayPagamento {
  if (PROVEDOR === "mercadopago") {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      console.error(
        "PAGAMENTO_PROVEDOR=mercadopago, mas MERCADOPAGO_ACCESS_TOKEN não está definido. Seguindo no PIX simulado."
      );
      return gatewaySimulado;
    }
    return gatewayMercadoPago;
  }
  return gatewaySimulado;
}

export const gatewayPagamento = escolher();
