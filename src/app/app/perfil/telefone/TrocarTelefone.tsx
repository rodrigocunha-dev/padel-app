"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mascararTelefoneBr, paraFormatoInternacional } from "@/lib/telefone";

type Etapa = "novo-numero" | "confirmar-numero" | "codigo";

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

  // Antes de mandar o código, a pessoa relê o número em destaque.
  //
  // O erro comum aqui não é má-fé, é dígito trocado — e um dígito trocado
  // manda o código para o celular de um estranho, deixando a pessoa sem
  // conseguir concluir e sem entender por quê. Reler é barato; descobrir
  // depois, não.
  function revisar() {
    if (!paraFormatoInternacional(novo)) {
      setErro("Digite o número com DDD.");
      return;
    }
    setErro(null);
    setEtapa("confirmar-numero");
  }

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
      // Número já ligado a outra conta: a troca não tem como acontecer, nem
      // com o código. O telefone é único no login — duas contas com o mesmo
      // número não podem existir. Voltar para a digitação é o único caminho.
      const emUso = error.message.toLowerCase().includes("already");
      setEtapa("novo-numero");
      setErro(
        emUso
          ? "Este número já está ligado a outra conta. Se ele é seu e você perdeu o acesso àquela conta, fale com a gente."
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

      // Convites que alguém mandou para o número NOVO, quando ele ainda não
      // era seu, passam a ser seus agora.
      //
      // É a mesma função que roda no fim do cadastro (Entrega B) e ela lê o
      // telefone do PERFIL — por isso vem depois do update acima, e não
      // antes: rodar antes procuraria pelo número velho.
      const { data: ligados } = await supabase.rpc(
        "vincular_convites_do_telefone"
      );
      if (typeof ligados === "number" && ligados > 0) {
        posthog.capture("convites_migrados_na_troca", { quantidade: ligados });
      }
    }

    posthog.capture("telefone_trocado");
    router.replace("/app/perfil");
    router.refresh();
  }

  if (etapa === "confirmar-numero") {
    return (
      <div className="mt-6 rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
        <p className="text-sm text-tinta">
          Vamos mandar um código para este número. Confira antes:
        </p>

        <p className="mt-4 rounded-xl bg-fundo px-4 py-4 text-center font-display text-2xl font-extrabold tracking-wide text-tinta">
          {novo}
        </p>

        <p className="mt-3 text-xs text-tinta-suave">
          Um dígito trocado manda o código para o celular de outra pessoa, e
          você não consegue concluir a troca.
        </p>

        <button
          type="button"
          disabled={ocupado}
          onClick={pedirCodigo}
          className="mt-4 w-full rounded-2xl bg-primaria px-5 py-4 font-display font-bold text-white shadow-lg disabled:opacity-40"
        >
          {ocupado ? "Enviando…" : "Está certo, mandar o código"}
        </button>

        <button
          type="button"
          onClick={() => setEtapa("novo-numero")}
          className="mt-3 w-full text-sm font-medium text-tinta-suave"
        >
          Corrigir o número
        </button>
      </div>
    );
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
        onClick={revisar}
        className="mt-4 w-full rounded-2xl bg-primaria px-5 py-4 font-display font-bold text-white shadow-lg disabled:opacity-40"
      >
        Continuar
      </button>

      <p className="mt-3 text-xs text-tinta-suave">
        Você continua entrando com o número antigo até confirmar o código.
      </p>
    </div>
  );
}
