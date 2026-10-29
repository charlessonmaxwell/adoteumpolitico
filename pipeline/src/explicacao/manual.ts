/**
 * Explicações escritas fora da rotina diária (tarefa semanal), sem chave de API.
 *   pendentes <pasta-projetos> [saida.json]  → lista projetos sem explicação válida (já aplica moldes)
 *   aplicar <pasta-projetos> <explicacoes.json> → grava { id: texto } nos arquivos dos projetos
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { baseDe, moldeFixo, validarExplicacao, type ProjetoComExplicacao } from "./index.js";

async function projetos(dir: string) {
  const r: { arq: string; p: ProjetoComExplicacao }[] = [];
  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".json")))
    r.push({ arq: join(dir, f), p: JSON.parse(await readFile(join(dir, f), "utf8")) });
  return r;
}

const gravar = (arq: string, p: ProjetoComExplicacao) => writeFile(arq, JSON.stringify(p));

export async function pendentes(dir: string) {
  const fila: { id: string; titulo: string; ementa: string }[] = [];
  let moldes = 0;
  for (const { arq, p } of await projetos(dir)) {
    const base = baseDe(p);
    if (p.explicacao && p.explicacaoBase === base) continue;
    const m = moldeFixo(p);
    if (m) {
      await gravar(arq, { ...p, explicacao: m, explicacaoBase: base, explicacaoOrigem: "molde" });
      moldes++;
    } else fila.push({ id: p.id, titulo: p.titulo, ementa: p.ementa });
  }
  return { moldes, fila };
}

export async function aplicar(dir: string, textos: Record<string, string>) {
  let ok = 0;
  const recusadas: string[] = [];
  for (const { arq, p } of await projetos(dir)) {
    const t = textos[p.id];
    if (t === undefined) continue;
    const v = validarExplicacao(t);
    if (!v) {
      recusadas.push(p.id);
      continue;
    }
    await gravar(arq, { ...p, explicacao: v, explicacaoBase: baseDe(p), explicacaoOrigem: "ia" });
    ok++;
  }
  return { ok, recusadas };
}

const [cmd, dir, arq] = process.argv.slice(2);
if (cmd === "pendentes" && dir) {
  const r = await pendentes(dir);
  if (arq) await writeFile(arq, JSON.stringify(r.fila, null, 1));
  console.log(
    `${r.moldes} explicações por molde gravadas; ${r.fila.length} pendentes${arq ? ` em ${arq}` : ""}`,
  );
} else if (cmd === "aplicar" && dir && arq) {
  const r = await aplicar(dir, JSON.parse(await readFile(arq, "utf8")));
  console.log(
    `${r.ok} explicações gravadas; recusadas pelo filtro: ${r.recusadas.join(", ") || "nenhuma"}`,
  );
} else if (cmd) {
  console.error("Uso: pendentes <pasta> [saida.json] | aplicar <pasta> <explicacoes.json>");
  process.exit(1);
}
