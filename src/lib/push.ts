// Pede ao servidor que varra os avisos pendentes e mande as notificações.
//
// Chamado logo depois das ações que CRIAM aviso (registrar set, contestar,
// avisar votação). Não espera resposta e nunca quebra a tela: se o push
// falhar, o aviso dentro do app continua lá — ele é o caminho principal, o
// push é o alcance extra.
//
// A rota é idempotente (marca o que enviou), então chamar demais não gera
// notificação repetida.
export function dispararPush(): void {
  void fetch("/api/push/enviar", { method: "POST" }).catch(() => {
    // Silêncio de propósito: o usuário acabou de registrar um set com
    // sucesso, e um erro de notificação não pode virar erro na cara dele.
  });
}
