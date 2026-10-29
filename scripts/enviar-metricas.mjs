/* global fetch, Buffer, AbortSignal */
// Envia metricas.json ao Grafana Cloud (protocolo Influx). Nunca falha o workflow:
// sem configuração ou com erro de rede, só registra um aviso.
// Uso: node scripts/enviar-metricas.mjs [metricas.json]
import { readFileSync, existsSync } from "node:fs";

const esc = (v) => String(v).replace(/[ ,=]/g, "_");

/** Converte as métricas de uma execução em linhas do protocolo Influx. */
export function paraLinhas(m) {
  const wf = `workflow=${esc(m.workflow)}`;
  const linhas = [
    `rotina_execucao,${wf},resultado=${esc(m.resultado)},etapa_falha=${esc(m.etapaFalha ?? "nenhuma")} ` +
      `sucesso=${m.resultado === "sucesso" ? 1 : 0},duracao_total_s=${m.duracaoTotalS},` +
      `trava_disparou=${m.travaDisparou ? 1 : 0},mudou=${m.mudou ? 1 : 0}`,
  ];
  for (const [etapa, s] of Object.entries(m.etapasS ?? {}))
    linhas.push(`rotina_etapa,${wf},etapa=${esc(etapa)} duracao_s=${s}`);
  for (const [chave, valor] of Object.entries(m.contagens ?? {})) {
    // "despesas/camara-2026" → tipo=despesas, casa=camara, ano=2026; "parlamentares" → casa=todas, ano=todos
    const [tipo, resto] = chave.split("/");
    const [casa, ano] = resto ? resto.split("-") : ["todas", "todos"];
    linhas.push(
      `rotina_contagem,${wf},tipo=${esc(tipo)},casa=${esc(casa)},ano=${esc(ano ?? "todos")} valor=${valor}`,
    );
  }
  for (const [nome, valor] of Object.entries(m.extras ?? {}))
    linhas.push(`rotina_extra,${wf},nome=${esc(nome)} valor=${valor}`);
  return linhas;
}

async function main() {
  const arquivo = process.argv[2] ?? "metricas.json";
  const { GRAFANA_INFLUX_URL: url, GRAFANA_USUARIO: usuario, GRAFANA_TOKEN: token } = process.env;
  if (!existsSync(arquivo)) return console.log(`Sem ${arquivo}: nada a enviar.`);
  const linhas = paraLinhas(JSON.parse(readFileSync(arquivo, "utf8")));
  if (!url || !usuario || !token)
    return console.log(`Grafana não configurado; ${linhas.length} métricas não enviadas.`);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${usuario}:${token}`).toString("base64"),
        "Content-Type": "text/plain",
      },
      body: linhas.join("\n"),
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) console.log(`Grafana: ${linhas.length} métricas enviadas.`);
    else console.log(`::warning::Grafana respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  } catch (e) {
    console.log(`::warning::Falha ao enviar métricas ao Grafana: ${e.message}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
