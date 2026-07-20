"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

type Etapa = "telefone" | "codigo";

// Converte "(51) 99999-8888" para o formato internacional "+5551999998888".
function paraFormatoInternacional(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`;
  if (
    (digitos.length === 12 || digitos.length === 13) &&
    digitos.startsWith("55")
  )
    return `+${digitos}`;
  return null;
}

export function LoginOtp() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [etapa, setEtapa] = useState<Etapa>("telefone");
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const supabase = criarClienteNavegador();

  async function enviarCodigo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const numero = paraFormatoInternacional(String(dados.get("telefone") ?? ""));
    if (!numero) {
      setErro("Confira o número — use DDD + celular, ex.: (51) 99999-8888.");
      return;
    }

    setEnviando(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: numero });
    setEnviando(false);

    if (error) {
      setErro(
        "Não conseguimos enviar o código agora. Tente de novo em instantes."
      );
      console.error("Erro ao enviar OTP:", error.message);
      return;
    }

    posthog.capture("login_codigo_enviado");
    setTelefone(numero);
    setEtapa("codigo");
  }

  async function confirmarCodigo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const codigo = String(dados.get("codigo") ?? "").replace(/\D/g, "");
    if (codigo.length !== 6) {
      setErro("O código tem 6 números.");
      return;
    }

    setEnviando(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: telefone,
      token: codigo,
      type: "sms",
    });
    setEnviando(false);

    if (error) {
      setErro("Código incorreto ou vencido. Confira ou peça um novo.");
      return;
    }

    posthog.capture("login_concluido");
    router.replace(parametros.get("destino") ?? "/app");
  }

  if (etapa === "codigo") {
    return (
      <form
        onSubmit={confirmarCodigo}
        className="flex flex-col gap-4 rounded-2xl bg-superficie p-6 shadow-lg ring-1 ring-black/5"
      >
        <p className="text-sm text-tinta-suave">
          Enviamos um código de 6 números para{" "}
          <strong className="text-tinta">{telefone}</strong>.
        </p>
        <label htmlFor="codigo" className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-tinta">Código</span>
          <input
            id="codigo"
            name="codigo"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="000000"
            className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-center text-2xl tracking-[0.5em] text-tinta placeholder:text-tinta-suave/40 focus:border-primaria focus:outline-none focus:ring-2 focus:ring-primaria/30"
          />
        </label>

        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="rounded-full bg-destaque px-6 py-3 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
        >
          {enviando ? "Conferindo..." : "Confirmar e entrar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEtapa("telefone");
            setErro(null);
          }}
          className="text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          Trocar número ou pedir novo código
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={enviarCodigo}
      className="flex flex-col gap-4 rounded-2xl bg-superficie p-6 shadow-lg ring-1 ring-black/5"
    >
      <label htmlFor="telefone" className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-tinta">
          Seu WhatsApp (com DDD)
        </span>
        <input
          id="telefone"
          name="telefone"
          type="tel"
          autoComplete="tel"
          required
          placeholder="(51) 99999-8888"
          className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-tinta placeholder:text-tinta-suave/60 focus:border-primaria focus:outline-none focus:ring-2 focus:ring-primaria/30"
        />
      </label>

      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-full bg-destaque px-6 py-3 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
      >
        {enviando ? "Enviando..." : "Receber código"}
      </button>
    </form>
  );
}
