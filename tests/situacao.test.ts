import { describe, expect, it } from "vitest";
import {
  FONTES,
  calcularSituacao,
  motivoPopular,
  situacaoDaFonte,
  type Tentativa,
} from "../pipeline/src/situacao/calculo.js";
import { coletarSituacao, type Api } from "../pipeline/src/situacao/coletar.js";

const fonte = (id: string) => FONTES.find((f) => f.id === id)!;
// 10/11/2026 (terça) às 16:40 em Brasília
const AGORA = new Date("2026-11-10T19:40:00Z");
const ok = (quando: string, extra: Partial<Tentativa> = {}): Tentativa => ({
  quando,
  ok: true,
  ...extra,
});
const falha = (quando: string, erro?: string): Tentativa => ({ quando, ok: false, erro });
const ERRO_CAMARA =
  'Etapa "cadastro" falhou: HTTP 503 em https://dadosabertos.camara.leg.br/api/v2/deputados?itens=100';

describe("Story 2.8 — situação das fontes", () => {
  it("CA1: em dia, com última atualização e próxima tentativa no horário de Brasília", () => {
    const s = situacaoDaFonte(fonte("diario"), [ok("2026-11-10T13:30:00Z")], AGORA);
    expect(s.estado).toBe("em-dia");
    expect(s.ultimaAtualizacao).toBe("10/11 às 10:30");
    expect(s.aviso).toBeNull();
    expect(s.proximaTentativa).toBe("amanhã, 11/11, às 10:07");
  });

  it("CA2: última tentativa falhou → atrasada, motivo simples e de quando são os números", () => {
    const s = situacaoDaFonte(
      fonte("diario"),
      [
        ok("2026-11-09T18:53:00Z"),
        falha("2026-11-10T16:30:00Z", ERRO_CAMARA),
        falha("2026-11-10T18:20:00Z", ERRO_CAMARA),
      ],
      AGORA,
    );
    expect(s.estado).toBe("atrasada");
    expect(s.aviso).toBe(
      "O site de dados da Câmara não respondeu na tentativa de 10/11. Os números mostrados são de 09/11.",
    );
    expect(s.aviso).not.toMatch(/http|503|leg\.br/i);
    expect(s.proximaTentativa).toBe("amanhã, 11/11, às 10:07");
  });

  it("CA2: motivos sem termos técnicos", () => {
    expect(motivoPopular("HTTP 504 em https://legis.senado.leg.br/x")).toBe(
      "O site de dados do Senado não respondeu",
    );
    expect(motivoPopular("fetch failed portaldatransparencia.gov.br")).toBe(
      "O Portal da Transparência não respondeu",
    );
    expect(motivoPopular("Queda acima de 30% em 1 contagem(ns): votos 10→1")).toMatch(
      /por segurança/,
    );
    expect(motivoPopular(undefined)).toBe("A atualização não terminou");
    expect(motivoPopular("Process completed with exit code 1.")).toBe("A atualização não terminou");
  });

  it("diária ainda sem sucesso hoje: próxima tentativa é a repescagem das 16:07 ou a das 10:07", () => {
    const manha = new Date("2026-11-10T12:00:00Z"); // 09:00
    const tarde = new Date("2026-11-10T15:00:00Z"); // 12:00
    const t = [ok("2026-11-09T18:53:00Z")];
    expect(situacaoDaFonte(fonte("diario"), t, manha).proximaTentativa).toBe("hoje, às 10:07");
    expect(situacaoDaFonte(fonte("diario"), t, tarde).proximaTentativa).toBe("hoje, às 16:07");
  });

  it("CA3: últimos 14 dias da rotina diária (mais antigo primeiro)", () => {
    const s = situacaoDaFonte(
      fonte("diario"),
      [
        ok("2026-11-09T18:53:00Z"),
        falha("2026-11-08T13:00:00Z"),
        ok("2026-11-08T19:00:00Z"),
        falha("2026-11-10T16:30:00Z"),
      ],
      AGORA,
    );
    expect(s.dias).toHaveLength(14);
    expect(s.dias!.slice(-3)).toEqual(["ok", "ok", "falha"]);
    expect(s.dias![0]).toBe("sem");
  });

  it("dia em Brasília: execução às 01:00 UTC conta no dia anterior", () => {
    const s = situacaoDaFonte(fonte("diario"), [ok("2026-11-10T01:00:00Z")], AGORA);
    expect(s.dias!.slice(-2)).toEqual(["ok", "sem"]);
    expect(s.ultimaAtualizacao).toBe("09/11 às 22:00");
  });

  it("repescagem dispensada não muda a hora da última atualização", () => {
    const s = situacaoDaFonte(
      fonte("diario"),
      [ok("2026-11-10T13:30:00Z"), ok("2026-11-10T19:10:00Z", { atualizou: false })],
      AGORA,
    );
    expect(s.ultimaAtualizacao).toBe("10/11 às 10:30");
  });

  it("CA4: sem atualização no prazo → atrasada mesmo sem falha registrada", () => {
    const s = situacaoDaFonte(fonte("presenca"), [ok("2026-10-25T14:00:00Z")], AGORA);
    expect(s.estado).toBe("atrasada");
    expect(s.aviso).toBe(
      "Não houve atualização no prazo previsto. Os números mostrados são de 25/10.",
    );
    expect(s.proximaTentativa).toBe("domingo, 15/11");
  });

  it("explicações: mostra quantos projetos já têm explicação, sem prazo", () => {
    const s = situacaoDaFonte(fonte("explicacoes"), [], AGORA, { com: 796, total: 799 });
    expect(s.estado).toBe("em-dia");
    expect(s.cobertura).toEqual({ com: 796, total: 799 });
    expect(s.ultimaAtualizacao).toBeNull();
    expect(s.proximaTentativa).toBe("segunda, 16/11");
  });

  it("nunca publicou → ainda não publicado, com o motivo da tentativa", () => {
    const s = situacaoDaFonte(fonte("palacio"), [falha("2026-11-03T19:10:00Z")], AGORA);
    expect(s.estado).toBe("aguardando");
    expect(s.ultimaAtualizacao).toBeNull();
    expect(s.aviso).toBe(
      "A atualização não terminou na tentativa de 03/11. Ainda não há dados desta fonte no site.",
    );
    expect(s.proximaTentativa).toBe("quarta, 18/11");
  });

  it("dia de rotina sem sucesso ainda: próxima é hoje", () => {
    const dia15 = new Date("2026-11-15T12:00:00Z");
    const s = situacaoDaFonte(fonte("emendas"), [ok("2026-11-01T18:00:00Z")], dia15);
    expect(s.proximaTentativa).toBe("hoje");
  });

  it("calcula todas as fontes, na ordem da página", () => {
    const r = calcularSituacao({}, AGORA);
    expect(r.conferidoEm).toBe(AGORA.toISOString());
    expect(r.fontes!.map((f) => f.id)).toEqual([
      "diario",
      "presenca",
      "emendas",
      "explicacoes",
      "palacio",
    ]);
    expect(r.fontes!.every((f) => f.estado === "aguardando" && f.aviso === null)).toBe(true);
  });
});

describe("Story 2.8 — coleta na API do GitHub", () => {
  it("CA5: API fora do ar → situação não conferida, sem derrubar a publicação", async () => {
    const api = async () => {
      throw new Error("GitHub respondeu 503");
    };
    const s = await coletarSituacao(api as Api, "/pasta/inexistente", AGORA);
    expect(s).toEqual({ conferidoEm: AGORA.toISOString(), fontes: null });
  });

  it("lê execuções, motivo da última falha e repescagem dispensada", async () => {
    const respostas: Record<string, unknown> = {
      "/actions/workflows/diario.yml/runs?status=completed&per_page=50": {
        workflow_runs: [
          { id: 3, conclusion: "failure", updated_at: "2026-11-10T16:30:00Z" },
          { id: 2, conclusion: "success", updated_at: "2026-11-09T21:10:00Z" },
          { id: 1, conclusion: "success", updated_at: "2026-11-09T18:55:00Z" },
        ],
      },
      "/actions/runs/3/jobs": { jobs: [{ id: 30, name: "atualizar", conclusion: "failure" }] },
      "/check-runs/30/annotations": [
        {
          annotation_level: "failure",
          message: `Etapa "cadastro" falhou: HTTP 503 em https://dadosabertos.camara.leg.br/x`,
        },
      ],
      "/actions/runs/2/jobs": { jobs: [{ id: 20, name: "atualizar", conclusion: "skipped" }] },
      "/actions/runs/1/jobs": { jobs: [{ id: 10, name: "atualizar", conclusion: "success" }] },
    };
    const api = async (c: string) => respostas[c] ?? { workflow_runs: [] };
    const s = await coletarSituacao(api as Api, "/pasta/inexistente", AGORA);
    const d = s.fontes!.find((f) => f.id === "diario")!;
    expect(d.estado).toBe("atrasada");
    expect(d.ultimaAtualizacao).toBe("09/11 às 15:55");
    expect(d.aviso).toBe(
      "O site de dados da Câmara não respondeu na tentativa de 10/11. Os números mostrados são de 09/11.",
    );
  });
});
