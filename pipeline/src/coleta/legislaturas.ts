/**
 * Todos os parlamentares das legislaturas recentes, inclusive quem já saiu do cargo.
 * Uso: saber se o autor de uma emenda é "conhecido" (atual ou ex) — regra dos 99% das emendas.
 * Emendas de 2023 foram apresentadas em 2022, pela legislatura 56; por isso entram 56 e 57.
 */
import { getJson, type OpcoesHttp } from "../util/http.js";
import { idParlamentar, type Casa } from "../modelo/parlamentar.js";
import { BASE_CAMARA } from "./camara.js";
import { BASE_SENADO } from "./senado.js";

export interface MembroLegislatura {
  id: string;
  casa: Casa;
  nome: string;
  partido: string;
  uf: string;
}

export const LEGISLATURAS = [56, 57];

export async function coletarDeputadosLegislaturas(
  legs = LEGISLATURAS,
  opcoes: OpcoesHttp = {},
): Promise<MembroLegislatura[]> {
  const m = new Map<string, MembroLegislatura>();
  for (const leg of legs)
    for (let pagina = 1; ; pagina++) {
      const { dados } = await getJson<{
        dados: { id: number; nome: string; siglaPartido: string; siglaUf: string }[];
      }>(
        `${BASE_CAMARA}/deputados?idLegislatura=${leg}&itens=100&pagina=${pagina}&ordem=ASC&ordenarPor=nome`,
        opcoes,
      );
      for (const d of dados) {
        const id = idParlamentar("camara", d.id);
        m.set(id, { id, casa: "camara", nome: d.nome, partido: d.siglaPartido, uf: d.siglaUf });
      }
      if (dados.length < 100) break;
    }
  return [...m.values()];
}

/** Procura, em qualquer profundidade, objetos com IdentificacaoParlamentar (formato da API do Senado varia). */
function identificacoes(
  v: unknown,
  saida: Record<string, string>[] = [],
): Record<string, string>[] {
  if (Array.isArray(v)) for (const x of v) identificacoes(x, saida);
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.IdentificacaoParlamentar && typeof o.IdentificacaoParlamentar === "object")
      saida.push(o.IdentificacaoParlamentar as Record<string, string>);
    else for (const x of Object.values(o)) identificacoes(x, saida);
  }
  return saida;
}

export async function coletarSenadoresLegislaturas(
  legs = LEGISLATURAS,
  opcoes: OpcoesHttp = {},
): Promise<MembroLegislatura[]> {
  const resp = await getJson<unknown>(
    `${BASE_SENADO}/senador/lista/legislatura/${Math.min(...legs)}/${Math.max(...legs)}.json`,
    opcoes,
  );
  const m = new Map<string, MembroLegislatura>();
  for (const p of identificacoes(resp)) {
    if (!p.CodigoParlamentar || !p.NomeParlamentar) continue;
    const id = idParlamentar("senado", p.CodigoParlamentar);
    m.set(id, {
      id,
      casa: "senado",
      nome: p.NomeParlamentar,
      partido: p.SiglaPartidoParlamentar ?? "",
      uf: p.UfParlamentar ?? "",
    });
  }
  return [...m.values()];
}

export async function coletarMembros(opcoes: OpcoesHttp = {}) {
  const [d, s] = [
    await coletarDeputadosLegislaturas(LEGISLATURAS, opcoes),
    await coletarSenadoresLegislaturas(LEGISLATURAS, opcoes),
  ];
  if (d.length < 513 || s.length < 81)
    throw new Error(
      `Lista de legislaturas incompleta: ${d.length} deputados, ${s.length} senadores`,
    );
  return [...d, ...s];
}
