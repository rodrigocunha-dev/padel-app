import { BarraNavegacao } from "@/components/BarraNavegacao";

// Layout só do app do jogador. O painel do clube (/clube) e o login
// (/entrar) ficam de fora — a barra é da experiência do jogador.
export default function LayoutApp({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <BarraNavegacao />
    </>
  );
}
