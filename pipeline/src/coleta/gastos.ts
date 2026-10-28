import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { baixarCotaCamara, urlCotaCamara, type CotaCamaraBruta } from "./gastos-camara.js";
import { baixarCeaps, urlCeaps, type CeapsBruta } from "./gastos-senado.js";
import { idParlamentar, type Casa } from "../modelo/parlamentar.js";
import type { Despesa, DespesaInvalida } from "../modelo/despesa.js";
import { paraData, paraValor, somenteCnpj } from "../util/normalizacao.js";
import type { OpcoesHttp } from "../util/http.js";

export const ANO_INICIAL = 2023;

export interface ResultadoGastos {
  validas: Despesa[];
  invalidas: DespesaInvalida[];
}

interface Campos {
  idOrigem: unknown;
  data: unknown;
  ano: unknown;
  mes: unknown;
  valor: unknown;
  categoria: unknown;
  fornecedor: unknown;
  cnpjCpf: unknown;
  urlDocumento: string | null;
}

/** Valida e converte para o modelo único. Despesa com problema vai para `invalidas`, fora dos totais. */
function normalizar(
  casa: Casa,
  c: Campos,
  urlFonte: string,
  hoje: string,
  r: ResultadoGastos,
): void {
  const idOrigem = c.idOrigem === null || c.idOrigem === undefined ? "" : String(c.idOrigem);
  const ano = Number(c.ano);
  const mes = Number(c.mes);
  const valor = paraValor(c.valor);
  const data = paraData(c.data);

  const motivo = !idOrigem
    ? "sem parlamentar vinculado"
    : data === "invalida"
      ? "data inválida"
      : data !== null && data > hoje
        ? "data futura"
        : !Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12
          ? "competência inválida"
          : valor === null
            ? "valor inválido"
            : null;

  if (motivo) {
    r.invalidas.push({
      motivo,
      casa,
      idOrigemParlamentar: idOrigem || null,
      data: data === "invalida" ? String(c.data) : data,
      ano: Number.isInteger(ano) ? ano : null,
      mes: Number.isInteger(mes) ? mes : null,
      valor,
      urlFonte,
    });
    return;
  }

  r.validas.push({
    idParlamentar: idParlamentar(casa, idOrigem),
    casa,
    data: data as string | null,
    ano,
    mes,
    categoria: String(c.categoria ?? "").trim(),
    fornecedor: String(c.fornecedor ?? "").trim(),
    cnpjFornecedor: somenteCnpj(c.cnpjCpf),
    valor: valor as number,
    urlDocumento: c.urlDocumento,
    urlFonte,
  });
}

export function normalizarCamara(
  brutos: CotaCamaraBruta[],
  ano: number,
  hoje: string,
  r: ResultadoGastos,
): void {
  for (const b of brutos) {
    normalizar(
      "camara",
      {
        idOrigem: b.idDeputado,
        data: b.dataEmissao,
        ano: b.ano,
        mes: b.mes,
        valor: b.valorLiquido,
        categoria: b.descricao,
        fornecedor: b.fornecedor,
        cnpjCpf: b.cnpjCPF,
        urlDocumento: b.urlDocumento?.trim() || null,
      },
      urlCotaCamara(ano),
      hoje,
      r,
    );
  }
}

export function normalizarSenado(
  brutos: CeapsBruta[],
  ano: number,
  hoje: string,
  r: ResultadoGastos,
): void {
  for (const b of brutos) {
    normalizar(
      "senado",
      {
        idOrigem: b.codSenador,
        data: b.data,
        ano: b.ano,
        mes: b.mes,
        valor: b.valorReembolsado,
        categoria: b.tipoDespesa,
        fornecedor: b.fornecedor,
        cnpjCpf: b.cpfCnpj,
        urlDocumento: null,
      },
      urlCeaps(ano),
      hoje,
      r,
    );
  }
}

export async function coletarGastos(
  anos: number[],
  opcoes: OpcoesHttp = {},
  hoje = new Date().toISOString().slice(0, 10),
): Promise<ResultadoGastos> {
  const r: ResultadoGastos = { validas: [], invalidas: [] };
  for (const ano of anos) {
    normalizarCamara(await baixarCotaCamara(ano, opcoes), ano, hoje, r);
    normalizarSenado(await baixarCeaps(ano, opcoes), ano, hoje, r);
  }
  return r;
}

export const anosDeColeta = (anoAtual = new Date().getFullYear()) =>
  Array.from({ length: anoAtual - ANO_INICIAL + 1 }, (_, i) => ANO_INICIAL + i);

async function main() {
  const anos = anosDeColeta();
  const { validas, invalidas } = await coletarGastos(anos);
  await mkdir("data/despesas", { recursive: true });
  await mkdir("data/qualidade", { recursive: true });
  // Um arquivo por casa e ano: evita um JSON único de centenas de MB.
  for (const casa of ["camara", "senado"] as const) {
    for (const ano of anos) {
      const lote = validas.filter((d) => d.casa === casa && d.ano === ano);
      await writeFile(`data/despesas/${casa}-${ano}.json`, JSON.stringify(lote));
    }
  }
  await writeFile("data/qualidade/despesas-invalidas.json", JSON.stringify(invalidas, null, 2));
  console.log(`OK: ${validas.length} despesas válidas, ${invalidas.length} fora dos totais`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}
