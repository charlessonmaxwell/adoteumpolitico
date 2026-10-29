import { getJson, type OpcoesHttp } from "../util/http.js";
import { idParlamentar } from "../modelo/parlamentar.js";
import type { Proposicao } from "../modelo/proposicao.js";
import { categorizar, type ConfigCategorias } from "./categoria.js";

/**
 * Câmara: arquivos anuais em lote (proposições com situação + autores).
 * A lista /proposicoes?idDeputadoAutor não traz situação nem autor/coautor e exigiria 100 mil+ chamadas.
 */
const ARQ = "https://dadosabertos.camara.leg.br/arquivos";
export const urlProposicoesCamara = (ano: number) =>
  `${ARQ}/proposicoes/json/proposicoes-${ano}.json`;
export const urlAutoresCamara = (ano: number) =>
  `${ARQ}/proposicoesAutores/json/proposicoesAutores-${ano}.json`;

interface PropBruta {
  id: number;
  siglaTipo?: string;
  numero?: number | string;
  ano?: number | string;
  ementa?: string;
  dataApresentacao?: string;
  ultimoStatus?: { descricaoSituacao?: string | null };
}

interface AutorBruto {
  idProposicao: number;
  idDeputadoAutor?: number | string | null;
  ordemAssinatura?: number | string;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : null);
/** Espaços normalizados e sem CPF (ementas às vezes trazem "CPF nº 000.000.000-00"). */
export const limparTexto = (s: unknown) =>
  String(s ?? "")
    .replace(/,?\s*CPF\s*(?:n[ºo°.]*\s*)?:?\s*\d{3}\.\d{3}\.\d{3}-\d{2}/gi, "")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

export async function coletarProposicoesCamara(
  ano: number,
  cfg: ConfigCategorias,
  opcoes: OpcoesHttp = {},
): Promise<Proposicao[]> {
  const props = await getJson<{ dados: PropBruta[] }>(urlProposicoesCamara(ano), opcoes);
  const autores = await getJson<{ dados: AutorBruto[] }>(urlAutoresCamara(ano), opcoes);
  const porId = new Map(props.dados.map((p) => [p.id, p]));

  const saida: Proposicao[] = [];
  for (const a of autores.dados) {
    if (!a.idDeputadoAutor) continue; // autor não-deputado (Executivo, comissão, Senado…)
    const p = porId.get(a.idProposicao);
    if (!p) continue;
    const tipo = String(p.siglaTipo ?? "").trim();
    const ementa = limparTexto(p.ementa);
    saida.push({
      id: `camara-${p.id}`,
      idParlamentar: idParlamentar("camara", String(a.idDeputadoAutor)),
      casa: "camara",
      tipo,
      numero: num(p.numero),
      ano: num(p.ano),
      ementa,
      situacao: p.ultimoStatus?.descricaoSituacao?.trim() || null,
      dataApresentacao: p.dataApresentacao?.slice(0, 10) ?? null,
      autoria: Number(a.ordemAssinatura) === 1 ? "autor" : "coautor",
      categoria: categorizar(tipo, ementa, cfg),
      urlFonte: `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${p.id}`,
    });
  }
  return saida;
}
