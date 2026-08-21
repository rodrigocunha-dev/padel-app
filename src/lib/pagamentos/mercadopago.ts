import "server-only";

import type { GatewayPagamento, DadosCobranca, CobrancaPix } from "./tipos";

// ============================================================
// MERCADO PAGO — PIX de verdade
// ============================================================
// ⚠️ `server-only` na primeira linha não é enfeite: se alguém importar este
// arquivo de um componente de tela, a build QUEBRA. É a trava que impede o
// token de acesso de vazar para o navegador — e vazar esse token é dar a
// alguém o poder de criar e consultar cobranças na conta do clube.
//
// Por que Mercado Pago: é self-service. A conta se cria e as credenciais se
// pegam sem passar por atendimento comercial — que é exatamente onde o
// fundador travou com Stone e Iugu.
//
// ⚠️ ESTE ADAPTADOR AINDA NÃO PROCESSOU DINHEIRO DE VERDADE. Ele foi escrito
// contra a documentação pública e só entra em uso quando as credenciais
// existirem. Enquanto `MERCADOPAGO_ACCESS_TOKEN` não estiver definido, o app
// continua no PIX simulado — ver `index.ts`.

const BASE = "https://api.mercadopago.com";

type RespostaPagamento = {
  id: number;
  status: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;         // o "copia e cola"
      qr_code_base64?: string;  // a imagem do QR, em base64
    };
  };
};

export const gatewayMercadoPago: GatewayPagamento = {
  nome: "mercadopago",
  simulado: false,

  async criarCobranca(dados: DadosCobranca): Promise<CobrancaPix> {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) {
      throw new Error("MERCADOPAGO_SEM_CREDENCIAL");
    }

    const resposta = await fetch(`${BASE}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Evita cobrança duplicada se a mesma requisição for repetida (rede
        // instável, dois toques no botão). A referência é o nosso id do
        // pagamento, que é único por jogador e partida.
        "X-Idempotency-Key": dados.referencia,
      },
      body: JSON.stringify({
        transaction_amount: Number((dados.valorCentavos / 100).toFixed(2)),
        description: dados.descricao,
        payment_method_id: "pix",
        // Volta para nós na confirmação: é como o webhook sabe QUAL
        // pagamento nosso foi pago.
        external_reference: dados.referencia,
        payer: {
          // ⚠️ O Mercado Pago exige um e-mail do pagador. O nosso cadastro
          // é por TELEFONE e o e-mail é opcional (script 038), então este
          // campo precisa ser resolvido antes de ligar o gateway de verdade:
          // ou o app passa a pedir e-mail no pagamento, ou usamos um e-mail
          // técnico e a nota fiscal se resolve por outro caminho.
          // Deixado explícito de propósito, para não passar despercebido.
          email: process.env.MERCADOPAGO_EMAIL_PADRAO ?? "pagador@example.com",
        },
      }),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text();
      // O texto do erro NÃO vai para a tela: pode conter detalhe da conta.
      // Vai para o log do servidor, e a tela recebe uma mensagem genérica.
      console.error("Mercado Pago recusou a cobrança:", resposta.status, corpo);
      throw new Error("GATEWAY_RECUSOU");
    }

    const p = (await resposta.json()) as RespostaPagamento;
    const t = p.point_of_interaction?.transaction_data;

    if (!t?.qr_code) {
      console.error("Mercado Pago não devolveu o PIX:", JSON.stringify(p));
      throw new Error("GATEWAY_SEM_PIX");
    }

    return {
      cobrancaId: String(p.id),
      qrCode: t.qr_code_base64
        ? `data:image/png;base64,${t.qr_code_base64}`
        : "",
      copiaECola: t.qr_code,
      simulado: false,
    };
  },
};
