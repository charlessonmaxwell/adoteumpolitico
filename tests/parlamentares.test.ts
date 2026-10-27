import { describe, expect, it } from "vitest";
import {
  coletarParlamentares,
  MINIMO_PARLAMENTARES,
} from "../pipeline/src/coleta/parlamentares.js";
import { coletarSenadores } from "../pipeline/src/coleta/senado.js";
import { fetcherSimulado } from "./fixtures/apis.js";

const semEspera = { dormir: async () => {} };

describe("Story 1.1 — cadastro de parlamentares", () => {
  it("CA1: reúne 513 deputados e 81 senadores, paginando a Câmara", async () => {
    const fetcher = fetcherSimulado(513, 81);
    const todos = await coletarParlamentares({ fetcher, ...semEspera });

    expect(todos.filter((p) => p.casa === "camara")).toHaveLength(513);
    expect(todos.filter((p) => p.casa === "senado")).toHaveLength(81);
    // 513 deputados / 100 por página = 6 páginas + 1 chamada do Senado
    expect(fetcher.chamadas).toHaveLength(7);
  });

  it(`CA1: aborta quando a soma fica abaixo de ${MINIMO_PARLAMENTARES}`, async () => {
    const fetcher = fetcherSimulado(400, 81);
    await expect(coletarParlamentares({ fetcher, ...semEspera })).rejects.toThrow(
      /Coleta incompleta/,
    );
  });

  it("CA2: id estável entre execuções", async () => {
    const a = await coletarParlamentares({ fetcher: fetcherSimulado(), ...semEspera });
    const b = await coletarParlamentares({ fetcher: fetcherSimulado(), ...semEspera });
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
    expect(a[0]?.id).toMatch(/^camara-\d+$/);
    expect(a.at(-1)?.id).toMatch(/^senado-\d+$/);
  });

  it("CA3: todo registro tem urlFonte e coletadoEm", async () => {
    const todos = await coletarParlamentares({ fetcher: fetcherSimulado(), ...semEspera });
    for (const p of todos) {
      expect(p.urlFonte).toMatch(/^https:\/\//);
      expect(Number.isNaN(Date.parse(p.coletadoEm))).toBe(false);
    }
  });

  it("descarta e-mail, telefone e campos não previstos no modelo", async () => {
    const todos = await coletarParlamentares({ fetcher: fetcherSimulado(), ...semEspera });
    const texto = JSON.stringify(todos);
    expect(texto).not.toMatch(/@camara\.leg\.br|@senado\.leg\.br|33033333/);
    expect(Object.keys(todos[0]!).sort()).toEqual(
      [
        "casa",
        "coletadoEm",
        "id",
        "idLegislatura",
        "idOrigem",
        "nome",
        "partido",
        "uf",
        "urlFonte",
        "urlFoto",
      ].sort(),
    );
  });

  it("Senado: aceita resposta com um único senador (objeto em vez de lista)", async () => {
    const lista = await coletarSenadores("2026-10-27T00:00:00Z", 57, {
      fetcher: fetcherSimulado(0, 1),
      ...semEspera,
    });
    expect(lista).toHaveLength(1);
  });

  it("Senado: legislatura nunca passa da vigente (mandato que ainda não começou)", async () => {
    const lista = await coletarSenadores("2026-10-27T00:00:00Z", 57, {
      fetcher: fetcherSimulado(0, 81),
      ...semEspera,
    });
    expect(new Set(lista.map((s) => s.idLegislatura))).toEqual(new Set([57]));
  });
});
