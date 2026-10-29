const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("pt-BR");

export const formatarNumero = (n: number) => num.format(n);

/** R$ 1,77 milhão · R$ 358 mil · R$ 950 */
export function formatarMoedaCurta(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) {
    const m = (v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    return `R$ ${m} ${a >= 2_000_000 ? "milhões" : "milhão"}`;
  }
  if (a >= 1_000) return `R$ ${Math.round(v / 1_000).toLocaleString("pt-BR")} mil`;
  return moeda.format(v);
}

export const formatarMoeda = (v: number) => moeda.format(v);

export const formatarPct = (parte: number, total: number) =>
  total ? `${Math.round((parte / total) * 100)}%` : "0%";

/** "DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR." → "Divulgação da atividade parlamentar" */
export function humanizarCategoria(c: string): string {
  const s = c
    .trim()
    .replace(/\.$/, "")
    .replace(/\s*-\s*SIGEPA$/i, "")
    .replace(/,? compreendendo .*$/i, "");
  const base = s === s.toUpperCase() ? s.toLowerCase() : s;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Plural simples: plural(1, "sessão", "sessões") */
export const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export const dataBr = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export const UFS: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

/** Preposição correta: "pelo Ceará", "pela Bahia", "por Sergipe" */
const PREP: Record<string, string> = {
  AC: "pelo",
  AL: "por",
  AP: "pelo",
  AM: "pelo",
  BA: "pela",
  CE: "pelo",
  DF: "pelo",
  ES: "pelo",
  GO: "por",
  MA: "pelo",
  MT: "por",
  MS: "por",
  MG: "por",
  PA: "pelo",
  PB: "pela",
  PR: "pelo",
  PE: "por",
  PI: "pelo",
  RJ: "pelo",
  RN: "pelo",
  RS: "pelo",
  RO: "por",
  RR: "por",
  SC: "por",
  SP: "por",
  SE: "por",
  TO: "pelo",
};
export const pelaUf = (uf: string) => `${PREP[uf] ?? "por"} ${UFS[uf] ?? uf}`;
