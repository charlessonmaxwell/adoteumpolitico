import { getJson, type OpcoesHttp } from "../util/http.js";
import { BASE_SENADO } from "./senado.js";
import type { Parlamentar } from "../modelo/parlamentar.js";
import type { Proposicao } from "../modelo/proposicao.js";
import { categorizar, type ConfigCategorias } from "./categoria.js";
import { limparTexto } from "./proposicoes-camara.js";

/** Início da legislatura atual: a API devolve o histórico inteiro do senador (desde 2011 ou antes). */
export const INICIO_PERIODO = "2023-02-01";

interface ProcessoBruto {
  id: number;
  identificacao?: string;
  ementa?: string;
  autoria?: string;
  dataApresentacao?: string;
  situacaoAtual?: string | null;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "Senador Fulano (PT/SP), Senadora Beltrana (…)" → autor se o nome aparece antes do 1º separador. */
export function ehPrimeiroAutor(autoria: string, nome: string): boolean {
  const primeiro = autoria.split(/,| e outros| e (?=Senador)/)[0] ?? "";
  return semAcento(primeiro).includes(semAcento(nome));
}

/** "PL 123/2023" → { tipo: "PL", numero: 123, ano: 2023 } */
export function lerIdentificacao(s: string | undefined) {
  const m = /^(\S+)\s+(\d+)\/(\d{4})/.exec(String(s ?? "").trim());
  return m
    ? { tipo: m[1]!, numero: Number(m[2]), ano: Number(m[3]) }
    : { tipo: String(s ?? "").split(" ")[0] ?? "", numero: null, ano: null };
}

export async function coletarProposicoesSenado(
  senadores: Parlamentar[],
  cfg: ConfigCategorias,
  opcoes: OpcoesHttp = {},
): Promise<Proposicao[]> {
  const saida: Proposicao[] = [];
  for (const s of senadores) {
    const url = `${BASE_SENADO}/processo?codigoParlamentarAutor=${s.idOrigem}`;
    const lista = await getJson<ProcessoBruto[]>(url, opcoes);
    for (const p of lista) {
      const data = p.dataApresentacao?.slice(0, 10) ?? null;
      if (!data || data < INICIO_PERIODO) continue;
      const { tipo, numero, ano } = lerIdentificacao(p.identificacao);
      const ementa = limparTexto(p.ementa);
      saida.push({
        id: `senado-${p.id}`,
        idParlamentar: s.id,
        casa: "senado",
        tipo,
        numero,
        ano,
        ementa,
        situacao: p.situacaoAtual?.trim() || null,
        dataApresentacao: data,
        autoria: ehPrimeiroAutor(p.autoria ?? "", s.nome) ? "autor" : "coautor",
        categoria: categorizar(tipo, ementa, cfg),
        urlFonte: `${BASE_SENADO}/processo/${p.id}`,
      });
    }
  }
  return saida;
}
