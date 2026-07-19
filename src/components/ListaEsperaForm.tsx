"use client";

import { useState, type FormEvent } from "react";
import posthog from "posthog-js";
import { supabase } from "@/lib/supabase";

const CATEGORIAS = [
  { valor: "1", rotulo: "1ª — elite" },
  { valor: "2", rotulo: "2ª" },
  { valor: "3", rotulo: "3ª" },
  { valor: "4", rotulo: "4ª" },
  { valor: "5", rotulo: "5ª" },
  { valor: "6", rotulo: "6ª" },
  { valor: "7", rotulo: "7ª — iniciante" },
  { valor: "nao_sei", rotulo: "Ainda não sei minha categoria" },
];

type Status = "idle" | "enviando" | "sucesso" | "duplicado" | "erro";

export function ListaEsperaForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setStatus("enviando");

    const dados = new FormData(evento.currentTarget);
    const nome = String(dados.get("nome") ?? "").trim();
    const whatsappBruto = String(dados.get("whatsapp") ?? "");
    const whatsapp = whatsappBruto.replace(/\D/g, "");
    const cidade = String(dados.get("cidade") ?? "").trim();
    const clube = String(dados.get("clube") ?? "").trim();
    const categoria = String(dados.get("categoria") ?? "");

    if (!nome || whatsapp.length < 10 || !cidade || !categoria) {
      setStatus("erro");
      return;
    }

    const { error } = await supabase.from("lista_espera").insert({
      nome,
      whatsapp,
      cidade,
      clube: clube || null,
      categoria,
    });

    if (error) {
      setStatus(error.code === "23505" ? "duplicado" : "erro");
      return;
    }

    // LGPD: o evento de métrica NÃO leva nome nem WhatsApp — só dados
    // agregáveis para entender de onde vem a demanda.
    posthog.capture("cadastro_lista_espera", {
      cidade,
      categoria,
      informou_clube: clube.length > 0,
    });

    setStatus("sucesso");
    evento.currentTarget.reset();
  }

  if (status === "sucesso") {
    return (
      <div className="rounded-2xl bg-superficie p-6 text-center shadow-lg ring-1 ring-black/5">
        <p className="font-display text-xl font-bold text-primaria">
          Você está na lista! 🎾
        </p>
        <p className="mt-2 text-sm text-tinta-suave">
          Vamos te chamar no WhatsApp assim que abrirmos por aqui.
        </p>
      </div>
    );
  }

  if (status === "duplicado") {
    return (
      <div className="rounded-2xl bg-superficie p-6 text-center shadow-lg ring-1 ring-black/5">
        <p className="font-display text-xl font-bold text-primaria">
          Esse WhatsApp já está na lista! ✅
        </p>
        <p className="mt-2 text-sm text-tinta-suave">
          Pode ficar tranquilo(a), você já garantiu seu lugar.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-4 rounded-2xl bg-superficie p-6 shadow-lg ring-1 ring-black/5"
    >
      <Campo label="Nome" htmlFor="nome">
        <input
          id="nome"
          name="nome"
          type="text"
          required
          autoComplete="name"
          placeholder="Seu nome completo"
          className={estiloInput}
        />
      </Campo>

      <Campo label="WhatsApp" htmlFor="whatsapp">
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          required
          autoComplete="tel"
          placeholder="(51) 99999-9999"
          className={estiloInput}
        />
      </Campo>

      <Campo label="Cidade" htmlFor="cidade">
        <input
          id="cidade"
          name="cidade"
          type="text"
          required
          autoComplete="address-level2"
          placeholder="Ex.: Novo Hamburgo"
          className={estiloInput}
        />
      </Campo>

      <Campo label="Clube onde joga (se já tiver um)" htmlFor="clube">
        <input
          id="clube"
          name="clube"
          type="text"
          placeholder="Ex.: Arena Padel Sinos"
          className={estiloInput}
        />
      </Campo>

      <Campo label="Categoria" htmlFor="categoria">
        <select
          id="categoria"
          name="categoria"
          required
          defaultValue=""
          className={estiloInput}
        >
          <option value="" disabled>
            Selecione sua categoria
          </option>
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </Campo>

      {status === "erro" && (
        <p className="text-sm font-medium text-red-600">
          Confira os campos obrigatórios e tente de novo.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "enviando"}
        className="mt-2 rounded-full bg-destaque px-6 py-3 font-display font-bold text-destaque-tinta transition hover:brightness-95 disabled:opacity-60"
      >
        {status === "enviando" ? "Enviando..." : "Entrar na lista de espera"}
      </button>
    </form>
  );
}

const estiloInput =
  "w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-tinta placeholder:text-tinta-suave/60 focus:border-primaria focus:outline-none focus:ring-2 focus:ring-primaria/30";

function Campo({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-tinta">{label}</span>
      {children}
    </label>
  );
}
