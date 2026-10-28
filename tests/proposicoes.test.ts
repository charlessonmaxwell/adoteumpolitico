import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { categorizar, carregarConfig } from "../pipeline/src/coleta/categoria.js";
import { coletarProposicoes } from "../pipeline/src/coleta/proposicoes.js";
import { ehPrimeiroAutor, lerIdentificacao } from "../pipeline/src/coleta/proposicoes-senado.js";
import type { Fetcher } from "../pipeline/src/util/http.js";
import type { Parlamentar } from "../pipeline/src/modelo/parlamentar.js";

const cfg = carregarConfig();
const semEspera = { dormir: async () => {} };

const senador = (cod: string, nome: string): Parlamentar => ({
  id: `senado-${cod}`,
  casa: "senado",
  idOrigem: cod,
  nome,
  partido: "X",
  uf: "SE",
  urlFoto: null,
  idLegislatura: 57,
  urlFonte: "",
  coletadoEm: "",
});

// Formato real dos arquivos em lote da Câmara (campos conferidos em 28/10/2026)
const propsCamara = {
  dados: [
    {
      id: 1,
      siglaTipo: "PL",
      numero: 10,
      ano: 2026,
      ementa: "Altera\ta Lei nº 1   para reduzir imposto.",
      dataApresentacao: "2026-03-01T10:00:00",
      ultimoStatus: { descricaoSituacao: "Aguardando Parecer" },
    },
    {
      id: 2,
      siglaTipo: "PL",
      numero: 11,
      ano: 2026,
      ementa: "Denomina Viaduto Fulano a ponte X.",
      ultimoStatus: {},
    },
    {
      id: 3,
      siglaTipo: "REQ",
      numero: 12,
      ano: 2026,
      ementa: "Requer urgência.",
      ultimoStatus: {},
    },
  ],
};
const autoresCamara = {
  dados: [
    { idProposicao: 1, idDeputadoAutor: 62881, ordemAssinatura: "1", proponente: "1" },
    { idProposicao: 1, idDeputadoAutor: 178871, ordemAssinatura: "2", proponente: "0" },
    { idProposicao: 2, idDeputadoAutor: 62881, ordemAssinatura: "1" },
    { idProposicao: 3, idDeputadoAutor: 62881, ordemAssinatura: "1" },
    { idProposicao: 3, idDeputadoAutor: null, ordemAssinatura: "1", nomeAutor: "Poder Executivo" },
  ],
};
// Formato real da API /processo do Senado
const processosSenado = [
  {
    id: 900,
    identificacao: "PL 50/2024",
    ementa: "Institui o Dia Nacional do Forró.",
    autoria: "Senador Fulano de Tal (PT/SE)",
    dataApresentacao: "2024-05-01",
    situacaoAtual: "AGUARDANDO_RELATOR",
  },
  {
    id: 901,
    identificacao: "PEC 3/2025",
    ementa: "Altera a Constituição.",
    autoria: "Senadora Beltrana Silva (PSD/SP), Senador Fulano de Tal (PT/SE) e outros.",
    dataApresentacao: "2025-01-10",
  },
  {
    id: 902,
    identificacao: "PLS 1/2015",
    ementa: "Antigo.",
    autoria: "Senador Fulano de Tal",
    dataApresentacao: "2015-01-01",
  },
];

function fetcher() {
  const chamadas: string[] = [];
  const f: Fetcher = async (url) => {
    chamadas.push(url);
    if (url.includes("/proposicoesAutores/")) return Response.json(autoresCamara);
    if (url.includes("/proposicoes/json/")) return Response.json(propsCamara);
    if (url.includes("/processo?")) return Response.json(processosSenado);
    return new Response("", { status: 404 });
  };
  return Object.assign(f, { chamadas });
}

describe("Story 1.4 — projetos", () => {
  it("Câmara: vincula autor e coautor pelos arquivos em lote, ignorando autor não-deputado", async () => {
    const r = await coletarProposicoes([], [2026], cfg, { fetcher: fetcher(), ...semEspera });
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({
      id: "camara-1",
      idParlamentar: "camara-62881",
      autoria: "autor",
      situacao: "Aguardando Parecer",
      dataApresentacao: "2026-03-01",
      ementa: "Altera a Lei nº 1 para reduzir imposto.",
      categoria: "legislativa",
    });
    expect(r[1]).toMatchObject({ idParlamentar: "camara-178871", autoria: "coautor" });
  });

  it("CA1: categorias separam legislativa, homenagem e procedimental", async () => {
    const r = await coletarProposicoes([senador("5008", "Fulano de Tal")], [2026], cfg, {
      fetcher: fetcher(),
      ...semEspera,
    });
    const cat = Object.fromEntries(r.map((p) => [`${p.id}/${p.idParlamentar}`, p.categoria]));
    expect(cat["camara-1/camara-62881"]).toBe("legislativa");
    expect(cat["camara-2/camara-62881"]).toBe("homenagem");
    expect(cat["camara-3/camara-62881"]).toBe("procedimental");
    expect(cat["senado-900/senado-5008"]).toBe("homenagem");
    expect(cat["senado-901/senado-5008"]).toBe("legislativa");
  });

  it("CA2: termos de homenagem vêm do arquivo de configuração", () => {
    const arquivo = JSON.parse(readFileSync("config/categorias-proposicao.json", "utf8"));
    expect(arquivo.termosHomenagem).toContain("denomina");
    const outro = { tiposLegislativos: ["PL"], termosHomenagem: ["batiza"] };
    expect(categorizar("PL", "Batiza a praça", outro)).toBe("homenagem");
    expect(categorizar("PL", "Denomina a praça", outro)).toBe("legislativa");
  });

  it("CA3: Câmara baixa no máximo 2 arquivos por ano; Senado 1 chamada por senador", async () => {
    const f = fetcher();
    await coletarProposicoes([senador("1", "A"), senador("2", "B")], [2025, 2026], cfg, {
      fetcher: f,
      ...semEspera,
    });
    expect(f.chamadas.filter((u) => u.includes("camara"))).toHaveLength(4);
    expect(f.chamadas.filter((u) => u.includes("senado"))).toHaveLength(2);
    expect(f.chamadas.some((u) => u.includes("idDeputadoAutor"))).toBe(false);
  });

  it("Senado: corta antes da legislatura atual e identifica autor x coautor", async () => {
    const r = await coletarProposicoes([senador("5008", "Fulano de Tal")], [], cfg, {
      fetcher: fetcher(),
      ...semEspera,
    });
    expect(r.map((p) => p.id)).toEqual(["senado-900", "senado-901"]);
    expect(r[0]).toMatchObject({ tipo: "PL", numero: 50, ano: 2024, autoria: "autor" });
    expect(r[1]).toMatchObject({ tipo: "PEC", autoria: "coautor", situacao: null });
  });

  it("utilitários do Senado", () => {
    expect(lerIdentificacao("RQS 92/2023")).toEqual({ tipo: "RQS", numero: 92, ano: 2023 });
    expect(ehPrimeiroAutor("Senador José Silva (PT/SE) e outros.", "Jose Silva")).toBe(true);
    expect(ehPrimeiroAutor("Comissão de Educação", "Jose Silva")).toBe(false);
  });
});
