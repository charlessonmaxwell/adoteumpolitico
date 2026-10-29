// Story 2.2, CA2: nenhum texto com nota, ranking ou adjetivo sobre o parlamentar.
// Roda no CI sobre o site gerado. Verifica as páginas que falam de parlamentares (perfil e estado);
// as páginas institucionais declaram a política do site ("sem nota, sem ranking") e ficam de fora.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PROIBIDOS = [
  /\branking\b/i,
  /\bnota (?!fiscal)\w/i,
  /\bmelhor(es)? (deputad|senador|parlamentar)/i,
  /\bpior(es)?\b/i,
  /\bacima da média\b/i,
  /\babaixo da média\b/i,
  /\bcampe[ãa]o\b/i,
  /\bexcelente\b/i,
  /\bpéssim[oa]\b/i,
  /\b(bom|boa|ruim) (deputad|senador|parlamentar|mandato)/i,
  /\bgastão\b/,
  /\bfaltoso\b/,
  /\bvagabund/i,
];
// O rodapé declara a política ("não tem nota nem ranking"): permitido só nesse trecho exato.
const PERMITIDO = /não tem nota nem ranking/gi;

const arquivos = [];
function andar(d) {
  for (const f of readdirSync(d)) {
    const c = join(d, f);
    if (statSync(c).isDirectory()) andar(c);
    else if (c.endsWith(".html")) arquivos.push(c);
  }
}
const raiz = process.argv[2] ?? "site/dist";
// Nomes de parlamentares saem do texto antes da checagem (ex.: um deputado chamado "Gastão")
const arqNomes = process.argv[3];
const nomes = arqNomes ? JSON.parse(readFileSync(arqNomes, "utf8")).map((p) => p.nome) : [];
for (const sub of ["p", "uf", "projeto"]) andar(join(raiz, sub));

const erros = [];
for (const a of arquivos) {
  let texto = readFileSync(a, "utf8")
    .replace(/<[^>]+>/g, " ")
    .replace(PERMITIDO, "");
  for (const n of nomes) texto = texto.split(n).join(" ");
  for (const re of PROIBIDOS) {
    const m = re.exec(texto);
    if (m) erros.push(`${a}: "${m[0]}"`);
  }
}
if (erros.length) {
  console.error("Termos não neutros encontrados:\n" + erros.join("\n"));
  process.exit(1);
}
console.log(`Neutralidade OK em ${arquivos.length} páginas.`);
