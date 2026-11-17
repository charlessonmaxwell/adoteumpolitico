/**
 * Busca no navegador (story 2.1). Tolera erro de digitação, acento e nome parcial.
 * Também encontra por UF ("se", "sergipe") e partido ("pp").
 */
export interface ItemBusca {
  id: string;
  nome: string;
  partido: string;
  uf: string;
  estado: string;
  casa: "camara" | "senado";
  foto: string | null;
}

export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Distância de edição (Damerau–Levenshtein restrita) com corte antecipado. */
export function distancia(a: string, b: string, limite: number): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let menor = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      menor = Math.min(menor, v);
    }
    if (menor > limite) return limite + 1;
  }
  return d[a.length]![b.length]!;
}

/** Aproxima grafias que soam igual (Favacho/Favaxo, Thiago/Tiago, Sousa/Souza). */
export const fonetica = (s: string) =>
  s
    .replace(/ch/g, "x")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/y/g, "i")
    .replace(/ss/g, "s")
    .replace(/z/g, "s")
    .replace(/([a-z])\1/g, "$1");

const tolerancia = (termo: string) => (termo.length <= 3 ? 0 : termo.length <= 6 ? 1 : 2);

/** Pontua uma palavra digitada contra as palavras do nome. Menor = melhor; null = não casa. */
function pontuarTermo(termo: string, palavras: string[]): number | null {
  let melhor: number | null = null;
  for (const p of palavras) {
    let s: number | null = null;
    if (p === termo) s = 0;
    else if (p.startsWith(termo)) s = 1;
    else {
      // Compara também com o começo da palavra (o usuário ainda está digitando)
      const lim = tolerancia(termo);
      const dist = Math.min(
        distancia(termo, p, lim),
        distancia(termo, p.slice(0, termo.length), lim),
      );
      if (dist <= lim) s = 2 + dist;
    }
    if (s !== null && (melhor === null || s < melhor)) melhor = s;
  }
  return melhor;
}

export function buscar(itens: ItemBusca[], consulta: string, limite = 12): ItemBusca[] {
  const q = normalizar(consulta);
  if (!q) return [];
  const termos = q.split(" ");
  const termosFoneticos = termos.map(fonetica);
  const resultados: { item: ItemBusca; pontos: number }[] = [];
  for (const item of itens) {
    const palavras = normalizar(item.nome).split(" ").map(fonetica);
    const uf = item.uf.toLowerCase();
    const estado = normalizar(item.estado);
    const partido = normalizar(item.partido);
    let total = 0;
    let ok = true;
    for (const [k, t] of termos.entries()) {
      let s = pontuarTermo(termosFoneticos[k]!, palavras);
      if (t === uf || t === partido || (t.length >= 4 && estado.startsWith(t)))
        s = Math.min(s ?? 1, 1);
      else if (t.length >= 4 && estado.split(" ").some((e) => e.startsWith(t)))
        s = Math.min(s ?? 1, 1);
      if (s === null) {
        ok = false;
        break;
      }
      total += s;
    }
    if (ok) resultados.push({ item, pontos: total });
  }
  return resultados
    .sort((a, b) => a.pontos - b.pontos || a.item.nome.localeCompare(b.item.nome, "pt-BR"))
    .slice(0, limite)
    .map((r) => r.item);
}

/** Projeto votado no índice da busca (título + resumo curto). */
export interface ProjetoBusca {
  id: string;
  titulo: string;
  ementa: string;
  casa: "camara" | "senado";
}

/** Estados batem pelo nome ou pela sigla ("ce", "ceara", "rio gra"). */
export function buscarEstados(
  ufs: Record<string, string>,
  consulta: string,
): { uf: string; estado: string }[] {
  const q = normalizar(consulta);
  if (!q) return [];
  return Object.entries(ufs)
    .filter(([uf, estado]) => {
      const n = normalizar(estado);
      return (
        q === uf.toLowerCase() ||
        (q.length >= 3 &&
          (n.startsWith(q) ||
            Math.min(
              distancia(q, n, tolerancia(q)),
              distancia(q, n.slice(0, q.length), tolerancia(q)),
            ) <= tolerancia(q)))
      );
    })
    .map(([uf, estado]) => ({ uf, estado }))
    .slice(0, 3);
}

const PALAVRAS_VAZIAS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "as",
  "os",
  "em",
  "no",
  "na",
  "para",
  "por",
  "com",
]);

/** Projetos: número ("pl 186", "186/2026") ou palavras do assunto ("cartao credito"). */
export function buscarProjetos(
  itens: ProjetoBusca[],
  consulta: string,
  limite = 5,
): ProjetoBusca[] {
  const termos = normalizar(consulta)
    .split(" ")
    .filter((t) => t && !PALAVRAS_VAZIAS.has(t));
  if (!termos.length || (termos.length === 1 && termos[0]!.length < 3 && !/\d/.test(termos[0]!)))
    return [];
  const resultados: { item: ProjetoBusca; pontos: number }[] = [];
  for (const item of itens) {
    const titulo = normalizar(item.titulo).split(" ");
    const palavras = [...titulo, ...normalizar(item.ementa).split(" ")];
    let total = 0;
    let ok = true;
    for (const t of termos) {
      const s = /\d/.test(t) ? (titulo.includes(t) ? 0 : null) : pontuarTermo(t, palavras);
      if (s === null) {
        ok = false;
        break;
      }
      total += s;
    }
    if (ok) resultados.push({ item, pontos: total });
  }
  return resultados
    .sort((a, b) => a.pontos - b.pontos)
    .slice(0, limite)
    .map((r) => r.item);
}
