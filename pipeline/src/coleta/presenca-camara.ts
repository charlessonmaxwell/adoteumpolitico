import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getTexto, type OpcoesHttp } from "../util/http.js";
import type { Parlamentar } from "../modelo/parlamentar.js";
import type { Presenca, ResumoPresencaCamara } from "../modelo/votacao.js";
import { coletarParlamentares } from "./parlamentares.js";
import { gravarMetricas } from "../monitoramento/metricas.js";

/**
 * Presença oficial da Câmara, lida da página do deputado (a API de eventos conta ~25% menos sessões).
 * Job semanal, separado do pipeline diário, com pausa entre páginas para não sobrecarregar o site.
 */
export const urlPresenca = (idOrigem: string, ano: number) =>
  `https://www.camara.leg.br/deputados/${idOrigem}/presenca-plenario/${ano}`;

/** Se mais que isso das páginas falhar, o layout provavelmente mudou: nada é gravado. */
export const FALHA_MAXIMA = 0.2;

const texto = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function situacaoDe(status: string): Pick<Presenca, "situacao" | "motivo"> {
  // "Presença Observações ?" = presença com nota (ícone na página)
  if (/^presen[çc]a\b/i.test(status)) return { situacao: "presente", motivo: null };
  if (/^aus[êe]ncia$/i.test(status)) return { situacao: "ausente", motivo: null };
  // Qualquer outro texto é a justificativa oficial (ex.: "Missão Autorizada")
  return { situacao: "ausencia_justificada", motivo: status };
}

/** Uma linha por sessão (linhas `info-data__child`): "EXTRAORDINÁRIA Nº 286 - 15/12/2025" | status. */
export function lerSessoes(html: string, idParlamentar: string): Presenca[] {
  const linhas = html.replace(/\s+/g, " ").match(/<tr class="info-data__child">.*?<\/tr>/g) ?? [];
  const saida: Presenca[] = [];
  for (const l of linhas) {
    const tds = [...l.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((m) => texto(m[1] ?? ""));
    const [sessao = "", status = ""] = tds;
    const d = /(\d{2})\/(\d{2})\/(\d{4})/.exec(sessao);
    if (!d || !status) continue;
    saida.push({
      idParlamentar,
      data: `${d[3]}-${d[2]}-${d[1]}`,
      ...situacaoDe(status),
      metrica: "sessao",
      referencia: sessao,
    });
  }
  return saida;
}

export function lerResumo(
  html: string,
  idParlamentar: string,
  ano: number,
  urlFonte: string,
): ResumoPresencaCamara {
  const plano = texto(html);
  const n = (rotulo: RegExp) => {
    const m = new RegExp(rotulo.source + "\\*?\\s+(\\d+)", "i").exec(plano);
    return m ? Number(m[1]) : null;
  };
  return {
    idParlamentar,
    ano,
    sessoesComOrdemDoDia: n(
      /Total de sessões deliberativas com Ordem do Dia iniciada, na Sessão Legislativa/,
    ),
    ausenciasNaoJustificadas: n(
      /Total de ausências não justificadas em sessões deliberativas com Ordem do Dia iniciada/,
    ),
    diasComSessao: n(/Total de dias com sessões deliberativas realizadas no período/),
    diasPresente: n(/Total de dias com presença nas sessões deliberativas/),
    diasAusenciaJustificada: n(/Total de dias com ausências justificadas em sessões deliberativas/),
    diasAusenciaNaoJustificada: n(
      /Total de dias com ausências não justificadas em sessões deliberativas/,
    ),
    urlFonte,
  };
}

export interface ResultadoPresenca {
  presencas: Presenca[];
  resumos: ResumoPresencaCamara[];
  falhas: string[];
}

export async function coletarPresencaCamara(
  deputados: Parlamentar[],
  ano: number,
  opcoes: OpcoesHttp & { pausaMs?: number } = {},
): Promise<ResultadoPresenca> {
  const { pausaMs = 2000, dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } =
    opcoes;
  const r: ResultadoPresenca = { presencas: [], resumos: [], falhas: [] };
  for (const [i, d] of deputados.entries()) {
    if (i > 0) await dormir(pausaMs);
    const url = urlPresenca(d.idOrigem, ano);
    try {
      const html = await getTexto(url, opcoes);
      const resumo = lerResumo(html, d.id, ano, url);
      // Página sem o quadro oficial = layout mudou ou deputado sem exercício no ano
      if (resumo.sessoesComOrdemDoDia === null) {
        r.falhas.push(d.id);
        continue;
      }
      r.resumos.push(resumo);
      r.presencas.push(...lerSessoes(html, d.id));
    } catch {
      r.falhas.push(d.id);
    }
  }
  return r;
}

/** Mantém os dados anteriores de quem falhou nesta execução (falha não apaga dado bom). */
export function mesclar<T extends { idParlamentar: string }>(
  anterior: T[],
  novo: T[],
  falhas: string[],
): T[] {
  const manter = new Set(falhas);
  return [...anterior.filter((x) => manter.has(x.idParlamentar)), ...novo];
}

async function lerJson<T>(caminho: string): Promise<T[]> {
  try {
    return JSON.parse(await readFile(caminho, "utf8")) as T[];
  } catch {
    return [];
  }
}

async function main() {
  const inicio = Date.now();
  const extras: Record<string, number> = {};
  let travou = false;
  try {
    const anos = process.argv.slice(2).map(Number).filter(Boolean);
    if (!anos.length) anos.push(new Date().getFullYear());
    const deputados = (await coletarParlamentares()).filter((p) => p.casa === "camara");
    const dir = process.env.DATA_DIR ?? "data";
    await mkdir(`${dir}/presenca`, { recursive: true });
    for (const ano of anos) {
      const r = await coletarPresencaCamara(deputados, ano);
      const taxa = r.falhas.length / deputados.length;
      extras[`deputados_lidos_${ano}`] = r.resumos.length;
      extras[`falhas_${ano}`] = r.falhas.length;
      if (taxa > FALHA_MAXIMA) {
        travou = true;
        throw new Error(
          `Presença ${ano}: ${r.falhas.length} de ${deputados.length} páginas falharam (${Math.round(taxa * 100)}%). Possível mudança de layout; dados anteriores mantidos.`,
        );
      }
      const base = `${dir}/presenca/camara-${ano}`;
      const presencas = mesclar(await lerJson<Presenca>(`${base}.json`), r.presencas, r.falhas);
      const resumos = mesclar(
        await lerJson<ResumoPresencaCamara>(`${base}-resumo.json`),
        r.resumos,
        r.falhas,
      );
      await writeFile(`${base}.json`, JSON.stringify(presencas));
      await writeFile(`${base}-resumo.json`, JSON.stringify(resumos));
      console.log(
        `Presença ${ano}: ${r.resumos.length} deputados, ${r.falhas.length} falhas (dados anteriores mantidos)`,
      );
    }
  } catch (e) {
    await gravarMetricas({
      workflow: "presenca",
      resultado: "falha",
      etapaFalha: "presenca",
      duracaoTotalS: Math.round((Date.now() - inicio) / 1000),
      etapasS: {},
      contagens: {},
      travaDisparou: travou,
      mudou: null,
      extras,
    });
    throw e;
  }
  await gravarMetricas({
    workflow: "presenca",
    resultado: "sucesso",
    duracaoTotalS: Math.round((Date.now() - inicio) / 1000),
    etapasS: {},
    contagens: {},
    travaDisparou: false,
    mudou: true,
    extras,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}
