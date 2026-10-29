import type { APIRoute } from "astro";
import { dados, cargo } from "../../lib/dados";
import { pelaUf } from "../../lib/formato";
import { fotoComoDataUri, imagemPerfil } from "../../lib/og";

export function getStaticPaths() {
  return dados().resumos.map((r) => ({ params: { id: r.parlamentar.id }, props: { p: r.parlamentar } }));
}

export const GET: APIRoute = async ({ props }) => {
  const p = (props as { p: ReturnType<typeof dados>["resumos"][number]["parlamentar"] }).p;
  const png = await imagemPerfil({
    nome: p.nome,
    linhaCargo: `${cargo(p)} ${pelaUf(p.uf)}`,
    partido: p.partido,
    foto: await fotoComoDataUri(p.urlFoto),
  });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
