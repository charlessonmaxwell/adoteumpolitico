export type Casa = "camara" | "senado";

/**
 * Parlamentar no modelo único do portal.
 * Contém só dados públicos do mandato: e-mail, telefone e documentos pessoais são descartados na coleta.
 */
export interface Parlamentar {
  /** Estável entre execuções: `<casa>-<idOrigem>` */
  id: string;
  casa: Casa;
  idOrigem: string;
  nome: string;
  partido: string;
  uf: string;
  urlFoto: string | null;
  idLegislatura: number;
  /** Só senadores: o mandato de 8 anos atravessa duas legislaturas (story 9.2). */
  mandato?: { inicio: string; fim: string };
  urlFonte: string;
  coletadoEm: string;
}

export const idParlamentar = (casa: Casa, idOrigem: string | number) => `${casa}-${idOrigem}`;
