import { defineConfig } from "astro/config";

export default defineConfig({
  srcDir: "./site/src",
  publicDir: "./site/public",
  outDir: "./site/dist",
  output: "static",
  trailingSlash: "always",
  site: process.env.SITE_URL ?? "https://adoteumpolitico.pages.dev",
});
