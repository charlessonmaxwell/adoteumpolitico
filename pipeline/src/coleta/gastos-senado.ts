import { getJson, type OpcoesHttp } from "../util/http.js";

export const urlCeaps = (ano: number) =>
  `https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/${ano}`;

/** Campos da API CEAPS que usamos. A fonte não tem link de documento fiscal. */
export interface CeapsBruta {
  codSenador?: number | string | null;
  tipoDespesa?: string;
  fornecedor?: string;
  cpfCnpj?: string;
  data?: string | null;
  valorReembolsado?: number | string;
  mes?: number | string;
  ano?: number | string;
}

export async function baixarCeaps(ano: number, opcoes: OpcoesHttp = {}): Promise<CeapsBruta[]> {
  return getJson<CeapsBruta[]>(urlCeaps(ano), opcoes);
}
