import { getJson, type OpcoesHttp } from "../util/http.js";
import { idParlamentar, type Parlamentar } from "../modelo/parlamentar.js";

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
      urlFoto: p.UrlFotoParlamentar ?? null,
      idLegislatura: legislaturaAtual(s.Mandato, legislaturaVigente),
      urlFonte: `${BASE_SENADO}/senador/${p.CodigoParlamentar}.json`,
      coletadoEm,
    };
  });
}
