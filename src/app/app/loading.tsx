// O que aparece ENQUANTO a tela carrega, em vez de nada.
//
// Sem este arquivo, o Next.js só manda a página quando toda a busca no banco
// termina — e até lá o celular mostra uma tela vazia (branca ou preta, conforme
// o tema do aparelho). Com ele, o desenho da tela vai embora na hora e o
// conteúdo entra por cima quando fica pronto.
//
// Isso não deixa o app mais rápido; deixa a espera VISÍVEL, que é o que
// incomodava. Serve para /app e para todas as telas dentro dela.
export default function Carregando() {
  return (
    <main className="flex min-h-full flex-1 flex-col bg-fundo px-6 py-10">
      <div className="mx-auto w-full max-w-md animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-black/10" />
          <div className="h-6 w-40 rounded-lg bg-black/10" />
        </div>

        <div className="mt-6 h-28 rounded-2xl bg-superficie shadow-lg ring-1 ring-black/5" />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl bg-black/10" />
          <div className="h-24 rounded-2xl bg-superficie shadow-lg ring-1 ring-black/5" />
        </div>

        <div className="mt-8 space-y-3">
          <div className="h-6 w-44 rounded-lg bg-black/10" />
          <div className="h-24 rounded-2xl bg-superficie shadow-lg ring-1 ring-black/5" />
          <div className="h-24 rounded-2xl bg-superficie shadow-lg ring-1 ring-black/5" />
        </div>
      </div>
    </main>
  );
}
