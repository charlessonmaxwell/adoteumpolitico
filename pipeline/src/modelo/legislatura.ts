/**
 * Calendário das legislaturas (story 9.2). Cada uma dura 4 anos, de 1º de fevereiro
 * a 31 de janeiro: a 57ª vai de 01/02/2023 a 31/01/2027; a 58ª começa em 01/02/2027.
 */
const ANO_BASE = 1795; // 1795 + 4 × 57 = 2023

export const anoInicioLegislatura = (n: number) => ANO_BASE + 4 * n;
export const inicioLegislatura = (n: number) => `${anoInicioLegislatura(n)}-02-01`;
export const fimLegislatura = (n: number) => `${anoInicioLegislatura(n) + 4}-01-31`;

/** Legislatura em curso numa data (a nova começa em 1º de fevereiro). */
export function legislaturaNaData(d: Date = new Date()): number {
  const iso = d.toISOString().slice(0, 10);
  const n = Math.floor((d.getUTCFullYear() - ANO_BASE) / 4);
  return iso >= inicioLegislatura(n) ? n : n - 1;
}

/** Legislatura vigente segundo a fonte: a dos deputados (todos eleitos na mesma). */
export function legislaturaVigente(p: { casa: string; idLegislatura: number }[]): number {
  const deputados = p.filter((x) => x.casa === "camara").map((x) => x.idLegislatura);
  return deputados.length ? Math.max(...deputados) : Math.max(...p.map((x) => x.idLegislatura));
}
