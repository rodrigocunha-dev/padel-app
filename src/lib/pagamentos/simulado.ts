import type {
  GatewayPagamento,
  DadosCobranca,
  CobrancaPix,
} from "./tipos";

// ============================================================
// PEÇA DESCARTÁVEL — PIX simulado
// ============================================================
// Este arquivo é o único que sabe que o pagamento é "de mentira".
// Ele gera um QR e um copia-e-cola falsos, sem processar dinheiro.
// Quando o gateway real entrar, este arquivo é substituído por um
// `iugu.ts`/`mercadopago.ts` — e mais nada muda no app.

// QR fake: um SVG quadriculado em data: URL, só para ter algo na tela.
function qrFake(texto: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
    <rect width="180" height="180" fill="#fff"/>
    <g fill="#0E5C46">
      ${Array.from({ length: 100 })
        .map((_, i) => {
          // Padrão pseudo-aleatório estável a partir do texto
          const semente = (texto.charCodeAt(i % texto.length) * (i + 7)) % 3;
          if (semente === 0) return "";
          const x = 10 + (i % 10) * 16;
          const y = 10 + Math.floor(i / 10) * 16;
          return `<rect x="${x}" y="${y}" width="14" height="14"/>`;
        })
        .join("")}
    </g>
    <rect x="6" y="6" width="34" height="34" fill="none" stroke="#0E5C46" stroke-width="6"/>
    <rect x="140" y="6" width="34" height="34" fill="none" stroke="#0E5C46" stroke-width="6"/>
    <rect x="6" y="140" width="34" height="34" fill="none" stroke="#0E5C46" stroke-width="6"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const gatewaySimulado: GatewayPagamento = {
  nome: "simulado",
  simulado: true,

  async criarCobranca(dados: DadosCobranca): Promise<CobrancaPix> {
    const cobrancaId = `sim_${dados.referencia}_${Date.now().toString(36)}`;
    const copiaECola =
      `00020126SIMULADO-PIX-${dados.referencia}` +
      `520400005303986540${(dados.valorCentavos / 100).toFixed(2)}5802BR6009PADELTESTE`;
    return {
      cobrancaId,
      qrCode: qrFake(cobrancaId),
      copiaECola,
      simulado: true,
    };
  },
};
