import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ErroUnidadeNova,
  executarPalacio,
  fatorIpca,
  mesesEntre,
  somarMes,
  ultimoMesFechado,
  type Config,
} from "../pipeline/src/palacio/rotina.js";

const CFG: Config = {
  inicio: "202211",
  fichas: {
    presidente: { nome: "Presidente e família", unidades: { "110001": "SA", "110809": "SA P" } },
    vice: { nome: "Vice-Presidência", unidades: { "110101": "Vice" } },
  },
  excluidas: { "110538": "Abin", "110322": "GSI" },
  governos: [
    { nome: "Governo A", de: "202201", ate: "202212" },
    { nome: "Governo B", de: "202301", ate: "202612" },
  ],
};

const CAB =
  '"CÓDIGO ÓRGÃO SUPERIOR";"NOME ÓRGÃO SUPERIOR";"CÓDIGO ÓRGÃO";"NOME ÓRGÃO";"CÓDIGO UNIDADE GESTORA";"NOME UNIDADE GESTORA";"ANO EXTRATO";"MÊS EXTRATO";"CPF PORTADOR";"NOME PORTADOR";"CNPJ OU CPF FAVORECIDO";"NOME FAVORECIDO";"TRANSAÇÃO";"DATA TRANSAÇÃO";"VALOR TRANSAÇÃO"';
const l = (
  ug: string,
  nomeUg: string,
  fav: string,
  tra: string,
  valor: string,
  orgao = "Presidência da República",
) =>
  `"20000";"Presidência da República";"20101";"${orgao}";"${ug}";"${nomeUg}";"2025";"09";"***.123.456-**";"FULANO DE TAL";"-1";"${fav}";"${tra}";"01/09/2025";"${valor}"`;
const csv = (...linhas: string[]) => [CAB, ...linhas].join("\n");

const BASE = csv(
  l("110809", "SA P", "Sigiloso", "Informações protegidas por sigilo", "1.000,00"),
  l("110001", "SA", "AUTO POSTO X", "COMPRA A/V - R$ - APRES", "50,50"),
  l("110101", "VICE", "Sigiloso", "Informações protegidas por sigilo", "200,00"),
  l("110538", "ABIN", "Sigiloso", "Informações protegidas por sigilo", "99.999,00"),
);

describe("somarMes", () => {
  it("separa Presidente e Vice, conta o sigilo e ignora unidades excluídas", () => {
    const { mes, novas } = somarMes(BASE, CFG);
    expect(mes.presidente).toEqual({ total: 1050.5, sigiloso: 1000, transacoes: 2 });
    expect(mes.vice).toEqual({ total: 200, sigiloso: 200, transacoes: 1 });
    expect(novas).toEqual([]);
  });

  it("CA6: o resultado não carrega CPF nem nome de portador", () => {
    const s = JSON.stringify(somarMes(BASE, CFG));
    expect(s).not.toMatch(/FULANO|\*\*\*|123\.456/);
  });

  it("CA7: unidade nova sob a Presidência com valor relevante é apontada", () => {
    const { novas } = somarMes(
      csv(
        l(
          "110999",
          "SECRETARIA NOVA",
          "Sigiloso",
          "Informações protegidas por sigilo",
          "20.000,00",
        ),
        l("110998", "PEQUENA", "X", "COMPRA", "10,00"),
      ),
      CFG,
    );
    expect(novas).toEqual([{ codigo: "110999", nome: "SECRETARIA NOVA", valor: 20000 }]);
  });

  it("unidade nova de outro ministério não importa", () => {
    const { novas } = somarMes(
      csv(
        l("200001", "MJ", "X", "COMPRA", "50.000,00", "Ministério da Justiça").replace(
          "Presidência da República",
          "Ministério da Justiça",
        ),
      ),
      CFG,
    );
    expect(novas).toEqual([]);
  });
});

describe("datas e IPCA", () => {
  it("mesesEntre e último mês fechado", () => {
    expect(mesesEntre("202211", "202302")).toEqual(["202211", "202212", "202301", "202302"]);
    expect(ultimoMesFechado(new Date("2026-01-15T12:00:00Z"))).toBe("202512");
  });
  it("fator do IPCA leva ao mês-base; mês sem índice usa o último", () => {
    const ipca = { "202201": 100, "202212": 110 };
    expect(fatorIpca(ipca, "202201", "202212")).toBeCloseTo(1.1);
    expect(fatorIpca(ipca, "202301", "202212")).toBe(1);
  });
});

describe("executarPalacio", () => {
  const ipca = { "202211": 100, "202212": 100, "202301": 105, "202302": 110 };
  const agora = new Date("2023-03-10T10:00:00Z");

  it("monta a série por governo corrigida e grava a pasta palacio/", async () => {
    const dir = await mkdtemp(join(tmpdir(), "palacio-"));
    const { resumo } = await executarPalacio(dir, {
      cfg: CFG,
      baixar: async () => BASE,
      ipca,
      agora,
      pausaMs: 0,
    });
    expect(resumo.contagens.meses).toBe(4);
    const [a, b] = resumo.presidente.porGoverno;
    expect(a).toMatchObject({ nome: "Governo A", meses: 2, total: 2101 });
    expect(a!.corrigido).toBeCloseTo(2101 * 1.1, 1);
    expect(b).toMatchObject({ nome: "Governo B", meses: 2, total: 2101 });
    expect(resumo.ipcaBase).toBe("202302");
    const gravado = JSON.parse(await readFile(join(dir, "palacio", "resumo.json"), "utf8"));
    expect(gravado.vice.total.total).toBe(800);
    expect(await readFile(join(dir, "palacio", "meses.json"), "utf8")).not.toMatch(/FULANO/);
  });

  it("reaproveita meses antigos e só baixa os recentes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "palacio-"));
    await executarPalacio(dir, { cfg: CFG, baixar: async () => BASE, ipca, agora, pausaMs: 0 });
    const pedidos: string[] = [];
    await executarPalacio(dir, {
      cfg: CFG,
      baixar: async (m) => (pedidos.push(m), BASE),
      ipca,
      agora,
      pausaMs: 0,
    });
    expect(pedidos).toEqual(["202212", "202301", "202302"]);
  });

  it("mês recente ainda não publicado não quebra; mês antigo ausente quebra", async () => {
    const dir = await mkdtemp(join(tmpdir(), "palacio-"));
    const r = await executarPalacio(dir, {
      cfg: CFG,
      baixar: async (m) => (m === "202302" ? null : BASE),
      ipca,
      agora,
      pausaMs: 0,
    });
    expect(r.resumo.ultimoMes).toBe("202301");
    const dir2 = await mkdtemp(join(tmpdir(), "palacio-"));
    await expect(
      executarPalacio(dir2, {
        cfg: CFG,
        baixar: async (m) => (m === "202211" ? null : BASE),
        ipca,
        agora,
        pausaMs: 0,
      }),
    ).rejects.toThrow(/202211/);
  });

  it("CA7: trava com unidade nova e não grava nada", async () => {
    const dir = await mkdtemp(join(tmpdir(), "palacio-"));
    const comNova = csv(l("110999", "SECRETARIA NOVA", "Sigiloso", "sigilo", "20.000,00"));
    await expect(
      executarPalacio(dir, { cfg: CFG, baixar: async () => comNova, ipca, agora, pausaMs: 0 }),
    ).rejects.toBeInstanceOf(ErroUnidadeNova);
    await expect(readFile(join(dir, "palacio", "resumo.json"))).rejects.toThrow();
  });
});
