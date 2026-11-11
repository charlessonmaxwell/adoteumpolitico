/* global fetch, AbortSignal */
// Story 2.5: lê as visitas de ontem no Cloudflare Web Analytics (sem cookie, sem dado pessoal)
// e envia ao Grafana Cloud. Nunca falha o workflow: sem configuração ou com erro, só avisa.
// Uso: node scripts/coletar-visitas.mjs   (env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, SITE_HOST)
import { enviarLinhas } from "./enviar-metricas.mjs";

const API = "https://api.cloudflare.com/client/v4";
const esc = (v) => String(v || "nenhum").replace(/[ ,=\\]/g, "_");
const TOP = 10;

/** Agrupa e ordena: [{chave, visitas, paginas}] do maior para o menor. */
function ranking(grupos, chave, top = TOP) {
  return grupos
    .map((g) => ({ chave: g.dimensions[chave], visitas: g.sum.visits, paginas: g.count }))
    .sort((a, b) => b.paginas - a.paginas)
    .slice(0, top);
}

/** Converte o resultado da API em linhas Influx (agregados, nada por visitante). */
export function paraLinhasVisitas({ total, paginas, origens, dispositivos }) {
  const linhas = [`site_visitas visitas=${total.visitas},paginas=${total.paginas}`];
  for (const p of ranking(paginas, "requestPath"))
    linhas.push(`site_pagina,caminho=${esc(p.chave)} paginas=${p.paginas},visitas=${p.visitas}`);
  for (const o of ranking(origens, "refererHost", 8))
    linhas.push(`site_origem,origem=${esc(o.chave || "direto")} visitas=${o.visitas}`);
  for (const d of ranking(dispositivos, "deviceType", 5))
    linhas.push(`site_dispositivo,tipo=${esc(d.chave)} visitas=${d.visitas}`);
  return linhas;
}

async function cf(caminho, token, corpo) {
  const r = await fetch(API + caminho, {
    method: corpo ? "POST" : "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  return r.json();
}

const CONSULTA = `query ($conta: String!, $filtro: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!) {
  viewer { accounts(filter: { accountTag: $conta }) {
    total: rumPageloadEventsAdaptiveGroups(filter: $filtro, limit: 1) { count sum { visits } }
    paginas: rumPageloadEventsAdaptiveGroups(filter: $filtro, limit: 500) { count sum { visits } dimensions { requestPath } }
    origens: rumPageloadEventsAdaptiveGroups(filter: $filtro, limit: 100) { count sum { visits } dimensions { refererHost } }
    dispositivos: rumPageloadEventsAdaptiveGroups(filter: $filtro, limit: 10) { count sum { visits } dimensions { deviceType } }
  } }
}`;

async function main() {
  const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: conta } = process.env;
  const host = process.env.SITE_HOST ?? "adoteumpolitico.pages.dev";
  if (!token || !conta)
    return console.log("::warning::Cloudflare não configurado; visitas não coletadas.");

  const sites = await cf("/accounts/" + conta + "/rum/site_info/list?per_page=50", token);
  const site = (sites.result ?? []).find((s) => s.host === host || s.ruleset?.zone_name === host);
  if (!site)
    return console.log(
      `::warning::Web Analytics não encontrado para ${host}: ${JSON.stringify(sites.errors ?? [])}`,
    );

  const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const filtro = { date_geq: ontem, date_leq: ontem, siteTag: site.site_tag };
  const r = await cf("/graphql", token, { query: CONSULTA, variables: { conta, filtro } });
  const a = r.data?.viewer?.accounts?.[0];
  if (!a)
    return console.log(
      `::warning::Consulta de visitas falhou: ${JSON.stringify(r.errors ?? []).slice(0, 300)}`,
    );

  const t = a.total[0] ?? { count: 0, sum: { visits: 0 } };
  const linhas = paraLinhasVisitas({
    total: { visitas: t.sum.visits, paginas: t.count },
    paginas: a.paginas,
    origens: a.origens,
    dispositivos: a.dispositivos,
  });
  console.log(`Visitas em ${ontem}: ${t.sum.visits} (páginas vistas: ${t.count})`);
  await enviarLinhas(linhas);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
