import { strFromU8, unzipSync } from "fflate";
import { getBytes, type OpcoesHttp } from "../util/http.js";

/**
 * Câmara: arquivo anual em lote. O endpoint /deputados/{id}/despesas está vazio e NÃO deve ser usado.
 */
export const urlCotaCamara = (ano: number) => `https://www.camara.leg.br/cotas/Ano-${ano}.json.zip`;

/** Campos do arquivo que usamos. Os demais (cpf, passageiro, etc.) são ignorados na leitura. */
export interface CotaCamaraBruta {
  numeroDeputadoID?: number | string | null;
  descricao?: string;
  fornecedor?: string;
  cnpjCPF?: string;
  dataEmissao?: string | null;
  valorLiquido?: number | string;
  numeroMes?: number | string;
  numeroAno?: number | string;
  urlDocumento?: string | null;
}

/** Baixa e descompacta o arquivo do ano. Retorna os registros brutos. */
export async function baixarCotaCamara(
  ano: number,
  opcoes: OpcoesHttp = {},
): Promise<CotaCamaraBruta[]> {
  const zip = await getBytes(urlCotaCamara(ano), opcoes);
  const arquivos = unzipSync(zip);
  const json = Object.entries(arquivos).find(([nome]) => nome.endsWith(".json"));
  if (!json) throw new Error(`Arquivo da cota ${ano} sem JSON dentro do zip`);
  const conteudo = JSON.parse(strFromU8(json[1])) as { dados?: CotaCamaraBruta[] };
  return conteudo.dados ?? [];
}
