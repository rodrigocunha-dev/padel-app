import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Padel perto de você — lista de espera",
  description:
    "Encontre parceiros do seu nível, monte partidas e reserve a quadra sem taxa de conveniência. Entre na lista de espera.",
  // O manifesto é o que torna o app instalável. No iPhone isso não é
  // conforto: sem estar na tela de início, o Safari não deixa nem PEDIR
  // permissão de notificação.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Padel",
    statusBarStyle: "default",
    // Tela de abertura. O iPhone pinta ESTAS imagens no instante do toque no
    // ícone, do próprio aparelho, sem internet nenhuma — é o que substitui o
    // tempo de tela preta enquanto a página não chega.
    //
    // ⚠️ Exige uma imagem por tamanho de aparelho, com a media query exata.
    // Não existe uma que sirva para todos: se faltar a do aparelho, ele não
    // mostra nada e a tela preta volta. Por isso a lista é longa — ela cobre
    // do iPhone SE ao 16 Pro Max, só em pé (o manifesto trava a orientação).
    //
    // Gerador: scripts/gerar-abertura.js (roda com `node`, usa o sharp que já
    // vem com o Next). Quando a marca for decidida, é regerar e trocar.
    startupImage: [
      // CORINGA, sem media query — vem primeiro de propósito.
      //
      // As entradas abaixo só valem se o tamanho da tela bater EXATAMENTE.
      // Aparelho fora da lista (modelo novo, iPad, iPhone que eu não previ)
      // não casa com nenhuma e volta a abrir no preto — foi o que aconteceu
      // no primeiro teste. Este coringa fecha esse buraco: quem não casa com
      // nada usa ele, esticado para o tamanho do aparelho.
      //
      // Esticar não estraga o desenho porque ele é fundo liso com a marca no
      // centro — não tem borda nem detalhe de canto para deformar. Foi por
      // isso que a arte nasceu assim.
      { url: "/abertura/abertura-1320x2868.png" },

      { url: "/abertura/abertura-640x1136.png", media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/abertura/abertura-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/abertura/abertura-1242x2208.png", media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/abertura/abertura-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/abertura/abertura-828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/abertura/abertura-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/abertura/abertura-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/abertura/abertura-1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/abertura/abertura-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/abertura/abertura-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/abertura/abertura-1206x2622.png", media: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/abertura/abertura-1320x2868.png", media: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
    ],
  },
  icons: {
    icon: [
      { url: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e5c46",
  // Também está no CSS (`globals.css`), e não é repetição inútil: o arquivo
  // de CSS é um download à parte, então até ele chegar a tela ainda seria a
  // do navegador — preta, no aparelho em modo escuro. Aqui a informação vai
  // junto com os primeiros bytes da página, sem esperar mais nada.
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      data-tema="verde"
      className={`${archivo.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-fundo text-tinta font-sans">
        {children}
      </body>
    </html>
  );
}
