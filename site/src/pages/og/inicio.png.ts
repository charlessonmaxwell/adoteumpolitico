import type { APIRoute } from "astro";
import { imagemInicio } from "../../lib/og";

export const GET: APIRoute = async () =>
  new Response(new Uint8Array(await imagemInicio()), { headers: { "Content-Type": "image/png" } });
