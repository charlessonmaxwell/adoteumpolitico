import type { Casa } from "./parlamentar.js";

export type Categoria = "legislativa" | "homenagem" | "procedimental";

/** Uma linha por (parlamentar, proposição): a mesma proposição aparece para cada autor. */
export interface Proposicao {
  /** Estável: `<casa>-<idOrigem da proposição>` */
  id: string;
  idParlamentar: string;
  casa: Casa;
  tipo: string;
  numero: number | null;
  ano: number | null;
  ementa: string;
  situacao: string | null;
  dataApresentacao: string | null;
  autoria: "autor" | "coautor";
  categoria: Categoria;
  urlFonte: string;
}
