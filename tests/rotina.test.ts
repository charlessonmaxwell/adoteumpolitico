import { mkdtemp, readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { executarRotina, relatorioFalha, type Coletores } from "../pipeline/src/rotina/index.js";
import { verificarQuedas } from "../pipeline/src/rotina/trava.js";
import type { Parlamentar } from "../pipeline/src/modelo/parlamentar.js";
import type { Despesa } from "../pipeline/src/modelo/despesa.js";

const parl = (casa: "camara" | "senado", id: number): Parlamentar => ({
  id: `${casa}-${id}`,
  casa,
  idOrigem: String(id),
  nome: `P${id}`,
  partido: "X",
  uf: "SE",
  urlFoto: null,
  idLegislatura: 57,
  urlFonte: "",
  coletadoEm: new Date().toISOString(), // muda a cada execução, de propósito
});

const despesa = (idParlamentar: string, valor: number, i: number): Despesa => ({
  idParlamentar,
  casa: "camara",
  data: "2026-01-01",
  ano: 2026,
  mes: 1,
  categoria: i % 2 ? "COMBUSTÍVEIS" : "PASSAGENS",
  fornecedor: "F",
  cnpjFornecedor: null,
  valor,
  urlDocumento: i % 2 ? "https://x" : null,
  urlFonte: "",
});

function coletores(nDespesas = 100): Coletores {
  return {
    parlamentares: async () => [parl("camara", 1), parl("camara", 2), parl("senado", 9)],
    votacoes: async () => ({
      votacoes: [
        {
          id: "camara-1",
          casa: "camara",
          data: "2026-03-01",
          tipo: "nominal",
          resultado: "aprovada",
          idProposicao: null,
          descricao: "",
          urlFonte: "",
        },
        {
          id: "camara-2",
          casa: "camara",
          data: "2026-03-02",
          tipo: "simbolica",
          resultado: "aprovada",
          idProposicao: null,
          descricao: "",
          urlFonte: "",
        },
        {
          id: "senado-7",
          casa: "senado",
          data: "2026-03-03",
          tipo: "nominal",
          resultado: "aprovada",
          idProposicao: null,
          descricao: "",
          urlFonte: "",
        },
      ],
      votos: [
        { idVotacao: "camara-1", idParlamentar: "camara-1", voto: "sim" },
        { idVotacao: "camara-1", idParlamentar: "camara-2", voto: "nao" },
        { idVotacao: "senado-7", idParlamentar: "senado-9", voto: "ausente" },
      ],
      presencasSenado: [
        {
          idParlamentar: "senado-9",
          data: "2026-03-03",
          situacao: "ausencia_justificada",
          motivo: "Atividade parlamentar",
          metrica: "votacao",
          referencia: "senado-7",
        },
      ],
      licencas: [
        {
          idParlamentar: "senado-9",
          inicio: "2026-03-03",
          fim: "2026-03-03",
          tipo: "X",
          descricao: "Y",
        },
      ],
    }),
    gastos: async () => ({
      validas: Array.from({ length: nDespesas }, (_, i) =>
        despesa(i % 2 ? "camara-1" : "camara-2", 10, i),
      ),
      invalidas: [],
    }),
    proposicoes: async () => [
      {
        id: "camara-50",
        idParlamentar: "camara-1",
        casa: "camara",
        tipo: "PL",
        numero: 1,
        ano: 2026,
        ementa: "",
        situacao: "Transformado em Norma Jurídica",
        dataApresentacao: "2026-01-01",
        autoria: "autor",
        categoria: "legislativa",
        urlFonte: "",
      },
      {
        id: "camara-51",
        idParlamentar: "camara-1",
        casa: "camara",
        tipo: "REQ",
        numero: 2,
        ano: 2026,
        ementa: "",
        situacao: null,
        dataApresentacao: "2026-01-01",
        autoria: "autor",
        categoria: "procedimental",
        urlFonte: "",
      },
    ],
  };
}

async function pastas() {
  const raiz = await mkdtemp(join(tmpdir(), "rotina-"));
  return { anterior: join(raiz, "publicado"), saida: join(raiz, "saida") };
}

const opcoes = (p: { anterior: string; saida: string }, c: Coletores) => ({
  ...p,
  anos: [2026],
  coletores: c,
  log: () => {},
  agora: () => new Date("2026-10-29T09:00:00Z"),
});

describe("Story 1.5 — rotina diária", () => {
  it("gera arquivos por casa/ano, resumo por parlamentar, médias e meta (CA4)", async () => {
    const p = await pastas();
    const { meta, mudou } = await executarRotina(opcoes(p, coletores()));
    expect(mudou).toBe(true);
    expect(meta.atualizadoEm).toBe("2026-10-29T09:00:00.000Z");
    expect(meta.contagens).toMatchObject({
      parlamentares: 3,
      "despesas/camara-2026": 100,
      "votacoes/camara-2026": 2,
      "votos/camara-2026": 2,
    });

    const arquivos = await readdir(p.saida, { recursive: true });
    expect(arquivos).toEqual(
      expect.arrayContaining([
        "meta.json",
        "medias.json",
        "parlamentares.json",
        "despesas/camara-2026.json",
        "resumo/camara-1.json",
        "resumo/senado-9.json",
        "presenca/senado-licencas.json",
      ]),
    );

    const r = JSON.parse(await readFile(join(p.saida, "resumo/camara-1.json"), "utf8"));
    expect(r.gastos).toMatchObject({ total: 500, quantidade: 50, comNotaFiscal: 50 });
    expect(r.projetos).toEqual({
      legislativas: { autor: 1, coautor: 0, viraramLei: 1 },
      homenagens: 0,
      procedimentais: 1,
    });
    expect(r.votacoes).toEqual({ nominaisDaCasa: 1, comRegistro: 1, votos: { sim: 1 } });
    const s = JSON.parse(await readFile(join(p.saida, "resumo/senado-9.json"), "utf8"));
    expect(s.presenca).toEqual({
      metrica: "votacao",
      porAno: { "2026": { ausencia_justificada: 1 } },
      licencas: 1,
    });
  });

  it("CA2: queda simulada de 40% aborta antes de gravar qualquer arquivo", async () => {
    const p = await pastas();
    await executarRotina({ ...opcoes(p, coletores(100)), saida: p.anterior }); // publicação anterior
    await expect(executarRotina(opcoes(p, coletores(60)))).rejects.toThrow(
      /Etapa "validacao".*despesas\/camara-2026 100→60 \(-40%\)/,
    );
    await expect(readdir(p.saida)).rejects.toThrow(); // nada foi escrito
  });

  it("trava pode ser ignorada manualmente (mudança intencional de estrutura)", async () => {
    const p = await pastas();
    await executarRotina({ ...opcoes(p, coletores(100)), saida: p.anterior });
    const avisos: string[] = [];
    await expect(
      executarRotina({
        ...opcoes(p, coletores(10)),
        ignorarTrava: true,
        log: (m) => void avisos.push(m),
      }),
    ).resolves.toMatchObject({ mudou: true });
    expect(avisos.some((a) => a.includes("Trava ignorada"))).toBe(true);
  });

  it("queda de até 30% passa", async () => {
    const p = await pastas();
    await executarRotina({ ...opcoes(p, coletores(100)), saida: p.anterior });
    await expect(executarRotina(opcoes(p, coletores(70)))).resolves.toMatchObject({ mudou: true });
  });

  it("CA3: execução sem mudança nas fontes não pede publicação (ignora horário de coleta)", async () => {
    const p = await pastas();
    await executarRotina({ ...opcoes(p, coletores()), saida: p.anterior });
    await new Promise((r) => setTimeout(r, 5)); // coletadoEm diferente
    const { mudou } = await executarRotina(opcoes(p, coletores()));
    expect(mudou).toBe(false);
  });

  it("reaproveita a presença da Câmara publicada pelo job semanal", async () => {
    const p = await pastas();
    await mkdir(join(p.anterior, "presenca"), { recursive: true });
    const resumo = [
      {
        idParlamentar: "camara-1",
        ano: 2026,
        sessoesComOrdemDoDia: 77,
        ausenciasNaoJustificadas: 2,
        diasComSessao: 70,
        diasPresente: 63,
        diasAusenciaJustificada: 5,
        diasAusenciaNaoJustificada: 2,
        urlFonte: "u",
      },
    ];
    await writeFile(join(p.anterior, "presenca/camara-2026.json"), "[]");
    await writeFile(join(p.anterior, "presenca/camara-2026-resumo.json"), JSON.stringify(resumo));
    await executarRotina(opcoes(p, coletores()));
    const r = JSON.parse(await readFile(join(p.saida, "resumo/camara-1.json"), "utf8"));
    expect(r.presenca.porAno[0]).toMatchObject({ ano: 2026, diasPresente: 63 });
    const m = JSON.parse(await readFile(join(p.saida, "medias.json"), "utf8"));
    expect(m.camara.taxaPresenca).toBe(0.9);
  });

  it("falha de coleta vira relatório com etapa, erro e contagens", async () => {
    const p = await pastas();
    const c = {
      ...coletores(),
      gastos: async () => {
        throw new Error("HTTP 503 em cotas");
      },
    };
    const erro = await executarRotina(opcoes(p, c)).catch((e) => e);
    const texto = relatorioFalha(erro);
    expect(texto).toContain("**Etapa:** gastos");
    expect(texto).toContain("HTTP 503 em cotas");
    expect(texto).toContain("`parlamentares`: 3");
    expect(texto).toContain("não foi atualizado");
  });
});

describe("trava", () => {
  it("chave que some conta como queda de 100%; chave nova não é queda", () => {
    expect(verificarQuedas({ a: 10, b: 10 }, { a: 10, c: 5 })).toEqual([
      { chave: "b", anterior: 10, atual: 0, queda: 1 },
    ]);
    expect(verificarQuedas(null, { a: 1 })).toEqual([]);
  });
});
