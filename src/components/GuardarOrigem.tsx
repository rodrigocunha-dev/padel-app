"use client";

import { useEffect } from "react";

// Guarda de onde a pessoa veio, para o cadastro poder registrar depois.
//
// O código chega na URL (`/?de=abc12345`), mas o cadastro só termina
// vários passos adiante — login por telefone, código por SMS, onboarding.
// Sem guardar, a informação se perde no caminho.
//
// ⚠️ Fica no aparelho, não em cookie de rastreamento: é usado uma única
// vez, no momento em que o perfil nasce, e some depois.
export function GuardarOrigem() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codigo = params.get("de");
    if (codigo && /^[a-z0-9]{6,16}$/i.test(codigo)) {
      try {
        sessionStorage.setItem("convite_de", codigo);
      } catch {
        // Navegação privada com armazenamento bloqueado: sem atribuição,
        // e tudo bem. O cadastro continua funcionando.
      }
    }
  }, []);

  return null;
}
