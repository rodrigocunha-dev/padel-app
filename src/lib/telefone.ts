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
