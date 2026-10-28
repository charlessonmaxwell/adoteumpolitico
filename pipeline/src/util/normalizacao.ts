/** Mantém só dígitos. */
export const digitos = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

/** Devolve o CNPJ (14 dígitos) ou null. CPF (11 dígitos) é dado pessoal e é descartado. */
export function somenteCnpj(v: unknown): string | null {
  const d = digitos(v);
  return d.length === 14 ? d : null;
}

/** Aceita número ou texto nos formatos "1234.56" e "1.234,56". */
export function paraValor(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converte "2026-01-05", "2026-01-05T00:00:00" ou "05/01/2026" em "AAAA-MM-DD".
 * Retorna null se vazio e "invalida" se não for uma data de calendário real.
 */
export function paraData(v: unknown): string | null | "invalida" {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  let [a, me, d] = m ? [m[1], m[2], m[3]] : [];
  if (!m) {
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!m) return "invalida";
    [d, me, a] = [m[1], m[2], m[3]];
  }
  const iso = `${a}-${me}-${d}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().startsWith(iso) ? iso : "invalida";
}

/** Remove CPF escrito em texto livre (ex.: nome de fornecedor "FULANO - 123.456.789-00"). */
export function semCpf(texto: unknown): string {
  return String(texto ?? "")
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, "")
    .replace(/[\s\-–:]+$/, "")
    .trim();
}
