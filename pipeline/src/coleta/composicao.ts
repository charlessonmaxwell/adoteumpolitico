/**
 * Quantas mulheres há em cada casa (story 9.1).
 * O sexo de cada pessoa só passa pela memória: o que se publica é o total por casa.
 */
import { getJson, type OpcoesHttp } from "../util/http.js";
import { idParlamentar } from "../modelo/parlamentar.js";
import { BASE_CAMARA } from "./camara.js";
import { BASE_SENADO } from "./senado.js";

/** Ids das parlamentares em exercício; null = a fonte não informou. */
export interface MulheresPorCasa {
  camara: Set<string> | null;
  senado: Set<string> | null;
}

export async function coletarDeputadas(opcoes: OpcoesHttp = {}): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let pagina = 1; ; pagina++) {
    const { dados } = await getJson<{ dados: { id: number }[] }>(
      `${BASE_CAMARA}/deputados?siglaSexo=F&itens=100&pagina=${pagina}&ordem=ASC&ordenarPor=nome`,
      opcoes,
    );
    for (const d of dados) ids.add(idParlamentar("camara", d.id));
    if (dados.length < 100) break;
  }
  return ids;
}

const comoLista = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

export async function coletarSenadoras(opcoes: OpcoesHttp = {}): Promise<Set<string> | null> {
  const resp = await getJson<{
    ListaParlamentarEmExercicio: {
      Parlamentares: {
        Parlamentar:
          | { IdentificacaoParlamentar: { CodigoParlamentar: string; SexoParlamentar?: string } }[]
          | { IdentificacaoParlamentar: { CodigoParlamentar: string; SexoParlamentar?: string } };
      };
    };
  }>(`${BASE_SENADO}/senador/lista/atual.json`, opcoes);
  const lista = comoLista(resp.ListaParlamentarEmExercicio.Parlamentares.Parlamentar).map(
    (s) => s.IdentificacaoParlamentar,
  );
  if (!lista.some((p) => p.SexoParlamentar)) return null;
  return new Set(
    lista
      .filter((p) => /^f/i.test(p.SexoParlamentar ?? ""))
      .map((p) => idParlamentar("senado", p.CodigoParlamentar)),
  );
}

/** Falha numa casa não derruba a rotina: o cartão de gênero mostra "dado indisponível". */
export async function coletarMulheres(opcoes: OpcoesHttp = {}): Promise<MulheresPorCasa> {
  const tentar = async <T>(f: () => Promise<T>): Promise<T | null> => {
    try {
      return await f();
    } catch (e) {
      console.warn(`⚠ composição: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };
  return {
    camara: await tentar(() => coletarDeputadas(opcoes)),
    senado: await tentar(() => coletarSenadoras(opcoes)),
  };
}
