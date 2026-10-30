/* eslint-disable no-undef -- código que roda dentro do navegador (document, PerformanceObserver) */
// Mede peso e tempo de carregamento em 4G lento (1,6 Mbps, 150 ms) nas páginas mais pesadas.
import { chromium } from "playwright";
import fs from "node:fs";
(async () => {
  const dist = process.argv[2];
  const base = process.argv[3] ?? "http://localhost:8815";
  const perfil = fs
    .readdirSync(dist + "/p")
    .find((d) => fs.existsSync(`${dist}/p/${d}/emendas/index.html`));
  const maiorProjeto = fs
    .readdirSync(dist + "/projeto")
    .map((d) => [d, fs.statSync(`${dist}/projeto/${d}/index.html`).size])
    .sort((a, b) => b[1] - a[1])[0][0];
  const maiorVotos = fs
    .readdirSync(dist + "/p")
    .filter((d) => fs.existsSync(`${dist}/p/${d}/votos/index.html`))
    .map((d) => [d, fs.statSync(`${dist}/p/${d}/votos/index.html`).size])
    .sort((a, b) => b[1] - a[1])[0][0];
  const paginas = [
    "/",
    `/p/${perfil}/`,
    `/p/${maiorVotos}/votos/`,
    `/projeto/${maiorProjeto}/`,
    "/panorama/",
    "/cidade/sp-sao-paulo/",
    "/uf/mg/",
  ];
  const b = await chromium.launch();
  for (const pg of paginas) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    let bytes = 0;
    cdp.on("Network.loadingFinished", (e) => (bytes += e.encodedDataLength));
    const t0 = Date.now();
    await p.goto(base + pg, { waitUntil: "load" });
    const lcp = await p.evaluate(
      () =>
        new Promise((r) => {
          new PerformanceObserver((l) => {
            const e = l.getEntries();
            r(Math.round(e[e.length - 1].startTime));
          }).observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => r(-1), 3000);
        }),
    );
    console.log(
      `${pg.padEnd(42)} ${(bytes / 1024).toFixed(0).padStart(5)} KB  carregou ${((Date.now() - t0) / 1000).toFixed(1)} s  maior conteúdo visível ${(lcp / 1000).toFixed(1)} s`,
    );
    await ctx.close();
  }
  await b.close();
})();
