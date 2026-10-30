/** Emenda parlamentar ao orçamento da União (fonte: Portal da Transparência/CGU). */
export type TipoEmenda = "individual" | "bancada" | "comissao" | "relator" | "outra";

export interface Emenda {
  /** Código oficial da emenda (12 dígitos). */
  id: string;
  ano: number;
  tipo: TipoEmenda;
  /** Transferência especial ("emenda Pix"): o dinheiro cai direto no caixa do ente. */
  pix: boolean;
  codigoAutor: string;
  /** Nome do autor como veio na fonte (auditoria da ligação). */
  autorTexto: string;
  /** Preenchido só quando a ligação com um parlamentar atual é segura. */
  idParlamentar: string | null;
  destino: {
    nivel: "municipio" | "estado" | "nacional";
    ibge: string | null;
    uf: string | null;
    nome: string;
  };
  area: string;
  subarea: string;
  valores: { empenhado: number; liquidado: number; pago: number; restosPagos: number };
}
