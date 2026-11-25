import { getJson, type OpcoesHttp } from "../util/http.js";
import { idParlamentar, type Parlamentar } from "../modelo/parlamentar.js";
import { fimLegislatura, inicioLegislatura } from "../modelo/legislatura.js";

export const BASE_SENADO = "https://legis.senado.leg.br/dadosabertos";

interface IdentificacaoApi {
  CodigoParlamentar: string;
  NomeParlamentar: string;
  SiglaPartidoParlamentar: string;
  UfParlamentar: string;
  UrlFotoParlamentar?: string;
}

interface MandatoApi {
  PrimeiraLegislaturaDoMandato?: { NumeroLegislatura?: string };
  SegundaLegislaturaDoMandato?: { NumeroLegislatura?: string };
}

interface SenadorApi {
  IdentificacaoParlamentar: IdentificacaoApi;
  Mandato?: MandatoApi;
}

interface RespostaSenadores {
  ListaParlamentarEmExercicio: {
    Parlamentares: { Parlamentar: SenadorApi[] | SenadorApi };
  };
}

/** A API do Senado devolve objeto (não lista) quando há um só item. */
const comoLista = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

/** Legislatura em curso: o maior número entre as legislaturas do mandato que já começaram. */
function legislaturaAtual(mandato: MandatoApi | undefined, padrao: number): number {
  const numeros = [mandato?.PrimeiraLegislaturaDoMandato, mandato?.SegundaLegislaturaDoMandato]
    .map((l) => Number(l?.NumeroLegislatura))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= padrao);
  return numeros.length ? Math.max(...numeros) : padrao;
}

/** Período do mandato (8 anos): do início da 1ª ao fim da 2ª legislatura do mandato. */
export function periodoMandato(mandato: MandatoApi | undefined): Parlamentar["mandato"] {
  const a = Number(mandato?.PrimeiraLegislaturaDoMandato?.NumeroLegislatura);
  const b = Number(mandato?.SegundaLegislaturaDoMandato?.NumeroLegislatura);
  if (!(a > 0 && b > 0)) return undefined;
  return { inicio: inicioLegislatura(a), fim: fimLegislatura(b) };
}

export async function coletarSenadores(
  coletadoEm: string,
  legislaturaVigente: number,
  opcoes: OpcoesHttp = {},
): Promise<Parlamentar[]> {
  const url = `${BASE_SENADO}/senador/lista/atual.json`;
  const resp = await getJson<RespostaSenadores>(url, opcoes);
  return comoLista(resp.ListaParlamentarEmExercicio.Parlamentares.Parlamentar).map((s) => {
    const p = s.IdentificacaoParlamentar;
    return {
      id: idParlamentar("senado", p.CodigoParlamentar),
      casa: "senado" as const,
      idOrigem: p.CodigoParlamentar,
      nome: p.NomeParlamentar,
      partido: p.SiglaPartidoParlamentar,
      uf: p.UfParlamentar,
      urlFoto: p.UrlFotoParlamentar?.replace(/^http:\/\//, "https://") ?? null,
      idLegislatura: legislaturaAtual(s.Mandato, legislaturaVigente),
      ...(periodoMandato(s.Mandato) && { mandato: periodoMandato(s.Mandato) }),
      urlFonte: `${BASE_SENADO}/senador/${p.CodigoParlamentar}.json`,
      coletadoEm,
    };
  });
}
