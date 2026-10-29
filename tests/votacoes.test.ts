import { describe, expect, it } from "vitest";
import { coletarVotacoesCamara } from "../pipeline/src/coleta/votacoes-camara.js";
import {
  classificarVotoSenado,
  coletarLicencas,
  coletarVotacoesSenado,
} from "../pipeline/src/coleta/votacoes-senado.js";
import {
  coletarPresencaCamara,
  lerResumo,
  lerSessoes,
  mesclar,
} from "../pipeline/src/coleta/presenca-camara.js";
import type { Fetcher } from "../pipeline/src/util/http.js";
import type { Parlamentar } from "../pipeline/src/modelo/parlamentar.js";

const semEspera = { dormir: async () => {} };

// Formatos reais conferidos em 28–29/10/2026
const votacoesCamara = {
  dados: [
    {
      id: "100-1",
      data: "2025-02-04",
      siglaOrgao: "PLEN",
      aprovacao: 1,
      descricao: "Aprovado\to PL.",
    },
    { id: "100-2", data: "2025-02-05", siglaOrgao: "PLEN", aprovacao: 0, descricao: "Rejeitado." },
    { id: "100-3", data: "2025-02-05", siglaOrgao: "CCJC", aprovacao: 1, descricao: "Comissão." },
  ],
};
const votosCamara = {
  dados: [
    { idVotacao: "100-1", voto: "Sim", deputado_: { id: "204379" } },
    { idVotacao: "100-1", voto: "Não", deputado_: { id: "62881" } },
    { idVotacao: "100-1", voto: "Artigo 17", deputado_: { id: "1" } },
    { idVotacao: "100-1", voto: "", deputado_: { id: "2" } },
    { idVotacao: "100-3", voto: "Sim", deputado_: { id: "62881" } },
  ],
};
const votPropCamara = {
  dados: [{ idVotacao: "100-1", proposicao_: { id: 1029018 } }],
};
const votacoesSenado = [
  {
    codigoSessaoVotacao: 6918,
    dataSessao: "2025-02-19",
    votacaoSecreta: "N",
    resultadoVotacao: "A",
    idProcesso: 8793330,
    descricaoVotacao: "Votação nominal da Emenda nº 1.",
    votos: [
      { codigoParlamentar: 5672, siglaVotoParlamentar: "Sim" },
      { codigoParlamentar: 5008, siglaVotoParlamentar: "AP" },
      { codigoParlamentar: 22, siglaVotoParlamentar: "NCom" },
      { codigoParlamentar: 23, siglaVotoParlamentar: "Presidente (art. 51 RISF)" },
    ],
  },
  {
    codigoSessaoVotacao: 7000,
    dataSessao: "2025-03-01",
    votacaoSecreta: "S",
    resultadoVotacao: "R",
    votos: [{ codigoParlamentar: 5672, siglaVotoParlamentar: "Votou" }],
  },
];

function fetcher() {
  const chamadas: string[] = [];
  const f: Fetcher = async (url) => {
    chamadas.push(url);
    if (url.includes("/votacoesVotos/")) return Response.json(votosCamara);
    if (url.includes("/votacoesProposicoes/")) return Response.json(votPropCamara);
    if (url.includes("/votacoes/json/")) return Response.json(votacoesCamara);
    if (url.includes("/dadosabertos/votacao?")) return Response.json(votacoesSenado);
    if (url.includes("/licencas.json"))
      return Response.json({
        LicencaParlamentar: {
          Parlamentar: {
            Licencas: {
              Licenca: [
                {
                  DataInicio: "2026-10-15",
                  DataFim: "2026-10-15",
                  SiglaTipoAfastamento: "LICENCA_ATIVIDADE_PARLAMENTAR",
                  DescricaoTipoAfastamento: "Missão política",
                },
                {
                  DataInicio: "2015-01-01",
                  DataFim: "2015-02-01",
                  SiglaTipoAfastamento: "X",
                  DescricaoTipoAfastamento: "Antiga",
                },
              ],
            },
          },
        },
      });
    return new Response("", { status: 404 });
  };
  return Object.assign(f, { chamadas });
}

const htmlPresenca = `
<tr class="info-data"> <td class="info-data__data-formatada"> 15/12/2025 <span class="info-presenca-dia">Presença</span> </td> <td >&nbsp;</td> <td class="info-presenca-dia"> Presença </td> </tr>
<tr class="info-data__child"> <td > <span class="ml-3">EXTRAORDINÁRIA Nº 286 - 15/12/2025</span> </td> <td > Presença </td> <td class="info-presenca-dia">&nbsp;</td> </tr>
<tr class="info-data__child"> <td > <span class="ml-3">SESSÃO CONJUNTA Nº 030 - 19/12/2025</span> </td> <td > Ausência </td> <td class="info-presenca-dia">&nbsp;</td> </tr>
<tr class="info-data__child"> <td > <span class="ml-3">ORDINÁRIA Nº 10 - 20/03/2025</span> </td> <td > Missão Autorizada </td> <td class="info-presenca-dia">&nbsp;</td> </tr>
<table><tbody>
<tr> <td> <b>Total de sessões deliberativas com Ordem do Dia iniciada, na Sessão Legislativa*</b> </td> <td> <strong>127</strong> </td> <td > <strong>100,00%</strong> </td> </tr>
<tr> <td > <b>Total de ausências não justificadas em sessões deliberativas com Ordem do Dia iniciada*</b> </td> <td > <strong>8</strong> </td> <td > <strong>6,30%</strong> </td> </tr>
<tr> <td> <b>Total de dias com sessões deliberativas realizadas no período</b> </td> <td> 121 </td> <td > 100,00% </td> </tr>
<tr> <td> <b>Total de dias com presença nas sessões deliberativas</b> </td> <td> 105 </td> <td> 86,78% </td> </tr>
<tr> <td> <b>Total de dias com ausências justificadas em sessões deliberativas</b> </td> <td> 8 </td> <td> 6,61% </td> </tr>
<tr> <td> <b>Total de dias com ausências não justificadas em sessões deliberativas</b> </td> <td> 8 </td> <td> 6,61% </td> </tr>
</tbody></table>`;

const dep = (id: string): Parlamentar => ({
  id: `camara-${id}`,
  casa: "camara",
  idOrigem: id,
  nome: id,
  partido: "",
  uf: "",
  urlFoto: null,
  idLegislatura: 57,
  urlFonte: "",
  coletadoEm: "",
});

describe("Story 1.2 — Câmara: votações", () => {
  it("filtra plenário, marca nominal x simbólica e vincula proposição", async () => {
    const { votacoes } = await coletarVotacoesCamara(2025, { fetcher: fetcher(), ...semEspera });
    expect(votacoes).toHaveLength(2);
    expect(votacoes[0]).toMatchObject({
      id: "camara-100-1",
      tipo: "nominal",
      resultado: "aprovada",
      idProposicao: "camara-1029018",
      descricao: "Aprovado o PL.",
    });
    expect(votacoes[1]).toMatchObject({
      tipo: "simbolica",
      resultado: "rejeitada",
      idProposicao: null,
    });
  });

  it("CA1: votação simbólica nunca gera Voto; voto de comissão é ignorado", async () => {
    const { votos } = await coletarVotacoesCamara(2025, { fetcher: fetcher(), ...semEspera });
    expect(votos.every((v) => v.idVotacao === "camara-100-1")).toBe(true);
    expect(votos.map((v) => v.voto)).toEqual(["sim", "nao", "presidente", "nao_informado"]);
  });
});

describe("Story 1.2 — Senado: votações e comparecimento", () => {
  it("CA4: usa só o /votacao (1 chamada por ano), nunca os endpoints descontinuados", async () => {
    const f = fetcher();
    await coletarVotacoesSenado(2025, { fetcher: f, ...semEspera });
    expect(f.chamadas).toHaveLength(1);
    expect(
      f.chamadas.some((u) => /plenario\/lista|\/senador\/\d+\/votacoes|autorias/.test(u)),
    ).toBe(false);
  });

  it("marca secreta; voto secreto é só 'votou'", async () => {
    const r = await coletarVotacoesSenado(2025, { fetcher: fetcher(), ...semEspera });
    expect(r.votacoes.map((v) => [v.tipo, v.resultado, v.idProposicao])).toEqual([
      ["nominal", "aprovada", "senado-8793330"],
      ["secreta", "rejeitada", null],
    ]);
    expect(r.votos.find((v) => v.idVotacao === "senado-7000")?.voto).toBe("votou");
  });

  it("comparecimento: siglas viram situação e motivo em linguagem simples", async () => {
    const r = await coletarVotacoesSenado(2025, { fetcher: fetcher(), ...semEspera });
    const p = Object.fromEntries(
      r.presencas
        .filter((x) => x.referencia === "senado-6918")
        .map((x) => [x.idParlamentar, [x.situacao, x.motivo]]),
    );
    expect(p["senado-5672"]).toEqual(["presente", null]);
    expect(p["senado-5008"]).toEqual(["ausencia_justificada", "Atividade parlamentar"]);
    expect(p["senado-22"]).toEqual(["ausente", "Não compareceu"]);
    expect(p["senado-23"]).toEqual(["presente", null]);
    expect(r.presencas.every((x) => x.metrica === "votacao")).toBe(true);
  });

  it("sigla desconhecida não vira ausência (fica 'outro', com a sigla)", () => {
    expect(classificarVotoSenado("NA")).toEqual({
      voto: "nao_informado",
      situacao: "outro",
      motivo: "NA",
    });
  });

  it("licenças a partir do período", async () => {
    const s = { ...dep("5008"), id: "senado-5008", casa: "senado" as const };
    const l = await coletarLicencas([s], "2023-02-01", { fetcher: fetcher(), ...semEspera });
    expect(l).toEqual([
      {
        idParlamentar: "senado-5008",
        inicio: "2026-10-15",
        fim: "2026-10-15",
        tipo: "LICENCA_ATIVIDADE_PARLAMENTAR",
        descricao: "Missão política",
      },
    ]);
  });
});

describe("Story 1.2 — Câmara: presença (página oficial)", () => {
  it("lê uma linha por sessão, com motivo da justificativa", () => {
    const p = lerSessoes(htmlPresenca, "camara-62881");
    expect(p).toEqual([
      {
        idParlamentar: "camara-62881",
        data: "2025-12-15",
        situacao: "presente",
        motivo: null,
        metrica: "sessao",
        referencia: "EXTRAORDINÁRIA Nº 286 - 15/12/2025",
      },
      {
        idParlamentar: "camara-62881",
        data: "2025-12-19",
        situacao: "ausente",
        motivo: null,
        metrica: "sessao",
        referencia: "SESSÃO CONJUNTA Nº 030 - 19/12/2025",
      },
      {
        idParlamentar: "camara-62881",
        data: "2025-03-20",
        situacao: "ausencia_justificada",
        motivo: "Missão Autorizada",
        metrica: "sessao",
        referencia: "ORDINÁRIA Nº 10 - 20/03/2025",
      },
    ]);
  });

  it("lê os totais oficiais", () => {
    expect(lerResumo(htmlPresenca, "camara-62881", 2025, "u")).toMatchObject({
      sessoesComOrdemDoDia: 127,
      ausenciasNaoJustificadas: 8,
      diasComSessao: 121,
      diasPresente: 105,
      diasAusenciaJustificada: 8,
      diasAusenciaNaoJustificada: 8,
    });
  });

  it("CA3: página que falha ou sem quadro oficial entra em 'falhas' e mantém o dado anterior", async () => {
    const f: Fetcher = async (url) =>
      url.includes("/1/")
        ? new Response(htmlPresenca)
        : url.includes("/2/")
          ? new Response("<html>mudou</html>")
          : new Response("", { status: 404 });
    const pausas: number[] = [];
    const r = await coletarPresencaCamara([dep("1"), dep("2"), dep("3")], 2025, {
      fetcher: f,
      dormir: async (ms) => void pausas.push(ms),
      pausaMs: 2000,
    });
    expect(r.resumos.map((x) => x.idParlamentar)).toEqual(["camara-1"]);
    expect(r.falhas).toEqual(["camara-2", "camara-3"]);
    expect(pausas.filter((ms) => ms === 2000)).toHaveLength(2); // pausa entre páginas

    const anterior = [
      { idParlamentar: "camara-2", v: "antigo" },
      { idParlamentar: "camara-1", v: "antigo" },
    ];
    const novo = [{ idParlamentar: "camara-1", v: "novo" }];
    expect(mesclar(anterior, novo, r.falhas)).toEqual([
      { idParlamentar: "camara-2", v: "antigo" },
      { idParlamentar: "camara-1", v: "novo" },
    ]);
  });
});
