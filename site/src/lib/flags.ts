/**
 * Chaves liga/desliga do site (feature toggles).
 * O site é estático: a chave é lida na hora de gerar o site. Mudou a chave → publique de novo.
 */

/** Interpreta o valor da variável: só liga com "true", "1", "sim" ou "ligado". Vazio ou qualquer outra coisa = desligado. */
export function ligado(valor: string | undefined | null): boolean {
  return ["true", "1", "sim", "ligado", "on"].includes((valor ?? "").trim().toLowerCase());
}
