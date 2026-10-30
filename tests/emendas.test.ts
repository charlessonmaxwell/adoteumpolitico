import { describe, expect, it } from "vitest";
import {
  consolidar,
  lerCsv,
  paraEmenda,
  tipoEmenda,
  valorBr,
} from "../pipeline/src/coleta/emendas.js";
import { ligarAutores, nomeComparavel } from "../pipeline/src/emendas/ligacao.js";
import { porParlamentar } from "../pipeline/src/emendas/rotina.js";
import type { Parlamentar } from "../pipeline/src/modelo/parlamentar.js";

const CAB =
  '"Código da Emenda";"Ano da Emenda";"Tipo de Emenda";"Código do Autor da Emenda";"Nome do Autor da Emenda";"Número da emenda";"Localidade de aplicação do recurso";"Código Município IBGE";"Município";"Código UF IBGE";"UF";"Região";"Código Função";"Nome Função";"Código Subfunção";"Nome Subfunção";"Código Programa";"Nome Programa";"Código Ação";"Nome Ação";"Código Plano Orçamentário";"Nome Plano Orçamentário";"Valor Empenhado";"Valor Liquidado";"Valor Pago";"Valor Restos A Pagar Inscritos";"Valor Restos A Pagar Cancelados";"Valor Restos A Pagar Pagos"';
const linha = (
  cod: string,
  ano: string,
  tipo: string,
  autorCod: string,
  autor: string,
  local: string,
  ibge: string,
  mun: string,
  ufCod: string,
  uf: string,
  emp: string,
  pago: string,
) =>
  `"${cod}";"${ano}";"${tipo}";"${autorCod}";"${autor}";"0001";"${local}";"${ibge}";"${mun}";"${ufCod}";"${uf}";"Nordeste";"10";"Saúde";"301";"Atenção básica";"5119";"P";"2E89";"A";"0000";"PO";"${emp}";"0,00";"${pago}";"0,00";"0,00";"0,00"`;
const CSV = [
  CAB,
  linha(
    "202641440013",
    "2026",
    "Emenda Individual - Transferências Especiais",
    "4144",
    "ALESSANDRO VIEIRA",
    "ARACAJU - SE",
    "2800308",
    "ARACAJU",
    "2800000",
    "SERGIPE",
    "1.500.000,50",
    "1.000.000,00",
  ),
  linha(
    "202641440013",
    "2026",
    "Emenda Individual - Transferências Especiais",
    "4144",
    "ALESSANDRO VIEIRA",
    "ARACAJU - SE",
    "2800308",
    "ARACAJU",
    "2800000",
    "SERGIPE",
    "500,50",
    "0,00",
  ),
  linha(
    "202517750015",
    "2025",
    "Emenda Individual - Transferências com Finalidade Definida",
    "1775",
    "JANDIRA FEGHALI",
    "RIO DE JANEIRO (UF)",
    "",
    "",
    "3300000",
    "RIO DE JANEIRO",
    "200,00",
    "200,00",
  ),
  linha(
    "202571080008",
    "2025",
    "Emenda de Bancada",
    "7108",
    "BANCADA DO DISTRITO FEDERAL",
    "NACIONAL",
    "",
    "",
    "",
    "",
    "9.999,00",
    "0,00",
  ),
  linha(
    "Sem informação",
    "2014",
    "Emenda Individual - Transferências com Finalidade Definida",
    "S/I",
    "Sem informação",
    "X",
    "",
    "",
    "",
    "",
    "1,00",
    "1,00",
  ),
].join("\r\n");

const parl = (id: string, nome: string): Parlamentar =>
  ({ id, nome, casa: id.split("-")[0], partido: "X", uf: "SE" }) as Parlamentar;

describe("emendas — coleta CGU", () => {
  it("lê o CSV, filtra desde 2023, tira a sigla do código IBGE e soma linhas da mesma emenda", () => {
    const e = consolidar(lerCsv(CSV).map(paraEmenda));
    expect(e).toHaveLength(3);
    const [pix, rj, bancada] = e;
    expect(pix).toMatchObject({
      id: "202641440013",
      tipo: "individual",
      pix: true,
      destino: { nivel: "municipio", ibge: "2800308", uf: "SE", nome: "Aracaju" },
      valores: { empenhado: 1500501, pago: 1000000 },
    });
    expect(rj!.destino).toEqual({ nivel: "estado", ibge: null, uf: "RJ", nome: "Rio de Janeiro" });
    expect(bancada).toMatchObject({ tipo: "bancada", destino: { nivel: "nacional" } });
  });
  it("valores e tipos", () => {
    expect(valorBr("1.234,56")).toBe(1234.56);
    expect(tipoEmenda("Emenda de Comissão")).toEqual({ tipo: "comissao", pix: false });
  });
});

describe("emendas — ligação do autor", () => {
  const ps = [
    parl("senado-1", "Alessandro Vieira"),
    parl("camara-2", "Jandira Feghali"),
    parl("camara-3", "José Silva"),
    parl("senado-4", "José Silva"),
  ];
  it("liga só individuais, por nome único; homônimo e bancada ficam sem ligação", () => {
    const e = consolidar(lerCsv(CSV).map(paraEmenda));
    const r = ligarAutores(
      [...e, { ...e[1]!, id: "x", autorTexto: "JOSE SILVA", codigoAutor: "9" }],
      ps,
    );
    expect(r.emendas.map((x) => x.idParlamentar)).toEqual(["senado-1", "camara-2", null, null]);
    expect(r.qualidade).toMatchObject({
      individuais: 3,
      individuaisLigadas: 2,
      parlamentaresComEmenda: 2,
    });
    expect(r.qualidade.naoLigados.map((n) => n.nome)).toEqual(["JOSE SILVA"]);
  });
  it("de/para manual tem prioridade e pode marcar autor como não-atual", () => {
    const e = consolidar(lerCsv(CSV).map(paraEmenda));
    const r = ligarAutores(e, ps, { "4144": null, "1775": "camara-2" });
    expect(r.emendas.map((x) => x.idParlamentar)).toEqual([null, "camara-2", null]);
    expect(r.qualidade.naoLigados).toEqual([]);
  });
  it("nome comparável ignora acento e tratamento", () => {
    expect(nomeComparavel("Dep. José Câmara")).toBe("jose camara");
  });
});

describe("emendas — agregação por parlamentar", () => {
  it("soma total, pix, destinos e áreas", () => {
    const e = ligarAutores(consolidar(lerCsv(CSV).map(paraEmenda)), [
      parl("senado-1", "Alessandro Vieira"),
    ]).emendas;
    const d = porParlamentar(e).get("senado-1")!;
    expect(d.total.empenhado).toBe(1500501);
    expect(d.pix.emendas).toBe(1);
    expect(d.destinos[0]).toMatchObject({ nome: "Aracaju", uf: "SE" });
    expect(d.lista[0]!.destino).toBe("Aracaju (SE)");
  });
});

import { paraRecebimento, tipoFavorecido } from "../pipeline/src/coleta/emendas.js";
import { favorecidosPorParlamentar, montarCidades } from "../pipeline/src/emendas/cidades.js";

const FAV = [
  '"Código da Emenda";"Código do Autor da Emenda";"Nome do Autor da Emenda";"Número da emenda";"Tipo de Emenda";"Ano/Mês";"Código do Favorecido";"Favorecido";"Natureza Jurídica";"Tipo Favorecido";"UF Favorecido";"Município Favorecido";"Valor Recebido"',
  '"202641440013";"4144";"ALESSANDRO VIEIRA";"0013";"x";"202605";"13128780000100";"MUNICIPIO DE ARACAJU";"Município";"Pessoa Jurídica";"SE";"ARACAJU";"600.000,00"',
  '"202641440013";"4144";"ALESSANDRO VIEIRA";"0013";"x";"202606";"13128780000100";"MUNICIPIO DE ARACAJU";"Município";"Pessoa Jurídica";"SE";"ARACAJU";"400.000,00"',
  '"202641440013";"4144";"ALESSANDRO VIEIRA";"0013";"x";"202606";"12345678000199";"HOSPITAL X";"Associação Privada";"Pessoa Jurídica";"SE";"ARACAJU";"50,00"',
  '"202641440013";"4144";"ALESSANDRO VIEIRA";"0013";"x";"202606";"***.123.456-**";"FULANO";"";"Pessoa Física";"SE";"ARACAJU";"10,00"',
  '"999";"1";"X";"1";"x";"202606";"12345678000199";"HOSPITAL X";"Associação Privada";"Pessoa Jurídica";"SE";"ARACAJU";"99,00"',
].join("\n");

describe("emendas — quem recebeu (E2)", () => {
  const emendas = ligarAutores(consolidar(lerCsv(CSV).map(paraEmenda)), [
    parl("senado-1", "Alessandro Vieira"),
  ]).emendas;
  const ids = new Set(emendas.map((e) => e.id));
  const rec = lerCsv(FAV)
    .map((r) => paraRecebimento(r, ids))
    .filter((x) => x !== null);
  it("descarta pessoa física e emenda fora do escopo; classifica o favorecido", () => {
    expect(rec).toHaveLength(3);
    expect(rec.map((r) => r.tipo)).toEqual(["prefeitura", "prefeitura", "entidade"]);
    expect(tipoFavorecido("Sociedade Empresária Limitada")).toBe("empresa");
    expect(tipoFavorecido("Estado ou Distrito Federal")).toBe("estado");
  });
  it("monta a cidade com destino, autores em ordem alfabética e favorecidos somados", () => {
    const { cidades, indice, semCidade } = montarCidades(emendas, rec, [
      parl("senado-1", "Alessandro Vieira"),
    ]);
    expect(indice).toEqual([{ ibge: "2800308", nome: "Aracaju", uf: "SE", empenhado: 1500501 }]);
    const c = cidades.get("2800308")!;
    expect(c.destinadas.pix.emendas).toBe(1);
    expect(c.destinadas.autores.map((a) => a.nome)).toEqual(["Alessandro Vieira"]);
    expect(c.recebidos.favorecidos[0]).toMatchObject({
      nome: "MUNICIPIO DE ARACAJU",
      valor: 1000000,
    });
    expect(c.recebidos.porTipo).toEqual({ prefeitura: 1000000, entidade: 50 });
    expect(semCidade).toBe(0);
    expect(favorecidosPorParlamentar(emendas, rec).get("senado-1")!.total).toBe(1000050);
  });
});
