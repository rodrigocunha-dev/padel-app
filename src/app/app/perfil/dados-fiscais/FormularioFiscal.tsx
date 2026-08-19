"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

type Campos = {
  nome_completo: string;
  cpf: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade_fiscal: string;
  uf: string;
};

const VAZIO: Campos = {
  nome_completo: "",
  cpf: "",
  email: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade_fiscal: "",
  uf: "",
};

function mascararCpf(bruto: string): string {
  const d = bruto.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function mascararCep(bruto: string): string {
  const d = bruto.replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

// ⚠️ Os campos vêm e vão por FUNÇÃO, nunca por leitura direta da tabela.
// `jogadores` é legível por qualquer pessoa logada (é assim que a busca por
// nome acha quem convidar), então liberar o CPF por permissão de coluna
// deixaria o CPF de todo mundo visível para todo mundo.
export function FormularioFiscal() {
  const [campos, setCampos] = useState<Campos>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = criarClienteNavegador();
      const { data } = await supabase.rpc("meus_dados_fiscais");
      if (data) {
        setCampos({
          nome_completo: data.nome_completo ?? "",
          cpf: data.cpf ? mascararCpf(data.cpf) : "",
          email: data.email ?? "",
          cep: data.cep ? mascararCep(data.cep) : "",
          logradouro: data.logradouro ?? "",
          numero: data.numero ?? "",
          complemento: data.complemento ?? "",
          bairro: data.bairro ?? "",
          cidade_fiscal: data.cidade_fiscal ?? "",
          uf: data.uf ?? "",
        });
      }
      setCarregando(false);
    })();
  }, []);

  function mudar(campo: keyof Campos, valor: string) {
    setSalvo(false);
    setCampos((c) => ({ ...c, [campo]: valor }));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSalvo(false);

    const supabase = criarClienteNavegador();
    const { error } = await supabase.rpc("salvar_dados_fiscais", {
      p_nome_completo: campos.nome_completo || null,
      p_cpf: campos.cpf || null,
      p_email: campos.email || null,
      p_cep: campos.cep || null,
      p_logradouro: campos.logradouro || null,
      p_numero: campos.numero || null,
      p_complemento: campos.complemento || null,
      p_bairro: campos.bairro || null,
      p_cidade: campos.cidade_fiscal || null,
      p_uf: campos.uf || null,
    });

    setSalvando(false);

    if (error) {
      setErro(
        error.message.includes("CPF_INVALIDO")
          ? "O CPF precisa ter 11 números."
          : "Não conseguimos salvar agora."
      );
      return;
    }

    posthog.capture("dados_fiscais_salvos");
    setSalvo(true);
  }

  if (carregando) {
    return <p className="mt-6 text-sm text-tinta-suave">Carregando…</p>;
  }

  const campo = (
    rotulo: string,
    chave: keyof Campos,
    extras?: { placeholder?: string; mascara?: (v: string) => string; largura?: string }
  ) => (
    <label className={`block text-sm font-medium text-tinta ${extras?.largura ?? ""}`}>
      {rotulo}
      <input
        value={campos[chave]}
        placeholder={extras?.placeholder}
        onChange={(e) =>
          mudar(chave, extras?.mascara ? extras.mascara(e.target.value) : e.target.value)
        }
        className="mt-1 w-full rounded-xl border border-black/10 px-4 py-3 text-tinta outline-none focus:border-primaria"
      />
    </label>
  );

  return (
    <div className="mt-6 space-y-4">
      <section className="space-y-4 rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
        {campo("Nome completo", "nome_completo", {
          placeholder: "Como está no seu documento",
        })}
        {campo("CPF", "cpf", { placeholder: "000.000.000-00", mascara: mascararCpf })}
        {campo("E-mail", "email", { placeholder: "para receber a nota" })}
      </section>

      <section className="space-y-4 rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
        <p className="font-display text-sm font-bold text-tinta">Endereço</p>
        {campo("CEP", "cep", { placeholder: "00000-000", mascara: mascararCep })}
        {campo("Rua", "logradouro")}
        <div className="flex gap-3">
          {campo("Número", "numero", { largura: "w-1/3" })}
          {campo("Complemento", "complemento", { largura: "flex-1" })}
        </div>
        {campo("Bairro", "bairro")}
        <div className="flex gap-3">
          {campo("Cidade", "cidade_fiscal", { largura: "flex-1" })}
          {campo("UF", "uf", { largura: "w-20", placeholder: "RS" })}
        </div>
      </section>

      {erro && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{erro}</p>
      )}
      {salvo && (
        <p className="rounded-xl bg-primaria/10 p-4 text-sm font-bold text-primaria">
          Salvo ✓
        </p>
      )}

      <button
        type="button"
        disabled={salvando}
        onClick={salvar}
        className="w-full rounded-2xl bg-primaria px-5 py-4 font-display font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
