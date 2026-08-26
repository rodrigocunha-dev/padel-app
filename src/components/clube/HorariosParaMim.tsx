"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { criarClienteNavegador } from "@/lib/supabase/client";

type Horario = {
  quadra_id: string;
  quadra: string;
  esporte: string;
  coberta: boolean;
  inicio: string;
  fim: string;
};

// O dia e a hora que a pessoa VE na tela — no fuso dela, nao no do servidor.
// Mandar o horario cru levaria a reserva para outro dia quando o jogo fosse
// de noite.
function diaISO(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function horaLocal(iso: string): number {
  return new Date(iso).getHours();
}

function quando(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    }) +
    " · " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

// Os horários que o clube anunciou E que combinam com a disponibilidade
// DESTA pessoa. Quem decide o recorte é o servidor (`horarios_para_mim`) —
// a tela não filtra nada por conta própria, senão a regra teria duas versões.
export function HorariosParaMim({ clubeId }: { clubeId: string }) {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = criarClienteNavegador();

      // A campanha vem pelo aviso: se a pessoa não recebeu, não há o que
      // mostrar. É a mesma trava que o servidor aplica.
      const { data: aviso } = await supabase
        .from("avisos")
        .select("promocao_id")
        .eq("clube_id", clubeId)
        .eq("tipo", "horarios_livres")
        .not("promocao_id", "is", null)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!aviso?.promocao_id) {
        setCarregando(false);
        return;
      }

      const { data } = await supabase.rpc("horarios_para_mim", {
        p_promocao_id: aviso.promocao_id,
      });
      setHorarios((data as Horario[]) ?? []);
      setCarregando(false);
    })();
  }, [clubeId]);

  if (carregando || horarios.length === 0) return null;

  return (
    <section className="mt-4 rounded-2xl bg-destaque p-5 shadow-lg">
      <p className="font-display text-base font-bold text-destaque-tinta">
        📣 Horários livres para você
      </p>
      <p className="mt-1 text-xs text-destaque-tinta/80">
        Escolhidos pelos dias e turnos que você marcou no seu perfil.
      </p>

      <ul className="mt-3 space-y-2">
        {horarios.map((h) => (
          <li key={`${h.quadra}-${h.inicio}`}>
            <Link
              // Leva a quadra, o dia e a hora ANUNCIADOS. Sem eles a tela
              // abria em hoje e na primeira quadra, e a pessoa tinha de
              // procurar de novo o horario que o aviso acabara de mostrar.
              href={`/app/clubes/${clubeId}/reservar?quadra=${h.quadra_id}&dia=${diaISO(h.inicio)}&hora=${horaLocal(h.inicio)}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2.5 transition hover:bg-white"
            >
              <span className="text-sm font-medium text-destaque-tinta">
                {quando(h.inicio)}
              </span>
              <span className="text-xs text-destaque-tinta/70">
                {h.quadra}
                {h.coberta ? " · coberta" : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
