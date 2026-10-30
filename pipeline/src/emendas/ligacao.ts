import type { Emenda } from "../modelo/emenda.js";
import type { Parlamentar } from "../modelo/parlamentar.js";

/** Nome comparável: sem acento, minúsculo, sem tratamento ("Dep.", "Senador"). */
export const nomeComparavel = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(dep|deputad[oa]|sen|senador[a]?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Nome de quem indicou. "FULANO (EX-PARLAMENTAR BELTRANO, NOS TERMOS ART. 78 LDO…)" é emenda de Beltrano
 * repassada ao sucessor: o autor é Beltrano. Outros parênteses são descartados.
 */
export function autorReal(texto: string): string {
  const ex = /\(\s*EX-PARLAMENTAR\s+([^,)]+)/i.exec(texto);
  return (ex ? ex[1]! : texto.replace(/\(.*$/, "")).trim();
}

/** De/para revisado à mão: código do autor na CGU → id do parlamentar (null = não é parlamentar atual). */
export type DePara = Record<string, string | null>;

export interface ResultadoLigacao {
  emendas: Emenda[];
  qualidade: {
    individuais: number;
    individuaisLigadas: number;
    valorIndividual: number;
    valorLigado: number;
    /** Valor com autor conhecido: parlamentar atual OU ex-parlamentar das legislaturas recentes. */
    valorConhecido: number;
    exParlamentares: number;
    parlamentaresComEmenda: number;
    /** Autores que não são nem atuais nem ex conhecidos: estes contam contra a regra dos 99%. */
    naoLigados: { codigoAutor: string; nome: string; emendas: number; empenhado: number }[];
  };
}

/** Ex-parlamentar conhecido (legislaturas recentes) — aparece com a tarja "ex-parlamentar". */
export interface MembroConhecido {
  id: string;
  nome: string;
}

/**
 * Liga só emendas individuais (bancada/comissão são coletivas e nunca entram no total de uma pessoa).
 * Ordem: de/para manual → nome único entre os atuais → nome único entre os ex. Na dúvida, não liga.
 * Atual → idParlamentar; ex → exParlamentar (sem perfil, mas com nome e tarja no site).
 */
export function ligarAutores(
  emendas: Emenda[],
  parlamentares: Parlamentar[],
  depara: DePara = {},
  membros: MembroConhecido[] = [],
): ResultadoLigacao {
  const indexar = (l: MembroConhecido[]) => {
    const m = new Map<string, string[]>();
    for (const p of l) {
      const k = nomeComparavel(p.nome);
      const ids = m.get(k) ?? [];
      if (!ids.includes(p.id)) ids.push(p.id);
      m.set(k, ids);
    }
    return m;
  };
  const atuais = new Set(parlamentares.map((p) => p.id));
  // Nome de qualquer época (inclui nome de urna antigo de quem ainda está no cargo, ex.: "Yury do Paredão" → "Yury Bruno")
  const porNome = indexar([...parlamentares, ...membros]);
  const nomeEx = new Map(membros.filter((m) => !atuais.has(m.id)).map((m) => [m.id, m.nome]));
  /** Entre candidatos com o mesmo nome: um atual único vence; se só houver ex (mesma pessoa nas duas casas), qualquer um serve. */
  const escolher = (ids: string[]): string | null => {
    const a = ids.filter((id) => atuais.has(id));
    if (a.length === 1) return a[0]!;
    if (a.length > 1) return null;
    const x = ids.filter((id) => nomeEx.has(id)).sort();
    const nomes = new Set(x.map((id) => nomeComparavel(nomeEx.get(id)!)));
    return x.length && nomes.size === 1 ? x[0]! : null;
  };
  const naoLigados = new Map<string, ResultadoLigacao["qualidade"]["naoLigados"][number]>();
  const exVistos = new Set<string>();
  let individuais = 0,
    ligadas = 0,
    valorIndividual = 0,
    valorLigado = 0,
    valorConhecido = 0;

  const saida = emendas.map((e): Emenda => {
    if (e.tipo !== "individual") return { ...e, idParlamentar: null };
    individuais++;
    valorIndividual += e.valores.empenhado;
    let id: string | null = null;
    if (e.codigoAutor in depara) id = depara[e.codigoAutor] ?? null;
    else id = escolher(porNome.get(nomeComparavel(autorReal(e.autorTexto))) ?? []);
    if (id && atuais.has(id)) {
      ligadas++;
      valorLigado += e.valores.empenhado;
      valorConhecido += e.valores.empenhado;
      return { ...e, idParlamentar: id };
    }
    if (id && nomeEx.has(id)) {
      valorConhecido += e.valores.empenhado;
      exVistos.add(id);
      return { ...e, idParlamentar: null, exParlamentar: { id, nome: nomeEx.get(id)! } };
    }
    if (!(e.codigoAutor in depara)) {
      const n = naoLigados.get(e.codigoAutor) ?? {
        codigoAutor: e.codigoAutor,
        nome: e.autorTexto,
        emendas: 0,
        empenhado: 0,
      };
      n.emendas++;
      n.empenhado = Math.round((n.empenhado + e.valores.empenhado) * 100) / 100;
      naoLigados.set(e.codigoAutor, n);
    } else valorConhecido += e.valores.empenhado; // marcado à mão como não-parlamentar: revisado
    return { ...e, idParlamentar: null };
  });

  return {
    emendas: saida,
    qualidade: {
      individuais,
      individuaisLigadas: ligadas,
      valorIndividual: Math.round(valorIndividual * 100) / 100,
      valorLigado: Math.round(valorLigado * 100) / 100,
      valorConhecido: Math.round(valorConhecido * 100) / 100,
      exParlamentares: exVistos.size,
      parlamentaresComEmenda: new Set(saida.map((e) => e.idParlamentar).filter(Boolean)).size,
      naoLigados: [...naoLigados.values()].sort((a, b) => b.empenhado - a.empenhado),
    },
  };
}
