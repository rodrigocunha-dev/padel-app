import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { criarClienteServidor } from "@/lib/supabase/server";

// ============================================================
// /api/push/enviar — varre os avisos pendentes e dispara as notificações
// ============================================================
// Esta rota não recebe "para quem enviar": ela pergunta ao banco quais
// avisos ainda não viraram push e manda esses. Isso a torna **idempotente**
// — chamar duas vezes seguidas não envia nada na segunda, porque a primeira
// já marcou. É o que permite chamá-la de vários lugares sem medo.
//
// Quem chama, hoje: o próprio app, logo depois de registrar um set,
// contestar ou avisar a votação. Amanhã, um agendamento pode chamar a mesma
// rota sem mudar nada aqui.
//
// ⚠️ Qualquer pessoa logada pode disparar a varredura, e isso é seguro de
// propósito: a rota não devolve dado nenhum de terceiros e só envia o que
// já estava pendente. Chamar mil vezes não gera mil notificações.

export const runtime = "nodejs"; // web-push usa crypto do Node, não roda no Edge

type Pendente = {
  aviso_id: string;
  inscricao_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  titulo: string;
  corpo: string;
  url: string;
  tag: string;
};

// Comparação em tempo constante: comparar segredo com `===` vaza, pelo
// tempo de resposta, quantos caracteres iniciais estavam certos.
function segredoConfere(recebido: string | null, esperado: string | undefined) {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  // Dois caminhos de entrada. O primeiro é o banco, que dispara sozinho
  // quando um aviso nasce (gatilho) e a cada 15 min (varredura) — ele não
  // tem sessão de usuário, então se identifica por um segredo.
  const peloBanco = segredoConfere(
    request.headers.get("x-push-secret"),
    process.env.PUSH_SECRET
  );

  if (!peloBanco) {
    // O segundo é o próprio app, logo depois de uma ação que gera aviso.
    // A sessão existe só para a rota não ficar aberta à internet inteira.
    const supabase = await criarClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }
  }

  const chavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const chavePrivada = process.env.VAPID_PRIVATE_KEY;
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Sem as chaves o push simplesmente não acontece — e isso NÃO é erro do
  // usuário. Devolve 200 com um aviso, para o app não mostrar falha por
  // algo que é configuração do servidor.
  if (!chavePublica || !chavePrivada || !servico) {
    return NextResponse.json({ enviados: 0, configurado: false });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contato@padel.app",
    chavePublica,
    chavePrivada
  );

  // Cliente de serviço: `push_pendentes` cruza avisos e inscrições de VÁRIAS
  // pessoas, o que nenhum jogador pode fazer. Por isso a função está
  // revogada do lado do app e só é alcançável por aqui.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    servico,
    { auth: { persistSession: false } }
  );

  const { data, error } = await admin.rpc("push_pendentes", { p_limite: 200 });
  if (error) {
    console.error("Erro lendo pendentes de push:", error.message);
    return NextResponse.json({ erro: "falha ao ler pendentes" }, { status: 500 });
  }

  const pendentes = (data ?? []) as Pendente[];
  if (pendentes.length === 0) {
    return NextResponse.json({ enviados: 0, configurado: true });
  }

  const enviados: string[] = [];
  const mortas: string[] = [];

  await Promise.all(
    pendentes.map(async (p) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: p.endpoint,
            keys: { p256dh: p.p256dh, auth: p.auth },
          },
          JSON.stringify({
            titulo: p.titulo,
            corpo: p.corpo,
            url: p.url,
            tag: p.tag,
          })
        );
        enviados.push(p.aviso_id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = o navegador desfez a inscrição (app desinstalado,
        // permissão revogada). Não é falha nossa: é para parar de tentar.
        if (status === 404 || status === 410) {
          mortas.push(p.inscricao_id);
        } else {
          console.error("Falha ao enviar push:", status, (e as Error).message);
        }
      }
    })
  );

  if (enviados.length > 0) {
    await admin.rpc("push_marcar_enviados", { p_avisos: enviados });
  }
  if (mortas.length > 0) {
    await admin.rpc("push_invalidar", { p_inscricoes: mortas });
  }

  return NextResponse.json({
    enviados: enviados.length,
    inscricoes_invalidadas: mortas.length,
    configurado: true,
  });
}
