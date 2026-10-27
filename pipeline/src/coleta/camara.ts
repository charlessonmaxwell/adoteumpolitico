import { getJson, type OpcoesHttp } from "../util/http.js";
import { idParlamentar, type Parlamentar } from "../modelo/parlamentar.js";

export const BASE_CAMARA = "https://dadosabertos.camara.leg.br/api/v2";
const ITENS_POR_PAGINA = 100;

interface DeputadoApi {
  id: number;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  idLegislatura: number;
  urlFoto?: string;
}

interface RespostaDeputados {
  dados: DeputadoApi[];
}

export async function coletarDeputados(
  coletadoEm: string,
  opcoes: OpcoesHttp = {},
): Promise<Parlamentar[]> {
  const resultado: Parlamentar[] = [];
  for (let pagina = 1; ; pagina++) {
    const url = `${BASE_CAMARA}/deputados?itens=${ITENS_POR_PAGINA}&pagina=${pagina}&ordem=ASC&ordenarPor=nome`;
    const { dados } = await getJson<RespostaDeputados>(url, opcoes);
    for (const d of dados) {
      resultado.push({
        id: idParlamentar("camara", d.id),
        casa: "camara",
        idOrigem: String(d.id),
        nome: d.nome,
        partido: d.siglaPartido,
        uf: d.siglaUf,
        urlFoto: d.urlFoto ?? null,
        idLegislatura: d.idLegislatura,
        urlFonte: `${BASE_CAMARA}/deputados/${d.id}`,
        coletadoEm,
      });
    }
    if (dados.length < ITENS_POR_PAGINA) break;
  }
  return resultado;
}
