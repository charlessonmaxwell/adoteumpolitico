import { getJson, type OpcoesHttp } from "../util/http.js";
import { idParlamentar } from "../modelo/parlamentar.js";
import type { ValorVoto, Votacao, Voto } from "../modelo/votacao.js";
import { limparTexto } from "./proposicoes-camara.js";
import { categorizarVotacao } from "./categoria-votacao.js";

const ARQ = "https://dadosabertos.camara.leg.br/arquivos/";
export const urlVotacoes = (ano: number) => `${ARQ}votacoes/json/votacoes-${ano}.json`;
export const urlVotos = (ano: number) => `${ARQ}votacoesVotos/json/votacoesVotos-${ano}.json`;
export const urlVotProp = (ano: number) =>
  `${ARQ}votacoesProposicoes/json/votacoesProposicoes-${ano}.json`;

interface VotacaoBruta {
  id: string;
  data?: string;
  siglaOrgao?: string;
  aprovacao?: number | null;
  descricao?: string;
}
interface VotoBruto {
  idVotacao: string;
  voto?: string;
  deputado_?: { id?: string | number };
}
interface VotPropBruta {
  idVotacao: string;
  proposicao_?: { id?: number; titulo?: string; ementa?: string };
}

const VOTO: Record<string, ValorVoto> = {
  Sim: "sim",
  Não: "nao",
  Abstenção: "abstencao",
  Obstrução: "obstrucao",
  "Artigo 17": "presidente",
};

export async function coletarVotacoesCamara(ano: number, opcoes: OpcoesHttp = {}) {
  const vot = (await getJson<{ dados: VotacaoBruta[] }>(urlVotacoes(ano), opcoes)).dados;
  const votos = (await getJson<{ dados: VotoBruto[] }>(urlVotos(ano), opcoes)).dados;
  const vp = (await getJson<{ dados: VotPropBruta[] }>(urlVotProp(ano), opcoes)).dados;

  const plenario = vot.filter((v) => v.siglaOrgao === "PLEN");
  const idsPlenario = new Set(plenario.map((v) => v.id));
  const comVoto = new Set(votos.map((v) => v.idVotacao));
  const prop = new Map<string, { id: number; titulo: string; ementa: string }>();
  for (const x of vp) {
    const p = x.proposicao_;
    if (p?.id && !prop.has(x.idVotacao))
      prop.set(x.idVotacao, {
        id: p.id,
        titulo: limparTexto(p.titulo),
        ementa: limparTexto(p.ementa),
      });
  }

  const votacoes: Votacao[] = plenario.map((v) => ({
    id: `camara-${v.id}`,
    casa: "camara",
    data: String(v.data ?? "").slice(0, 10),
    tipo: comVoto.has(v.id) ? "nominal" : "simbolica",
    resultado: v.aprovacao === 1 ? "aprovada" : v.aprovacao === 0 ? "rejeitada" : null,
    idProposicao: prop.has(v.id) ? `camara-${prop.get(v.id)!.id}` : null,
    projeto: prop.has(v.id)
      ? { titulo: prop.get(v.id)!.titulo, ementa: prop.get(v.id)!.ementa }
      : null,
    categoria: categorizarVotacao(String(v.descricao ?? "")),
    descricao: limparTexto(v.descricao),
    urlFonte: `https://dadosabertos.camara.leg.br/api/v2/votacoes/${v.id}`,
  }));

  const listaVotos: Voto[] = [];
  for (const v of votos) {
    const dep = v.deputado_?.id;
    if (!idsPlenario.has(v.idVotacao) || !dep) continue;
    listaVotos.push({
      idVotacao: `camara-${v.idVotacao}`,
      idParlamentar: idParlamentar("camara", String(dep)),
      voto: VOTO[String(v.voto ?? "").trim()] ?? "nao_informado",
    });
  }
  return { votacoes, votos: listaVotos };
}
