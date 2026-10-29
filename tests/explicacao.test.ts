import { describe, expect, it } from "vitest";
import {
  baseDe,
  ementaVaga,
  explicarProjetos,
  moldeFixo,
  validarExplicacao,
} from "../pipeline/src/explicacao/index.js";
import type { ProjetoVotado } from "../pipeline/src/rotina/votos-por-projeto.js";

const proj = (
  id: string,
  titulo: string,
  ementa: string,
  casa: "camara" | "senado" = "camara",
): ProjetoVotado => ({
  id,
  casa,
  titulo,
  ementa,
  idPrincipal: null,
  votacoes: [],
});

describe("explicação popular — moldes fixos", () => {
  it("indicação de embaixador vira texto com nome e cargo", () => {
    const t = moldeFixo(
      proj(
        "senado-1",
        "MSF 37/2023",
        "Submete à apreciação do Senado Federal, de conformidade com o art. 52, a indicação do Senhor JOÃO GENÉSIO DE ALMEIDA FILHO, Ministro de Primeira Classe, para exercer o cargo de Embaixador do Brasil na República do Botsuana.",
        "senado",
      ),
    );
    expect(t).toContain("João Genésio de Almeida Filho");
    expect(t).toContain("Embaixador do Brasil na República do Botsuana");
  });
  it("requerimento e data comemorativa", () => {
    expect(
      moldeFixo(
        proj(
          "s",
          "RQS 911/2025",
          "Requer calendário especial para a Proposta de Emenda à Constituição nº 48/2023.",
          "senado",
        ),
      ),
    ).toContain("Proposta de Emenda à Constituição nº 48/2023");
    expect(
      moldeFixo(proj("c", "PL 4035/2023", "Institui Agosto como mês de combate às desigualdades.")),
    ).toContain("data no calendário");
    expect(moldeFixo(proj("c", "PL 1/2024", "Institui o Dia Nacional do Forró."))).toContain(
      "data no calendário",
    );
    expect(
      moldeFixo(proj("c", "PL 2/2024", "Garante internação de jovens dependentes.")),
    ).toBeNull();
  });
  it("detecta ementa vaga e barra resposta ruim da IA", () => {
    expect(ementaVaga("Altera a Lei nº 9.605, de 12 de fevereiro de 1998.")).toBe(true);
    expect(ementaVaga("Cria contas separadas para o dinheiro da saúde nos municípios.")).toBe(
      false,
    );
    expect(validarExplicacao("SEM_INFORMACAO")).toBeNull();
    expect(validarExplicacao("Um projeto importante para o país.")).toBeNull();
    expect(validarExplicacao(" Cria um programa  para reduzir a fila do INSS. ")).toBe(
      "Cria um programa para reduzir a fila do INSS.",
    );
  });
});

describe("explicação popular — orquestração", () => {
  it("reaproveita, usa molde, chama IA só quando precisa e refaz se a ementa mudar", async () => {
    const a = proj("camara-1", "PL 1/2024", "Cria contas separadas para o dinheiro da saúde.");
    const b = proj("camara-2", "PL 2/2024", "Garante internação de jovens dependentes.");
    const c = proj("camara-3", "PL 3/2024", "Institui o Dia Nacional do Forró.");
    const d = proj("camara-4", "PL 4/2024", "Texto novo que mudou.");
    const anteriores = new Map([
      [
        "camara-1",
        { ...a, explicacao: "Antiga.", explicacaoBase: baseDe(a), explicacaoOrigem: "ia" as const },
      ],
      ["camara-4", { ...d, ementa: "Texto velho.", explicacao: "Velha.", explicacaoBase: "x" }],
    ]);
    const chamadas: string[] = [];
    const r = await explicarProjetos([a, b, c, d], {
      anteriores,
      ia: async (t) => {
        chamadas.push(t);
        return "Explicação nova.";
      },
    });
    expect(r.projetos.map((p) => p.explicacao)).toEqual([
      "Antiga.",
      "Explicação nova.",
      expect.stringContaining("data no calendário"),
      "Explicação nova.",
    ]);
    expect(chamadas).toHaveLength(2);
    expect(r.contagem).toMatchObject({ reaproveitadas: 1, molde: 1, ia: 2, falhas: 0 });
  });
  it("sem chave da IA: não quebra, deixa pendente", async () => {
    const r = await explicarProjetos([proj("camara-9", "PL 9/2024", "Algo novo.")], {
      anteriores: new Map(),
      ia: null,
    });
    expect(r.projetos[0]!.explicacao).toBeUndefined();
    expect(r.contagem.pendentes).toBe(1);
  });
});
