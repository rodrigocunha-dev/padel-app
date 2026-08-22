import type { Metadata } from "next";
import Link from "next/link";
import { VERSAO_POLITICA } from "@/lib/politica";

export const metadata: Metadata = {
  title: "Política de privacidade — padel",
};

// ⚠️ TEXTO PROVISÓRIO, e o aviso no topo da página diz isso ao usuário.
//
// O documento final depende de duas coisas que não são minhas: o nome da
// marca (ainda entre FaltaUm e Fechou) e revisão jurídica. O que está aqui
// descreve com honestidade o que o app FAZ hoje — serve para a pessoa saber
// no que está entrando, e serve de rascunho para o advogado.
//
// Ao publicar o texto de verdade, trocar `VERSAO_POLITICA` de "rascunho-1"
// para "1.0": é isso que faz o app pedir o aceite de novo a quem só viu esta
// versão.
export default function PaginaPolitica() {
  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-10">
      <article className="mx-auto w-full max-w-2xl">
        {/* Esta página fica FORA do /app, então não tem a barra de baixo —
            sem este link ela era um beco sem saída, que foi o que o fundador
            encontrou no teste. */}
        <Link
          href="/app/perfil/privacidade"
          className="text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          ← Voltar
        </Link>

        <h1 className="mt-4 font-display text-3xl font-extrabold text-tinta">
          Política de privacidade
        </h1>

        <p className="mt-3 rounded-2xl bg-amber-100 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <strong>Versão provisória.</strong> Este texto ainda vai passar por
          revisão jurídica antes do lançamento. Ele descreve, em português
          simples, o que o aplicativo faz com seus dados hoje.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-tinta">
          <section>
            <h2 className="font-display text-lg font-bold">
              O que guardamos sobre você
            </h2>
            <p className="mt-2 text-tinta-suave">
              Seu telefone (é como você entra no app), nome, foto, cidade e as
              preferências que você informa: lado que joga, dias e turnos em
              que costuma jogar e distância que aceita viajar. Guardamos também
              seus jogos, reservas, pagamentos e a sua categoria.
            </p>
            <p className="mt-2 text-tinta-suave">
              Se você preencher os dados para nota fiscal — nome completo, CPF,
              e-mail e endereço —, guardamos também. Nada disso é obrigatório.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold">
              Quem enxerga o quê
            </h2>
            <p className="mt-2 text-tinta-suave">
              Outros jogadores veem seu nome, sua foto e sua categoria. Não
              veem seu telefone, seu CPF nem seu endereço.
            </p>
            <p className="mt-2 text-tinta-suave">
              Quem organiza uma partida recebe o contato de quem confirmou
              presença, para conseguir combinar o jogo e acertar o pagamento.
            </p>
            <p className="mt-2 text-tinta-suave">
              O clube onde você reserva recebe seu nome e telefone, como
              aconteceria se você tivesse ligado para reservar.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold">
              Seus jogos e sua categoria
            </h2>
            <p className="mt-2 text-tinta-suave">
              O resultado de um jogo pertence também aos outros jogadores: a
              categoria de cada um é calculada a partir dos jogos de todos. Por
              isso os jogos ficam registrados mesmo se você sair do app — sem o
              seu nome.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold">Seus direitos</h2>
            <p className="mt-2 text-tinta-suave">
              A qualquer momento você pode baixar tudo que guardamos sobre
              você, ou apagar sua conta. Está em Perfil → Seus dados.
            </p>
            <p className="mt-2 text-tinta-suave">
              Ao apagar a conta, seu nome, foto, telefone e demais dados
              pessoais são removidos. Ficam apenas os registros que a lei manda
              guardar (as reservas e pagamentos feitos no clube) e os jogos,
              sem sua identidade.
            </p>
            <p className="mt-2 text-tinta-suave">
              Se você tiver um jogo com pagamento em aberto, é preciso acertar
              antes de apagar a conta.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold">Notificações</h2>
            <p className="mt-2 text-tinta-suave">
              Se você autorizar, mandamos avisos sobre seus jogos — resultado
              registrado, votação aberta, vaga liberada. Você pode desligar a
              qualquer momento nos ajustes do seu celular.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold">Falar com a gente</h2>
            <p className="mt-2 text-tinta-suave">
              Dúvida sobre privacidade ou pedido sobre seus dados: [DEFINIR]
            </p>
          </section>
        </div>

        <p className="mt-10 text-xs text-tinta-suave">
          Versão do documento: {VERSAO_POLITICA}
        </p>
      </article>
    </main>
  );
}
