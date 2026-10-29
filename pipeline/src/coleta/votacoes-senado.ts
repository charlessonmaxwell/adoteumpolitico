import { getJson, type OpcoesHttp } from "../util/http.js";
import { BASE_SENADO } from "./senado.js";
import { idParlamentar, type Parlamentar } from "../modelo/parlamentar.js";
import type { Licenca, Presenca, ValorVoto, Votacao, Voto } from "../modelo/votacao.js";
import { limparTexto } from "./proposicoes-camara.js";
import { categorizarVotacao } from "./categoria-votacao.js";

/** Substituto oficial dos endpoints /plenario/lista/votacao e /senador/{cod}/votacoes (descontinuados). */
export const urlVotacaoSenado = (ano: number) =>
  `${BASE_SENADO}/votacao?dataInicio=${ano}-01-01&dataFim=${ano}-12-31`;

interface VotoSenadoBruto {
  codigoParlamentar: number | string;
  siglaVotoParlamentar?: string | null;
}
interface VotacaoSenadoBruta {
  codigoSessaoVotacao: number | string;
  dataSessao?: string;
  votacaoSecreta?: string;
  resultadoVotacao?: string | null;
  idProcesso?: number | null;
  identificacao?: string;
  ementa?: string;
  descricaoVotacao?: string;
  votos?: VotoSenadoBruto[];
}

const VOTO: Record<string, ValorVoto> = {
  Sim: "sim",
  Não: "nao",
  Abstenção: "abstencao",
  Votou: "votou",
  "P-NRV": "presente_sem_voto",
};

/** Siglas de comparecimento do Senado → situação e motivo em linguagem simples. */
const AUSENCIA: Record<string, [Presenca["situacao"], string]> = {
  AP: ["ausencia_justificada", "Atividade parlamentar"],
  MIS: ["ausencia_justificada", "Missão autorizada"],
  LS: ["ausencia_justificada", "Licença para tratamento de saúde"],
  LP: ["ausencia_justificada", "Licença particular"],
  NCom: ["ausente", "Não compareceu"],
};

export function classificarVotoSenado(sigla: string): {
  voto: ValorVoto;
  situacao: Presenca["situacao"];
  motivo: string | null;
} {
  if (sigla.startsWith("Presidente"))
    return { voto: "presidente", situacao: "presente", motivo: null };
  const v = VOTO[sigla];
  if (v) return { voto: v, situacao: "presente", motivo: null };
  const a = AUSENCIA[sigla];
  if (a) return { voto: "ausente", situacao: a[0], motivo: a[1] };
  return { voto: "nao_informado", situacao: "outro", motivo: sigla || null };
}

export async function coletarVotacoesSenado(ano: number, opcoes: OpcoesHttp = {}) {
  const lista = await getJson<VotacaoSenadoBruta[]>(urlVotacaoSenado(ano), opcoes);
  const votacoes: Votacao[] = [];
  const votos: Voto[] = [];
  const presencas: Presenca[] = [];
  for (const v of lista) {
    const id = `senado-${v.codigoSessaoVotacao}`;
    const data = String(v.dataSessao ?? "").slice(0, 10);
    votacoes.push({
      id,
      casa: "senado",
      data,
      tipo: v.votacaoSecreta === "S" ? "secreta" : "nominal",
      resultado:
        v.resultadoVotacao === "A" ? "aprovada" : v.resultadoVotacao === "R" ? "rejeitada" : null,
      idProposicao: v.idProcesso ? `senado-${v.idProcesso}` : null,
      projeto: v.idProcesso
        ? { titulo: limparTexto(v.identificacao), ementa: limparTexto(v.ementa) }
        : null,
      categoria: categorizarVotacao(String(v.descricaoVotacao ?? "")),
      descricao: limparTexto(v.descricaoVotacao),
      urlFonte: urlVotacaoSenado(ano),
    });
    for (const x of v.votos ?? []) {
      const idParl = idParlamentar("senado", String(x.codigoParlamentar));
      const c = classificarVotoSenado(String(x.siglaVotoParlamentar ?? "").trim());
      votos.push({ idVotacao: id, idParlamentar: idParl, voto: c.voto });
      presencas.push({
        idParlamentar: idParl,
        data,
        situacao: c.situacao,
        motivo: c.motivo,
        metrica: "votacao",
        referencia: id,
      });
    }
  }
  return { votacoes, votos, presencas };
}

interface LicencaBruta {
  DataInicio?: string;
  DataFim?: string | null;
  SiglaTipoAfastamento?: string;
  DescricaoTipoAfastamento?: string;
}

const comoLista = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

export async function coletarLicencas(
  senadores: Parlamentar[],
  desde: string,
  opcoes: OpcoesHttp = {},
): Promise<Licenca[]> {
  const saida: Licenca[] = [];
  for (const s of senadores) {
    const r = await getJson<{
      LicencaParlamentar?: {
        Parlamentar?: { Licencas?: { Licenca?: LicencaBruta | LicencaBruta[] } };
      };
    }>(`${BASE_SENADO}/senador/${s.idOrigem}/licencas.json`, opcoes);
    for (const l of comoLista(r.LicencaParlamentar?.Parlamentar?.Licencas?.Licenca)) {
      const fim = l.DataFim ?? null;
      if (!l.DataInicio || (fim && fim < desde)) continue;
      saida.push({
        idParlamentar: s.id,
        inicio: l.DataInicio,
        fim,
        tipo: l.SiglaTipoAfastamento ?? "",
        descricao: l.DescricaoTipoAfastamento ?? "",
      });
    }
  }
  return saida;
}
