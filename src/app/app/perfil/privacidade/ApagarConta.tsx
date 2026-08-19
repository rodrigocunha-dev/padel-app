"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import posthog from "posthog-js";

// Apagar a conta é irreversível e não tem "desfazer". Por isso são DOIS
// passos: o primeiro abre o aviso, o segundo exige digitar a palavra.
// Confirmação por texto (e não um "tem certeza?") porque o segundo toque em
// um botão é quase automático — digitar não é.
export function ApagarConta() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"parado" | "apagando">("parado");
  const [erro, setErro] = useState<string | null>(null);

  const PALAVRA = "APAGAR";

  async function apagar() {
    setEstado("apagando");
    setErro(null);

    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc("anonimizar_minha_conta");

    if (error) {
      setEstado("parado");
      // Os dois motivos de recusa são decididos no SERVIDOR, e cada um tem
      // uma saída diferente — por isso a mensagem é específica em vez de um
      // "não deu certo" genérico.
      if (error.message.includes("TEM_DIVIDA")) {
        setErro(
          "Você tem jogo com pagamento em aberto. Acerte primeiro e depois volte aqui — a conta some, mas a conta de pagar fica com quem jogou."
        );
      } else if (error.message.includes("DONO_DE_CLUBE")) {
        setErro(
          "Sua conta é dona de um clube. Fale com a gente antes: é preciso transferir ou encerrar o clube primeiro, senão a agenda e as reservas dos jogadores ficariam sem dono."
        );
      } else {
        setErro("Não conseguimos apagar agora. Tente de novo em alguns minutos.");
      }
      return;
    }

    posthog.capture("conta_apagada");
    await supabase.auth.signOut();
    router.replace("/entrar");
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 w-full rounded-2xl bg-superficie p-5 text-left shadow-lg ring-1 ring-black/5 transition hover:ring-red-300"
      >
        <p className="font-display text-base font-bold text-red-700">
          Apagar minha conta
        </p>
        <p className="mt-1 text-sm text-tinta-suave">
          Remove seu nome, foto e telefone do app
        </p>
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl bg-red-50 p-5 shadow-lg ring-1 ring-red-200">
      <p className="font-display text-base font-bold text-red-700">
        Apagar minha conta
      </p>

      <p className="mt-2 text-sm text-red-900/80">
        Seu nome, foto, telefone, cidade e preferências são apagados, e você
        não consegue mais entrar com este número.
      </p>

      <p className="mt-3 text-sm text-red-900/80">
        <strong>Os jogos que você jogou continuam existindo</strong>, sem o seu
        nome. Isso não é uma escolha nossa por comodidade: o resultado de um
        jogo pertence também aos outros três, e apagá-lo mudaria a categoria
        de gente que não pediu nada.
      </p>

      <p className="mt-3 text-sm text-red-900/80">
        O clube onde você jogou mantém o registro das suas reservas e
        pagamentos, como qualquer comércio precisa manter.
      </p>

      <p className="mt-3 text-sm font-bold text-red-900">
        Não dá para desfazer.
      </p>

      <label className="mt-4 block text-sm font-medium text-red-900">
        Para confirmar, digite {PALAVRA}
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value.toUpperCase())}
          className="mt-1 w-full rounded-xl border border-red-300 bg-white px-4 py-3 text-tinta outline-none focus:border-red-500"
          autoComplete="off"
          inputMode="text"
        />
      </label>

      {erro && (
        <p className="mt-3 rounded-xl bg-white p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setTexto("");
            setErro(null);
          }}
          className="flex-1 rounded-xl bg-white px-4 py-3 font-display font-bold text-tinta shadow ring-1 ring-black/5"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={texto !== PALAVRA || estado === "apagando"}
          onClick={apagar}
          className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-display font-bold text-white shadow disabled:opacity-40"
        >
          {estado === "apagando" ? "Apagando…" : "Apagar"}
        </button>
      </div>
    </div>
  );
}
