"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";

// ============================================================
// CONVIDAR QUEM AINDA NÃO TEM CONTA
// ============================================================
// A busca por nome só acha quem já está no app. Mas no jogo de grupo fixo
// sempre tem alguém que ainda não se cadastrou — e é justamente esse
// pessoal que precisa entrar para a sessão contar para o rating.
//
// O convite fica PENDENTE até a pessoa criar conta, e mesmo depois ela
// ainda precisa aceitar. Criar conta não é dizer sim para um jogo.
//
// ⚠️ Sem envio automático: o BSP de WhatsApp não foi contratado. O app
// monta a mensagem e o organizador envia pelo WhatsApp dele. Quando o
// envio automático existir, muda só esta parte.

type Props = { partidaId: string; nomeDoJogo: string };

// Formata enquanto digita — (51) 99999-8888 —, mas o que vai para o banco
// são só os dígitos.
function mascara(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function ConvidarPorTelefone({ partidaId, nomeDoJogo }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [convidado, setConvidado] = useState<{ nome: string; tel: string } | null>(null);
  // Melhoria progressiva: o botão de escolher da agenda só existe onde o
  // navegador suporta (na prática, Chrome no Android). No iPhone a API é
  // experimental e o usuário teria de ligar na mão — então lá o botão
  // simplesmente não aparece, em vez de aparecer e não funcionar.
  //
  // Lido assim, e não com um efeito, porque o servidor não tem navegador:
  // o terceiro argumento é o que ele responde, e evita a tela piscar entre
  // uma versão e outra.
  const temAgenda = useSyncExternalStore(
    () => () => {},
    () => "contacts" in navigator && "ContactsManager" in window,
    () => false
  );

  async function escolherDaAgenda() {
    try {
      type Contatos = {
        select: (
          p: string[],
          o: { multiple: boolean }
        ) => Promise<{ name?: string[]; tel?: string[] }[]>;
      };
      const agenda = (navigator as unknown as { contacts: Contatos }).contacts;
      const [contato] = await agenda.select(["name", "tel"], { multiple: false });
      if (!contato) return;
      if (contato.name?.[0]) setNome(contato.name[0]);
      if (contato.tel?.[0]) setTelefone(mascara(contato.tel[0]));
      posthog.capture("convite_agenda_usada");
    } catch {
      // A pessoa fechou o seletor. Não é erro.
    }
  }

  async function convidar() {
    setOcupado(true);
    setErro(null);
    const supabase = criarClienteNavegador();
    const { data, error } = await supabase.rpc("convidar_por_telefone", {
      p_partida_id: partidaId,
      p_telefone: telefone,
      p_nome: nome,
    });
    setOcupado(false);

    if (error) {
      if (error.message.includes("TELEFONE_INVALIDO")) {
        setErro("Telefone incompleto. Inclua o DDD.");
      } else if (error.message.includes("SO_O_ORGANIZADOR")) {
        setErro("Só quem criou a sessão pode convidar.");
      } else {
        setErro("Não conseguimos convidar. Tente de novo.");
      }
      return;
    }

    posthog.capture("convite_por_telefone", { ja_tinha_conta: data === "ja_tem_conta" });

    if (data === "ja_tem_conta") {
      // O número já estava no app: virou convite normal, e a pessoa vai ver
      // dentro do app. Não faz sentido mandar link de cadastro.
      setErro(null);
      setNome("");
      setTelefone("");
      setAberto(false);
      router.refresh();
      return;
    }

    setConvidado({ nome: nome.trim(), tel: telefone });
    setNome("");
    setTelefone("");
    router.refresh();
  }

  if (convidado) {
    const link = `${window.location.origin}/entrar`;
    const texto =
      `Oi${convidado.nome ? " " + convidado.nome.split(" ")[0] : ""}! ` +
      `Te convidei para jogar padel: ${nomeDoJogo}. ` +
      `Baixe o app, crie sua conta com este mesmo número e o convite vai estar te esperando: ${link}`;
    const zap = `https://wa.me/55${convidado.tel.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;

    return (
      <div className="mt-3 rounded-xl bg-primaria/5 p-4 ring-1 ring-primaria/20">
        <p className="font-display text-sm font-bold text-tinta">
          Convite guardado para {convidado.tel}
        </p>
        <p className="mt-1 text-xs text-tinta-suave">
          Ela ainda não está no app, então <strong>você</strong> precisa
          avisar. Assim que criar a conta com este número, o convite aparece
          para ela sozinho.
        </p>
        <a
          href={zap}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog.capture("convite_whatsapp_enviado")}
          className="mt-3 inline-block rounded-full bg-primaria px-4 py-2 text-sm font-bold text-white"
        >
          💬 Mandar no WhatsApp
        </a>
        <button
          type="button"
          onClick={() => setConvidado(null)}
          className="ml-3 text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          Convidar outro
        </button>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 text-sm font-bold text-primaria hover:underline"
      >
        + Convidar alguém que ainda não usa o app
      </button>
    );
  }

  const podeConvidar = telefone.replace(/\D/g, "").length >= 10 && !ocupado;

  return (
    <div className="mt-3 rounded-xl bg-fundo p-4 ring-1 ring-black/10">
      <p className="font-display text-sm font-bold text-tinta">
        Convidar pelo telefone
      </p>

      {temAgenda && (
        <button
          type="button"
          onClick={escolherDaAgenda}
          className="mt-2 text-sm font-bold text-primaria hover:underline"
        >
          📇 Escolher da minha agenda
        </button>
      )}

      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome (opcional, para você reconhecer)"
        className="mt-2 w-full rounded-xl border-0 bg-superficie px-4 py-3 text-tinta ring-1 ring-black/10 focus:ring-2 focus:ring-primaria"
      />
      <input
        type="tel"
        inputMode="numeric"
        value={telefone}
        onChange={(e) => setTelefone(mascara(e.target.value))}
        placeholder="(51) 99999-8888"
        className="mt-2 w-full rounded-xl border-0 bg-superficie px-4 py-3 text-tinta ring-1 ring-black/10 focus:ring-2 focus:ring-primaria"
      />

      {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!podeConvidar}
          onClick={convidar}
          className="rounded-full bg-primaria px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {ocupado ? "Convidando..." : "Convidar"}
        </button>
        <button
          type="button"
          onClick={() => { setAberto(false); setErro(null); }}
          className="text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
