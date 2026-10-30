import { cidadesEmendas } from "../lib/dados";

/** Lista compacta para a busca de cidades (baixada só na página /cidades). */
export function GET() {
  const lista = cidadesEmendas().map((c) => [c.id, c.nome, c.uf]);
  return new Response(JSON.stringify(lista), { headers: { "content-type": "application/json" } });
}
