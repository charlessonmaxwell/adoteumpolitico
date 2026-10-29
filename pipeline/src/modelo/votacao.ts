import type { CategoriaVotacao } from "../coleta/categoria-votacao.js";
import type { Casa } from "./parlamentar.js";

export interface Votacao {
  /** `<casa>-<id de origem>` */
  id: string;
  casa: Casa;
  data: string;
  tipo: "nominal" | "simbolica" | "secreta";
  resultado: "aprovada" | "rejeitada" | null;
  /** Mesmo formato do id de Proposicao (`camara-<id>` / `senado-<idProcesso>`), quando houver. */
  idProposicao: string | null;
  /** Identificação e ementa do projeto votado, quando houver (ex.: "PLP 186/2026"). */
  projeto: { titulo: string; ementa: string } | null;
  categoria: CategoriaVotacao;
  descricao: string;
  urlFonte: string;
}

/** Só existe para votações nominais e secretas. Na secreta, o voto é apenas "votou". */
export type ValorVoto =
  | "sim"
  | "nao"
  | "abstencao"
  | "obstrucao"
  | "presidente"
  | "votou"
  | "presente_sem_voto"
  | "ausente"
  | "nao_informado";

export interface Voto {
  idVotacao: string;
  idParlamentar: string;
  voto: ValorVoto;
}

export interface Presenca {
  idParlamentar: string;
  data: string;
  situacao: "presente" | "ausente" | "ausencia_justificada" | "outro";
  motivo: string | null;
  /** Câmara: presença por sessão (critério oficial). Senado: comparecimento em votação nominal. */
  metrica: "sessao" | "votacao";
  /** Sessão (Câmara) ou votação (Senado) de referência. */
  referencia: string;
}

/** Totais oficiais publicados pela Câmara na página de presença (Ato da Mesa 191/2017). */
export interface ResumoPresencaCamara {
  idParlamentar: string;
  ano: number;
  sessoesComOrdemDoDia: number | null;
  ausenciasNaoJustificadas: number | null;
  diasComSessao: number | null;
  diasPresente: number | null;
  diasAusenciaJustificada: number | null;
  diasAusenciaNaoJustificada: number | null;
  urlFonte: string;
}

export interface Licenca {
  idParlamentar: string;
  inicio: string;
  fim: string | null;
  tipo: string;
  descricao: string;
}
