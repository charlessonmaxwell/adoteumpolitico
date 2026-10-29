// Story 2.2, CA2: nenhum texto com nota, ranking ou adjetivo sobre o parlamentar.
// Roda no CI sobre o site gerado.
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
  /\bgastão\b/i,
  /\bfaltoso\b/i,
  /\bvagabund/i,
];
// O rodapé declara a política ("não dá nota nem faz ranking"): permitido só nesse trecho exato.
const PERMITIDO = /não dá nota nem faz ranking/gi;

const arquivos = [];
function andar(d) {
  for (const f of readdirSync(d)) {
    const c = join(d, f);
    if (statSync(c).isDirectory()) andar(c);
    else if (c.endsWith(".html")) arquivos.push(c);
  }
}
andar(process.argv[2] ?? "site/dist");

const erros = [];
for (const a of arquivos) {
  const texto = readFileSync(a, "utf8")
    .replace(/<[^>]+>/g, " ")
    .replace(PERMITIDO, "");
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
