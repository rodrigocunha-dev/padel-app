import { Suspense } from "react";
import { BarraNavegacao } from "@/components/BarraNavegacao";
import { IrPelaNotificacao } from "@/components/IrPelaNotificacao";
import { perfilAtual, usuarioAtual } from "@/lib/supabase/server";

// A barra mostra a foto (ou a inicial) no lugar do ícone de perfil. Buscar
// isso é ida e volta ao banco — e enquanto o layout esperava, o app inteiro
// ficava sem pintar nada, porque o layout envolve todas as telas.
//
// Separada num componente próprio, ela espera sozinha: a tela aparece na
// hora com o ícone genérico e a foto entra por cima quando chega.
async function BarraComPerfil() {
  const user = await usuarioAtual();
  const jogador = user ? await perfilAtual(user.id) : null;

  return (
    <BarraNavegacao
      nome={jogador?.nome ?? null}
      fotoUrl={jogador?.foto_url ?? null}
    />
  );
}

// Layout só do app do jogador. O painel do clube (/clube) e o login
// (/entrar) ficam de fora — a barra é da experiência do jogador.
export default function LayoutApp({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Fica no layout do app inteiro: a notificação pode chegar com a
          pessoa em qualquer tela, e o ouvinte precisa existir em todas. */}
      <IrPelaNotificacao />
      {children}
      <Suspense fallback={<BarraNavegacao nome={null} fotoUrl={null} />}>
        <BarraComPerfil />
      </Suspense>
    </>
  );
}
