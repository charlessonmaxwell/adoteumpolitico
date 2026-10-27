import type { Casa } from "./parlamentar.js";

/**
 * Despesa da cota parlamentar (Câmara) ou CEAPS (Senado) no modelo único.
 * Não contém CPF do parlamentar nem CPF de fornecedor pessoa física.
 */
export interface Despesa {
  idParlamentar: string;
  casa: Casa;
  /** Data do documento (AAAA-MM-DD). Nula quando a fonte não informa. */
  data: string | null;
  /** Competência informada pela fonte (mês a que a despesa se refere). */
  ano: number;
  mes: number;
  categoria: string;
  fornecedor: string;
  /** Só CNPJ (14 dígitos). CPF de fornecedor pessoa física é descartado. */
  cnpjFornecedor: string | null;
  /** Em reais. Pode ser negativo (estorno/compensação de bilhete na Câmara). */
  valor: number;
  /** Link do documento fiscal. Sempre nulo no Senado (campo inexistente na fonte). */
  urlDocumento: string | null;
  urlFonte: string;
}

export interface DespesaInvalida {
  motivo: string;
  casa: Casa;
  idOrigemParlamentar: string | null;
  data: string | null;
  ano: number | null;
  mes: number | null;
  valor: number | null;
  urlFonte: string;
}
