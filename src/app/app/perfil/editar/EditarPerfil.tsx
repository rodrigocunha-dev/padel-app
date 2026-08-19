"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import posthog from "posthog-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import {
  DIAS,
  TURNOS,
  RAIOS,
  POSICOES,
  paraLista,
  type DisponibilidadeMapa,
} from "@/lib/perfil-campos";

type Props = {
  usuarioId: string;
  inicial: {
    nome: string;
    fotoUrl: string | null;
    cidade: string;
    posicao: string | null;
    raioKm: number;
    disponibilidade: DisponibilidadeMapa;
  };
};

// ⚠️ Categoria NÃO é editável aqui, de propósito. Ela é do motor de rating
// desde o script 027: se a pessoa pudesse escolher a própria categoria, o
// matchmaking passaria a valer o que cada um digita, e o rating perderia a
// função. O que ela muda é a calibração inicial — e essa já foi respondida.
export function EditarPerfil({ usuarioId, inicial }: Props) {
  const router = useRouter();

  const [nome, setNome] = useState(inicial.nome);
  const [cidade, setCidade] = useState(inicial.cidade);
  const [posicao, setPosicao] = useState(inicial.posicao ?? "ambas");
  const [raioKm, setRaioKm] = useState(inicial.raioKm);
  const [disp, setDisp] = useState<DisponibilidadeMapa>(inicial.disponibilidade);
  const [foto, setFoto] = useState<File | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function alternarTurno(dia: string, turno: string) {
    setDisp((atual) => {
      const turnos = atual[dia] ?? [];
      const novos = turnos.includes(turno)
        ? turnos.filter((t) => t !== turno)
        : [...turnos, turno];
      const copia = { ...atual };
      if (novos.length === 0) delete copia[dia];
      else copia[dia] = novos;
      return copia;
    });
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSalvo(false);

    const supabase = criarClienteNavegador();

    try {
      let fotoUrl = inicial.fotoUrl;

      if (foto) {
        const caminho = `${usuarioId}/perfil-${Date.now()}.jpg`;
        const { error: erroUpload } = await supabase.storage
          .from("fotos")
          .upload(caminho, foto);
        if (erroUpload) throw new Error("Não conseguimos enviar a foto.");
        fotoUrl = supabase.storage.from("fotos").getPublicUrl(caminho)
          .data.publicUrl;
      }

      const { error } = await supabase
        .from("jogadores")
        .update({
          nome: nome.trim(),
          cidade: cidade.trim(),
          posicao,
          raio_km: raioKm,
          disponibilidade: paraLista(disp),
          foto_url: fotoUrl,
        })
        .eq("id", usuarioId);

      if (error) throw new Error("Não conseguimos salvar agora.");

      posthog.capture("perfil_editado", { trocou_foto: !!foto });
      setSalvo(true);
      setFoto(null);
      // A barra de navegação mostra nome e foto: sem isto ela continuaria
      // com os valores antigos até a próxima navegação completa.
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não conseguimos salvar agora.");
    } finally {
      setSalvando(false);
    }
  }

  const podeSalvar =
    nome.trim().length >= 2 && cidade.trim().length >= 2 && !salvando;

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
        <label className="block text-sm font-medium text-tinta">
          Seu nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-xl border border-black/10 px-4 py-3 text-tinta outline-none focus:border-primaria"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-tinta">
          Sua cidade
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="mt-1 w-full rounded-xl border border-black/10 px-4 py-3 text-tinta outline-none focus:border-primaria"
          />
        </label>

        <div className="mt-4">
          <p className="text-sm font-medium text-tinta">Sua foto</p>
          <label className="mt-1 block cursor-pointer rounded-xl border border-dashed border-black/20 px-4 py-3 text-sm text-tinta-suave">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
            {foto
              ? foto.name
              : inicial.fotoUrl
                ? "Trocar foto"
                : "Escolher foto da galeria"}
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
        <p className="text-sm font-medium text-tinta">Lado que você joga</p>
        <div className="mt-2 flex gap-2">
          {POSICOES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPosicao(p.id)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
                posicao === p.id
                  ? "bg-primaria text-white"
                  : "bg-fundo text-tinta-suave"
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5">
        <p className="text-sm font-medium text-tinta">Quando você costuma jogar</p>
        <div className="mt-3 space-y-2">
          {DIAS.map((d) => (
            <div key={d.id} className="flex items-center gap-2">
              <span className="w-10 text-xs font-bold text-tinta-suave">
                {d.rotulo}
              </span>
              {TURNOS.map((t) => {
                const ativo = (disp[d.id] ?? []).includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => alternarTurno(d.id, t.id)}
                    className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${
                      ativo
                        ? "bg-primaria text-white"
                        : "bg-fundo text-tinta-suave"
                    }`}
                  >
                    {t.rotulo}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <p className="mt-5 text-sm font-medium text-tinta">
          Distância que você aceita viajar
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {RAIOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRaioKm(r)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                raioKm === r
                  ? "bg-primaria text-white"
                  : "bg-fundo text-tinta-suave"
              }`}
            >
              {r} km
            </button>
          ))}
        </div>
      </section>

      {/* Telefone tem tela própria: mudar o número exige confirmar o novo por
          código, senão qualquer um digitaria qualquer coisa. */}
      <Link
        href="/app/perfil/telefone"
        className="block rounded-2xl bg-superficie p-5 shadow-lg ring-1 ring-black/5 transition hover:ring-primaria/40"
      >
        <p className="font-display text-base font-bold text-tinta">
          📱 Trocar meu telefone
        </p>
        <p className="mt-1 text-sm text-tinta-suave">
          É o número que você usa para entrar no app
        </p>
      </Link>

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
        disabled={!podeSalvar}
        onClick={salvar}
        className="w-full rounded-2xl bg-primaria px-5 py-4 font-display font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
      >
        {salvando ? "Salvando…" : "Salvar alterações"}
      </button>
    </div>
  );
}
