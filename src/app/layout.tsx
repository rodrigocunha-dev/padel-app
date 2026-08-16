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
  appleWebApp: { capable: true, title: "Padel", statusBarStyle: "default" },
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
