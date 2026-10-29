import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { coletarVotacoesCamara } from "./votacoes-camara.js";
import { coletarLicencas, coletarVotacoesSenado } from "./votacoes-senado.js";
import { coletarParlamentares } from "./parlamentares.js";
import { anosDeColeta } from "./gastos.js";
import { INICIO_PERIODO } from "./proposicoes-senado.js";

async function main() {
  const anos = anosDeColeta();
  await mkdir("data/votacoes", { recursive: true });
  await mkdir("data/presenca", { recursive: true });
  for (const ano of anos) {
    const c = await coletarVotacoesCamara(ano);
    const s = await coletarVotacoesSenado(ano);
    await writeFile(`data/votacoes/camara-${ano}.json`, JSON.stringify(c.votacoes));
    await writeFile(`data/votacoes/camara-${ano}-votos.json`, JSON.stringify(c.votos));
    await writeFile(`data/votacoes/senado-${ano}.json`, JSON.stringify(s.votacoes));
    await writeFile(`data/votacoes/senado-${ano}-votos.json`, JSON.stringify(s.votos));
    await writeFile(`data/presenca/senado-${ano}.json`, JSON.stringify(s.presencas));
    const nominais = c.votacoes.filter((v) => v.tipo === "nominal").length;
    console.log(
      `${ano}: Câmara ${c.votacoes.length} votações (${nominais} nominais) · Senado ${s.votacoes.length}`,
    );
  }
  const senadores = (await coletarParlamentares()).filter((p) => p.casa === "senado");
  const licencas = await coletarLicencas(senadores, INICIO_PERIODO);
  await writeFile("data/presenca/senado-licencas.json", JSON.stringify(licencas));
  console.log(`Licenças do Senado: ${licencas.length}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}
