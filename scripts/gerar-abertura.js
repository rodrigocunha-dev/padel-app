// Gera as telas de abertura do iPhone (apple-touch-startup-image).
//
// Rodar da raiz do projeto:  node scripts/gerar-abertura.js
//
// Por que existe: o iPhone exige uma imagem POR TAMANHO de aparelho, com a
// media query exata. Não existe uma que sirva para todas — se faltar a do
// aparelho, ele não mostra abertura nenhuma e a tela preta volta. Fazer isso
// na mão seriam 12 imagens e 12 media queries para errar.
//
// ⚠️ O nome e as cores aqui são PROVISÓRIOS (a marca ainda está entre
// FaltaUm e Fechou, e a cor entre verde e azul). Quando a marca fechar, é
// mudar as constantes abaixo, rodar de novo e commitar as imagens novas — a
// lista no `src/app/layout.tsx` não muda, porque os nomes dos arquivos são
// derivados do tamanho, não da marca.

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const VERDE = "#0e5c46"; // verde-quadra
const BOLA = "#d6f455"; // amarelo-bola
const NOME = "Padel";

const destino = path.join(process.cwd(), "public", "abertura");
fs.mkdirSync(destino, { recursive: true });

// device-width x device-height (em pontos) e a densidade da tela.
// Cobre do iPhone SE 1 ao 16 Pro Max.
const APARELHOS = [
  { l: 320, a: 568, d: 2 }, // SE 1, 5s
  { l: 375, a: 667, d: 2 }, // 8, 7, 6s, SE 2/3
  { l: 414, a: 736, d: 3 }, // 8 Plus, 7 Plus
  { l: 375, a: 812, d: 3 }, // X, XS, 11 Pro, 12/13 mini
  { l: 414, a: 896, d: 2 }, // XR, 11
  { l: 414, a: 896, d: 3 }, // XS Max, 11 Pro Max
  { l: 390, a: 844, d: 3 }, // 12, 13, 14
  { l: 428, a: 926, d: 3 }, // 12/13 Pro Max, 14 Plus
  { l: 393, a: 852, d: 3 }, // 14 Pro, 15, 16
  { l: 430, a: 932, d: 3 }, // 14 Pro Max, 15 Plus, 16 Plus
  { l: 402, a: 874, d: 3 }, // 16 Pro
  { l: 440, a: 956, d: 3 }, // 16 Pro Max
];

// A bola do ícone, redesenhada em vetor para não borrar ao ampliar.
// As proporções saíram do próprio `public/icone-512.png`.
function bolaSVG(tamanho) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 512 512">
      <circle cx="257" cy="256" r="152" fill="${BOLA}"/>
      <path d="M 235 140 A 120 120 0 0 1 235 372"
            fill="none" stroke="${VERDE}" stroke-width="24" />
    </svg>`);
}

function nomeSVG(largura, altura, tamanhoFonte) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}">
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
            font-family="Archivo, Helvetica, Arial, sans-serif"
            font-size="${tamanhoFonte}" font-weight="800"
            letter-spacing="${tamanhoFonte * 0.02}"
            fill="${BOLA}">${NOME}</text>
    </svg>`);
}

(async () => {
  const feitas = [];

  for (const ap of APARELHOS) {
    const L = ap.l * ap.d;
    const A = ap.a * ap.d;

    const tamBola = Math.round(Math.min(L, A) * 0.34);
    const tamFonte = Math.round(Math.min(L, A) * 0.088);
    // Caixa justa em volta do texto: sobra vertical aqui vira vão entre a
    // bola e o nome, e os dois passam a parecer elementos soltos.
    const alturaTexto = Math.round(tamFonte * 1.25);
    const vao = Math.round(tamFonte * 0.3);

    // Bloco (bola + nome) centrado, puxado um pouco acima do meio — centro
    // ótico, que é onde o olho espera encontrar.
    const alturaBloco = tamBola + vao + alturaTexto;
    const topoBloco = Math.round((A - alturaBloco) / 2 - A * 0.04);

    const nome = `abertura-${L}x${A}.png`;

    await sharp({
      create: { width: L, height: A, channels: 4, background: VERDE },
    })
      .composite([
        {
          input: await sharp(bolaSVG(tamBola)).png().toBuffer(),
          top: topoBloco,
          left: Math.round((L - tamBola) / 2),
        },
        {
          input: await sharp(nomeSVG(L, alturaTexto, tamFonte)).png().toBuffer(),
          top: topoBloco + tamBola + vao,
          left: 0,
        },
      ])
      .png({ compressionLevel: 9 })
      .toFile(path.join(destino, nome));

    feitas.push({ nome, ...ap, L, A, bytes: fs.statSync(path.join(destino, nome)).size });
  }

  console.log(`${feitas.length} imagens geradas em public/abertura/`);
  console.log(
    "total: " + Math.round(feitas.reduce((s, f) => s + f.bytes, 0) / 1024) + " KB"
  );
  console.log(
    "\nSe algum aparelho novo entrar na lista, o trecho para o layout.tsx e:\n"
  );
  for (const f of feitas) {
    console.log(
      `      { url: "/abertura/${f.nome}", media: "(device-width: ${f.l}px) and (device-height: ${f.a}px) and (-webkit-device-pixel-ratio: ${f.d}) and (orientation: portrait)" },`
    );
  }
})();
