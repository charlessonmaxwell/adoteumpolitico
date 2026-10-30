/* eslint-disable no-undef -- código que roda dentro do navegador (document, PerformanceObserver) */
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import fs from "node:fs";
(async () => {
  const dist = process.argv[2];
  const perfil = fs
    .readdirSync(dist + "/p")
    .find((d) => d.startsWith("camara-") && fs.existsSync(`${dist}/p/${d}/emendas/index.html`));
  const proj = fs.readdirSync(dist + "/projeto")[0];
  const paginas = [
    "/",
    `/p/${perfil}/`,
    `/p/${perfil}/votos/`,
    `/p/${perfil}/emendas/`,
    `/projeto/${proj}/`,
    "/panorama/",
    "/cidade/se-aracaju/",
    "/uf/se/",
    "/como-funciona/",
  ];
  const b = await chromium.launch();
  const res = {};
  for (const tema of ["claro", "noturno"]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    for (const pg of paginas) {
      const p = await ctx.newPage();
      await p.goto("http://localhost:8815" + pg);
      if (tema === "noturno")
        await p.evaluate(() => document.documentElement.setAttribute("data-tema", "noturno"));
      const r = await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      for (const v of r.violations) {
        const k = `${v.id} (${v.impact})`;
        res[k] ??= { ajuda: v.help, onde: new Set(), exemplos: [] };
        res[k].onde.add(`${tema} ${pg.split("/")[1] || "home"}`);
        if (res[k].exemplos.length < 3)
          res[k].exemplos.push(
            v.nodes[0].html.slice(0, 160) +
              " :: " +
              (v.nodes[0].failureSummary || "").slice(0, 200).replace(/\n/g, " "),
          );
      }
      await p.close();
    }
  }
  for (const [k, v] of Object.entries(res))
    console.log(
      `\n## ${k} — ${v.ajuda}\nonde: ${[...v.onde].join(", ")}\n- ${v.exemplos.join("\n- ")}`,
    );
  if (!Object.keys(res).length) console.log("Nenhuma violação");
  await b.close();
})();
