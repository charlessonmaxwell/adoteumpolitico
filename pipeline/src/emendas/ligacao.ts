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

/** De/para revisado à mão: código do autor na CGU → id do parlamentar (null = não é parlamentar atual). */
export type DePara = Record<string, string | null>;

export interface ResultadoLigacao {
  emendas: Emenda[];
  qualidade: {
    individuais: number;
    individuaisLigadas: number;
    valorIndividual: number;
    valorLigado: number;
    parlamentaresComEmenda: number;
    naoLigados: { codigoAutor: string; nome: string; emendas: number; empenhado: number }[];
  };
}

/**
 * Liga só emendas individuais (bancada/comissão são coletivas e nunca entram no total de uma pessoa).
 * Ordem: de/para manual → nome idêntico e único entre os parlamentares atuais. Na dúvida, não liga.
 */
export function ligarAutores(
  emendas: Emenda[],
  parlamentares: Parlamentar[],
  depara: DePara = {},
): ResultadoLigacao {
  const porNome = new Map<string, string[]>();
  for (const p of parlamentares) {
    const k = nomeComparavel(p.nome);
    porNome.set(k, [...(porNome.get(k) ?? []), p.id]);
  }
  const atuais = new Set(parlamentares.map((p) => p.id));
  const naoLigados = new Map<
    string,
    { codigoAutor: string; nome: string; emendas: number; empenhado: number }
  >();
  let individuais = 0,
    ligadas = 0,
    valorIndividual = 0,
    valorLigado = 0;

  const saida = emendas.map((e) => {
    if (e.tipo !== "individual") return { ...e, idParlamentar: null };
    individuais++;
    valorIndividual += e.valores.empenhado;
    let id: string | null = null;
    if (e.codigoAutor in depara) id = depara[e.codigoAutor] ?? null;
    else {
      const c = porNome.get(nomeComparavel(e.autorTexto)) ?? [];
      if (c.length === 1) id = c[0]!;
    }
    if (id && !atuais.has(id)) id = null;
    if (id) {
      ligadas++;
      valorLigado += e.valores.empenhado;
    } else if (!(e.codigoAutor in depara)) {
      const n = naoLigados.get(e.codigoAutor) ?? {
        codigoAutor: e.codigoAutor,
        nome: e.autorTexto,
        emendas: 0,
        empenhado: 0,
      };
      n.emendas++;
      n.empenhado = Math.round((n.empenhado + e.valores.empenhado) * 100) / 100;
      naoLigados.set(e.codigoAutor, n);
    }
    return { ...e, idParlamentar: id };
  });

  return {
    emendas: saida,
    qualidade: {
      individuais,
      individuaisLigadas: ligadas,
      valorIndividual: Math.round(valorIndividual * 100) / 100,
      valorLigado: Math.round(valorLigado * 100) / 100,
      parlamentaresComEmenda: new Set(saida.map((e) => e.idParlamentar).filter(Boolean)).size,
      naoLigados: [...naoLigados.values()].sort((a, b) => b.empenhado - a.empenhado),
    },
  };
}
