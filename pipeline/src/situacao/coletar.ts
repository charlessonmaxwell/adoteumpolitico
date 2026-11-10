/**
 * Lê na API do GitHub as execuções das rotinas e grava `situacao.json` para a página
 * "Quando os dados foram atualizados" (story 2.8). Nunca derruba a publicação.
 * Uso: tsx pipeline/src/situacao/coletar.ts <pasta-de-dados>
 * Ambiente: GITHUB_TOKEN (ou GH_TOKEN) e GITHUB_REPOSITORY (dono/repositorio).
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  calcularSituacao,
  type Cobertura,
  type IdFonte,
  type Situacao,
  type Tentativa,
} from "./calculo.js";

const WORKFLOWS: Record<Exclude<IdFonte, "explicacoes">, string> = {
  diario: "diario.yml",
  presenca: "presenca-semanal.yml",
  emendas: "emendas-quinzenal.yml",
  palacio: "palacio-mensal.yml",
};

interface Execucao {
  id: number;
  conclusion: string | null;
  updated_at: string;
}
interface Job {
  id: number;
  name: string;
  conclusion: string | null;
}

export type Api = <T>(caminho: string) => Promise<T>;

export function criarApi(repo: string, token: string | undefined): Api {
  return async <T>(caminho: string) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${caminho}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "adoteumpolitico-situacao",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`GitHub respondeu ${r.status} em ${caminho}`);
    return (await r.json()) as T;
  };
}

/** Texto das anotações de erro dos jobs que falharam (só para escolher o motivo). */
async function erroDaExecucao(api: Api, id: number): Promise<string | undefined> {
  try {
    const { jobs } = await api<{ jobs: Job[] }>(`/actions/runs/${id}/jobs`);
    const textos: string[] = [];
    for (const j of jobs.filter((x) => x.conclusion === "failure")) {
      const notas = await api<{ annotation_level: string; message: string }[]>(
        `/check-runs/${j.id}/annotations`,
      );
      textos.push(...notas.filter((n) => n.annotation_level === "failure").map((n) => n.message));
    }
    return textos.join("\n") || undefined;
  } catch {
    return undefined;
  }
}

/** A rotina diária roda o job "atualizar" só se precisa; repescagem dispensada não é atualização nova. */
async function atualizou(api: Api, id: number): Promise<boolean> {
  try {
    const { jobs } = await api<{ jobs: Job[] }>(`/actions/runs/${id}/jobs`);
    return jobs.find((j) => j.name === "atualizar")?.conclusion !== "skipped";
  } catch {
    return true;
  }
}

export async function tentativasDaRotina(
  api: Api,
  fonte: keyof typeof WORKFLOWS,
): Promise<Tentativa[]> {
  const { workflow_runs } = await api<{ workflow_runs: Execucao[] }>(
    `/actions/workflows/${WORKFLOWS[fonte]}/runs?status=completed&per_page=50`,
  );
  const lista: (Tentativa & { id: number })[] = workflow_runs
    .filter((r) => ["success", "failure", "timed_out", "cancelled"].includes(r.conclusion ?? ""))
    .map((r) => ({ id: r.id, quando: r.updated_at, ok: r.conclusion === "success" }))
    .sort((a, b) => b.quando.localeCompare(a.quando));

  // Só a tentativa mais recente precisa do motivo (é a que aparece na página)
  const ultima = lista[0];
  if (ultima && !ultima.ok) ultima.erro = await erroDaExecucao(api, ultima.id);

  if (fonte === "diario") {
    for (const t of lista.filter((x) => x.ok).slice(0, 5)) {
      t.atualizou = await atualizou(api, t.id);
      if (t.atualizou) break;
    }
  }
  return lista.map(({ id: _id, ...t }) => t);
}

/** Quantos projetos votados já têm explicação simples (lidos da pasta de dados do site). */
export async function coberturaDasExplicacoes(pasta: string): Promise<Cobertura | undefined> {
  try {
    const dir = join(pasta, "projetos");
    const arqs = (await readdir(dir)).filter((f) => f.endsWith(".json"));
    let com = 0;
    for (const a of arqs) {
      const p = JSON.parse(await readFile(join(dir, a), "utf8")) as { explicacao?: string };
      if (p.explicacao?.trim()) com++;
    }
    return { com, total: arqs.length };
  } catch {
    return undefined;
  }
}

export async function coletarSituacao(
  api: Api,
  pasta: string,
  agora = new Date(),
): Promise<Situacao> {
  try {
    const t: Partial<Record<IdFonte, Tentativa[]>> = {};
    for (const f of Object.keys(WORKFLOWS) as (keyof typeof WORKFLOWS)[])
      t[f] = await tentativasDaRotina(api, f);
    const explicacoes = await coberturaDasExplicacoes(pasta);
    return calcularSituacao(t, agora, explicacoes ? { explicacoes } : undefined);
  } catch (e) {
    console.warn(
      `::warning::Situação das atualizações não conferida: ${e instanceof Error ? e.message : e}`,
    );
    return { conferidoEm: agora.toISOString(), fontes: null };
  }
}

async function main() {
  const pasta = process.argv[2] ?? "dados";
  const repo = process.env.GITHUB_REPOSITORY ?? "charlessonmaxwell/adoteumpolitico";
  const situacao = await coletarSituacao(
    criarApi(repo, process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN),
    pasta,
  );
  await writeFile(join(pasta, "situacao.json"), JSON.stringify(situacao, null, 2));
  const n = situacao.fontes?.filter((f) => f.estado === "em-dia").length;
  console.log(
    situacao.fontes
      ? `Situação: ${n} de ${situacao.fontes.length} fontes em dia`
      : "Situação: não conferida",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((e) => {
    // Nunca derruba a publicação
    console.warn(`::warning::Falha ao gravar situacao.json: ${e instanceof Error ? e.message : e}`);
  });
