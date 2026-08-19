// Máscara de telefone brasileiro enquanto digita: (51) 99999-8888
// Aceita fixo (10 dígitos) e celular (11 dígitos).
export function mascararTelefoneBr(bruto: string): string {
  const d = bruto.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Converte "(51) 99999-8888" para o formato internacional "+5551999998888",
// que é o que o login espera. Devolve null quando o número não fecha.
//
// Estava dentro do LoginOtp. Saiu para cá quando a troca de telefone nasceu:
// as duas telas mandam número para o mesmo lugar, e ter duas cópias dessa
// conversão é como um dia elas passam a aceitar coisas diferentes.
export function paraFormatoInternacional(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`;
  if (
    (digitos.length === 12 || digitos.length === 13) &&
    digitos.startsWith("55")
  )
    return `+${digitos}`;
  return null;
}
