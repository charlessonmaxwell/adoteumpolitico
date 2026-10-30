import { unzipSync } from "fflate";
import { getBytes, type OpcoesHttp } from "../util/http.js";
import type { Emenda, Recebimento, TipoEmenda, TipoFavorecido } from "../modelo/emenda.js";
import { semCpf } from "../util/normalizacao.js";

export const URL_EMENDAS =
  "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO";
export const ANO_INICIAL = 2023;

/** Percorre o CSV da CGU (";", aspas duplas) chamando `cada` por linha, sem montar tudo na memória. */
export function percorrerCsv(texto: string, cada: (r: Record<string, string>) => void) {
  let cab: string[] | null = null;
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  const fechar = () => {
    linha.push(campo);
    campo = "";
    if (linha.length > 1 || linha[0] !== "") {
      if (!cab) cab = linha.map((h) => h.trim());
      else {
        const r: Record<string, string> = {};
        for (let k = 0; k < cab.length; k++) r[cab[k]!] = (linha[k] ?? "").trim();
        cada(r);
      }
    }
    linha = [];
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fechar();
    } else campo += c;
  }
  if (campo !== "" || linha.length) fechar();
}

/** CSV inteiro como lista de objetos (arquivos pequenos e testes). */
export function lerCsv(texto: string): Record<string, string>[] {
  const r: Record<string, string>[] = [];
  percorrerCsv(texto, (x) => r.push(x));
  return r;
}

/** Código IBGE do estado (2 dígitos) → sigla. */
export const UF_IBGE: Record<string, string> = {
  "11": "RO",
  "12": "AC",
  "13": "AM",
  "14": "RR",
  "15": "PA",
  "16": "AP",
  "17": "TO",
  "21": "MA",
  "22": "PI",
  "23": "CE",
  "24": "RN",
  "25": "PB",
  "26": "PE",
  "27": "AL",
  "28": "SE",
  "29": "BA",
  "31": "MG",
  "32": "ES",
  "33": "RJ",
  "35": "SP",
  "41": "PR",
  "42": "SC",
  "43": "RS",
  "50": "MS",
  "51": "MT",
  "52": "GO",
  "53": "DF",
};

const MINUSC = new Set(["de", "da", "do", "das", "dos", "e"]);
/** "POUSO REDONDO" → "Pouso Redondo"; "SANTA CATARINA" → "Santa Catarina". */
export const titulo = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && MINUSC.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");

export const valorBr = (s: string | undefined) => {
  const n = Number(
    String(s ?? "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

export function tipoEmenda(t: string): { tipo: TipoEmenda; pix: boolean } {
  const s = t.toLowerCase();
  if (s.includes("individual")) return { tipo: "individual", pix: s.includes("especiais") };
  if (s.includes("bancada")) return { tipo: "bancada", pix: false };
  if (s.includes("comiss")) return { tipo: "comissao", pix: false };
  if (s.includes("relator")) return { tipo: "relator", pix: false };
  return { tipo: "outra", pix: false };
}

/** Converte uma linha do CSV principal (EmendasParlamentares.csv) no modelo. Null = fora do escopo. */
export function paraEmenda(r: Record<string, string>): Emenda | null {
  const ano = Number(r["Ano da Emenda"]);
  const id = r["Código da Emenda"] ?? "";
  if (!Number.isFinite(ano) || ano < ANO_INICIAL || !/^\d+$/.test(id)) return null;
  const { tipo, pix } = tipoEmenda(r["Tipo de Emenda"] ?? "");
  const ibge = /^\d{7}$/.test(r["Código Município IBGE"] ?? "")
    ? r["Código Município IBGE"]!
    : null;
  const uf =
    UF_IBGE[(r["Código UF IBGE"] ?? "").slice(0, 2)] ??
    (ibge ? UF_IBGE[ibge.slice(0, 2)] : undefined) ??
    null;
  const localidade = r["Localidade de aplicação do recurso"] ?? "";
  return {
    id,
    ano,
    tipo,
    pix,
    codigoAutor: r["Código do Autor da Emenda"] ?? "",
    autorTexto: r["Nome do Autor da Emenda"] ?? "",
    idParlamentar: null,
    destino: ibge
      ? {
          nivel: "municipio",
          ibge,
          uf,
          nome: titulo(r["Município"] || localidade.replace(/\s+-\s+[A-Z]{2}$/, "")),
        }
      : uf
        ? { nivel: "estado", ibge: null, uf, nome: titulo(r["UF"] || uf) }
        : { nivel: "nacional", ibge: null, uf: null, nome: "Nacional ou vários estados" },
    area: r["Nome Função"] ?? "",
    subarea: r["Nome Subfunção"] ?? "",
    valores: {
      empenhado: valorBr(r["Valor Empenhado"]),
      liquidado: valorBr(r["Valor Liquidado"]),
      pago: valorBr(r["Valor Pago"]),
      restosPagos: valorBr(r["Valor Restos A Pagar Pagos"]),
    },
  };
}

/** Natureza jurídica da CGU → tipo de favorecido em linguagem simples. */
export function tipoFavorecido(natureza: string, nome = ""): TipoFavorecido {
  const sem = (t: string) =>
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const n = sem(natureza);
  const nm = sem(nome);
  if (/^(banco do brasil|caixa economica federal|banco do nordeste|banco da amazonia)/.test(nm))
    return "banco";
  if (/municip|prefeitura/.test(n) || /^(prefeitura|municipio|fundo municipal)/.test(nm))
    return "prefeitura";
  if (
    /estadual|estado ou distrito|distrito federal/.test(n) ||
    /^(governo do estado|estado d|fundo estadual)/.test(nm)
  )
    return "estado";
  if (/federal|autarquia|empresa publica|economia mista/.test(n)) return "orgao_publico";
  if (
    /associa|fundac|organizac|servico social|cooperativa|entidade|sindica|religios|consorcio publico/.test(
      n,
    )
  )
    return "entidade";
  if (/empres|sociedade|ltda|eireli|individual|limitada|anonima|consorcio/.test(n))
    return "empresa";
  return "outro";
}

/** Linha do CSV de favorecidos → recebimento (null = pessoa física ou emenda fora do escopo). */
export function paraRecebimento(r: Record<string, string>, ids: Set<string>): Recebimento | null {
  const idEmenda = r["Código da Emenda"] ?? "";
  if (!ids.has(idEmenda)) return null;
  if (!/jur[ií]dica/i.test(r["Tipo Favorecido"] ?? "")) return null; // pessoa física: nunca guardar
  if (/pessoa f[ií]sica/i.test(r["Natureza Jurídica"] ?? "")) return null; // ex.: produtor rural pessoa física
  const cnpj = (r["Código do Favorecido"] ?? "").replace(/\D/g, "");
  if (cnpj.length !== 14) return null;
  const natureza = r["Natureza Jurídica"] ?? "";
  const nome = semCpf(r["Favorecido"] ?? "");
  return {
    idEmenda,
    cnpj,
    nome,
    natureza,
    tipo: tipoFavorecido(natureza, nome),
    uf: /^[A-Z]{2}$/.test(r["UF Favorecido"] ?? "") ? r["UF Favorecido"]! : null,
    municipio: titulo(r["Município Favorecido"] ?? ""),
    anoMes: r["Ano/Mês"] ?? "",
    valor: valorBr(r["Valor Recebido"]),
  };
}

/** Baixa o zip da CGU: emendas desde ANO_INICIAL e quem recebeu o dinheiro delas. */
export async function coletarEmendas(
  opcoes: OpcoesHttp = {},
): Promise<{ emendas: Emenda[]; recebimentos: Recebimento[] }> {
  const NOMES = ["EmendasParlamentares.csv", "EmendasParlamentares_PorFavorecido.csv"];
  const zip = unzipSync(
    await getBytes(URL_EMENDAS, { tentativas: 4, esperaInicialMs: 5000, ...opcoes }),
    { filter: (f) => NOMES.includes(f.name) },
  );
  const [principal, fav] = NOMES.map((n) => zip[n]);
  if (!principal || !fav) throw new Error("Arquivos esperados não encontrados no zip da CGU");
  const dec = new TextDecoder("latin1");
  const linhas: (Emenda | null)[] = [];
  percorrerCsv(dec.decode(principal), (r) => linhas.push(paraEmenda(r)));
  const emendas = consolidar(linhas);
  const ids = new Set(emendas.map((e) => e.id));
  const recebimentos: Recebimento[] = [];
  percorrerCsv(dec.decode(fav), (r) => {
    const x = paraRecebimento(r, ids);
    if (x) recebimentos.push(x);
  });
  return { emendas, recebimentos };
}

/** A mesma emenda aparece em várias linhas (uma por ação/plano orçamentário): soma os valores. */
export function consolidar(lista: (Emenda | null)[]): Emenda[] {
  const m = new Map<string, Emenda>();
  for (const e of lista) {
    if (!e) continue;
    const k = `${e.id}|${e.destino.ibge ?? e.destino.uf ?? e.destino.nome}|${e.area}`;
    const a = m.get(k);
    if (!a) m.set(k, { ...e, valores: { ...e.valores } });
    else
      for (const c of ["empenhado", "liquidado", "pago", "restosPagos"] as const)
        a.valores[c] = Math.round((a.valores[c] + e.valores[c]) * 100) / 100;
  }
  return [...m.values()];
}
