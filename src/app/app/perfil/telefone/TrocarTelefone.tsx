"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mascararTelefoneBr, paraFormatoInternacional } from "@/lib/telefone";

type Etapa = "novo-numero" | "codigo";

// Trocar o telefone é diferente de editar nome ou cidade: o número é a
// CHAVE DE ENTRADA no app. Por isso o número novo precisa ser confirmado
// por código — senão bastaria digitar o número de outra pessoa.
//
// ⚠️ O telefone vive em DOIS lugares: no login (onde o código é validado) e
// no perfil (o que o clube e o organizador enxergam). Os dois têm de mudar
// juntos, senão a pessoa passa a entrar com um número e aparecer com outro.
export function TrocarTelefone({ atual }: { atual: string }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("novo-numero");
  const [novo, setNovo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function pedirCodigo() {
    const numero = paraFormatoInternacional(novo);
    if (!numero) {
      setErro("Digite o número com DDD.");
      return;
    }

    setOcupado(true);
    setErro(null);

    const supabase = criarClienteNavegador();
    // Manda o código para o número NOVO. A troca só se confirma quando esse
    // código volta — até lá o login continua sendo o número antigo.
    const { error } = await supabase.auth.updateUser({ phone: numero });

    setOcupado(false);

    if (error) {
      setErro(
        error.message.toLowerCase().includes("already")
          ? "Esse número já está em uso por outra conta."
          : "Não conseguimos enviar o código. Confira o número e tente de novo."
      );
      return;
    }

    setEtapa("codigo");
  }

  async function confirmar() {
    const numero = paraFormatoInternacional(novo);
    if (!numero) return;

    setOcupado(true);
    setErro(null);

    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.verifyOtp({
      phone: numero,
      token: codigo,
      type: "phone_change",
    });

    if (error) {
      setOcupado(false);
      setErro("Código errado ou vencido. Peça um novo.");
      return;
    }

    // Só agora o perfil acompanha. Se isto falhar, o login já mudou e o
    // perfil ficaria para trás — por isso o erro é explícito, e não um
    // silêncio que deixaria os dois lugares divergentes.
    const { data: sessao } = await supabase.auth.getUser();
    if (sessao.user) {
      const { error: erroPerfil } = await supabase
        .from("jogadores")
        .update({ telefone: mascararTelefoneBr(novo) })
        .eq("id", sessao.user.id);

      if (erroPerfil) {
        setOcupado(false);
        setErro(
          "Seu login já é o número novo, mas o perfil não atualizou. Fale com a gente."
        );
        return;
      }
    }

    posthog.capture("telefone_trocado");
    router.replace("/app/perfil");
    router.refresh();
  }

  if (etapa === "codigo") {
    return (
      <div className="mt-6 rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
        <p className="text-sm text-tinta-suave">
          Enviamos um código de 6 números para <strong>{novo}</strong>.
        </p>

        <label className="mt-4 block text-sm font-medium text-tinta">
          Código
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            inputMode="numeric"
            className="mt-1 w-full rounded-xl border border-black/10 px-4 py-3 text-tinta outline-none focus:border-primaria"
          />
        </label>

        {erro && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </p>
        )}

        <button
          type="button"
          disabled={codigo.length < 6 || ocupado}
          onClick={confirmar}
          className="mt-4 w-full rounded-2xl bg-primaria px-5 py-4 font-display font-bold text-white shadow-lg disabled:opacity-40"
        >
          {ocupado ? "Confirmando…" : "Confirmar e trocar"}
        </button>

        <button
          type="button"
          onClick={() => {
            setEtapa("novo-numero");
            setCodigo("");
            setErro(null);
          }}
          className="mt-3 w-full text-sm font-medium text-tinta-suave"
        >
          Usar outro número
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
      <p className="text-sm text-tinta-suave">
        Seu número hoje é <strong>{atual}</strong>.
      </p>

      <label className="mt-4 block text-sm font-medium text-tinta">
        Novo número (com DDD)
        <input
          value={novo}
          onChange={(e) => setNovo(mascararTelefoneBr(e.target.value))}
          placeholder="(51) 99999-8888"
          inputMode="tel"
          className="mt-1 w-full rounded-xl border border-black/10 px-4 py-3 text-tinta outline-none focus:border-primaria"
        />
      </label>

      {erro && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <button
        type="button"
        disabled={novo.length < 14 || ocupado}
        onClick={pedirCodigo}
        className="mt-4 w-full rounded-2xl bg-primaria px-5 py-4 font-display font-bold text-white shadow-lg disabled:opacity-40"
      >
        {ocupado ? "Enviando…" : "Receber código no número novo"}
      </button>

      <p className="mt-3 text-xs text-tinta-suave">
        Você continua entrando com o número antigo até confirmar o código.
      </p>
    </div>
  );
}
