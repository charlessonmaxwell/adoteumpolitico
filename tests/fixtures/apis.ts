/**
 * Respostas simuladas no formato real das APIs (campos conferidos em 27/10/2026).
 * Incluem e-mail e telefone de propósito, para testar que a coleta os descarta.
 */
import type { Fetcher } from "../../pipeline/src/util/http.js";

export function deputadoApi(i: number) {
  return {
    id: 200000 + i,
    uri: `https://dadosabertos.camara.leg.br/api/v2/deputados/${200000 + i}`,
    nome: `Deputado ${i}`,
    siglaPartido: "PARTIDO",
    uriPartido: "",
    siglaUf: "SE",
    idLegislatura: 57,
    urlFoto: `https://www.camara.leg.br/internet/deputado/bandep/${200000 + i}.jpg`,
    email: `dep${i}@camara.leg.br`,
  };
}

export function senadorApi(i: number) {
  return {
    IdentificacaoParlamentar: {
      CodigoParlamentar: String(5000 + i),
      NomeParlamentar: `Senador ${i}`,
      SiglaPartidoParlamentar: "PARTIDO",
      UfParlamentar: "SE",
      UrlFotoParlamentar: `https://www.senado.leg.br/senadores/img/fotos-oficiais/senador${5000 + i}.jpg`,
      EmailParlamentar: `sen${i}@senado.leg.br`,
      Telefones: { Telefone: [{ NumeroTelefone: "33033333" }] },
    },
    Mandato: {
      PrimeiraLegislaturaDoMandato: { NumeroLegislatura: i % 2 ? "56" : "57" },
      SegundaLegislaturaDoMandato: { NumeroLegislatura: i % 2 ? "57" : "58" },
    },
  };
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

/** Simula as duas APIs com `totalDeputados` e `totalSenadores` registros. */
export function fetcherSimulado(totalDeputados = 513, totalSenadores = 81): Fetcher & { chamadas: string[] } {
  const chamadas: string[] = [];
  const fn = async (url: string) => {
    chamadas.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith("/deputados")) {
      const itens = Number(u.searchParams.get("itens"));
      const pagina = Number(u.searchParams.get("pagina"));
      const inicio = (pagina - 1) * itens;
      const fim = Math.min(inicio + itens, totalDeputados);
      const dados = Array.from({ length: Math.max(0, fim - inicio) }, (_, k) => deputadoApi(inicio + k));
      return json({ dados, links: [] });
    }
    if (u.pathname.endsWith("/senador/lista/atual.json")) {
      const lista = Array.from({ length: totalSenadores }, (_, k) => senadorApi(k));
      return json({
        ListaParlamentarEmExercicio: {
          Parlamentares: { Parlamentar: totalSenadores === 1 ? lista[0] : lista },
        },
      });
    }
    return json({}, 404);
  };
  return Object.assign(fn, { chamadas });
}
