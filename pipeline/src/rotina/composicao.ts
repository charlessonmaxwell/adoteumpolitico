import type { Casa, Parlamentar } from "../modelo/parlamentar.js";
import { fimLegislatura, inicioLegislatura } from "../modelo/legislatura.js";
import type { MulheresPorCasa } from "../coleta/composicao.js";

/** Quem ocupa as cadeiras numa legislatura (story 9.1). Só totais: nada por pessoa. */
export interface ComposicaoCasa {
  total: number;
  /** Ordem alfabética, sem ranking. */
  partidos: { nome: string; parlamentares: number }[];
  /** null = a fonte não informou ou trouxe um número fora do razoável. */
  genero: { mulheres: number; homens: number } | null;
}

export interface Composicao {
  legislatura: number;
  inicio: string;
  fim: string;
  camara: ComposicaoCasa;
  senado: ComposicaoCasa;
}

/**
 * Regra de sanidade: zero mulheres ou mais da metade das cadeiras indica filtro ignorado
 * pela fonte (ela devolveria todo mundo). Nesse caso, melhor dizer que não há o dado.
 */
export function contarGenero(ids: string[], mulheres: Set<string> | null) {
  if (!mulheres) return null;
  const n = ids.filter((id) => mulheres.has(id)).length;
  if (n === 0 || n > ids.length / 2) return null;
  return { mulheres: n, homens: ids.length - n };
}

export function montarComposicao(
  parlamentares: Parlamentar[],
  mulheres: MulheresPorCasa | null,
  legislatura: number,
): Composicao {
  const casa = (c: Casa): ComposicaoCasa => {
    const l = parlamentares.filter((p) => p.casa === c);
    const porPartido = new Map<string, number>();
    for (const p of l) porPartido.set(p.partido, (porPartido.get(p.partido) ?? 0) + 1);
    return {
      total: l.length,
      partidos: [...porPartido]
        .map(([nome, parlamentares]) => ({ nome, parlamentares }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      genero: contarGenero(
        l.map((p) => p.id),
        mulheres?.[c] ?? null,
      ),
    };
  };
  return {
    legislatura,
    inicio: inicioLegislatura(legislatura),
    fim: fimLegislatura(legislatura),
    camara: casa("camara"),
    senado: casa("senado"),
  };
}
