/**
 * Imagem de prévia (Open Graph) por perfil — story 2.4.
 * Só nome, foto, cargo, UF e partido. Sem números, para não circular recorte fora de contexto.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { iniciais } from "./formato.js";

const require = createRequire(import.meta.url);
const fonte = (pkg: string) => readFileSync(require.resolve(pkg));
const FONTES = [
  {
    name: "Archivo",
    data: fonte("@fontsource/archivo/files/archivo-latin-800-normal.woff"),
    weight: 800 as const,
    style: "normal" as const,
  },
  {
    name: "Lexend",
    data: fonte("@fontsource/lexend/files/lexend-latin-400-normal.woff"),
    weight: 400 as const,
    style: "normal" as const,
  },
];

const COR = {
  fundo: "#0e6b73",
  fundoEscuro: "#0b5a61",
  papel: "#eef2f1",
  tinta: "#ffffff",
  suave: "#cfe7e8",
  destaque: "#dcefef",
};

type No = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): No => ({
  type,
  props: {
    style: { display: "flex", ...style },
    children: children.length === 1 ? children[0] : children,
  },
});

/** Baixa a foto oficial e devolve como data URI; null se falhar (usa iniciais). */
export async function fotoComoDataUri(
  url: string | null,
  timeoutMs = 5000,
): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "image/jpeg";
    if (!tipo.startsWith("image/")) return null;
    return `data:${tipo};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export interface DadosPrevia {
  nome: string;
  linhaCargo: string;
  partido: string;
  foto: string | null;
}

export async function imagemPerfil(d: DadosPrevia): Promise<Buffer> {
  const tamanhoNome = d.nome.length > 22 ? 76 : d.nome.length > 16 ? 88 : 104;
  const foto = d.foto
    ? {
        type: "img",
        props: {
          src: d.foto,
          width: 330,
          height: 412,
          style: { objectFit: "cover", borderRadius: 24 },
        },
      }
    : h(
        "div",
        {
          width: 330,
          height: 412,
          borderRadius: 24,
          background: COR.fundoEscuro,
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Archivo",
          fontSize: 120,
          color: COR.suave,
        },
        iniciais(d.nome),
      );

  const arvore = h(
    "div",
    {
      width: 1200,
      height: 630,
      background: COR.fundo,
      padding: 64,
      gap: 56,
      alignItems: "center",
      fontFamily: "Lexend",
      color: COR.tinta,
    },
    foto,
    h(
      "div",
      { flexDirection: "column", flex: 1, height: 502, justifyContent: "space-between" },
      h("div", { fontSize: 28, color: COR.suave }, "Adote um Político"),
      h(
        "div",
        { flexDirection: "column", gap: 16 },
        h("div", { fontSize: 32, color: COR.destaque }, d.linhaCargo),
        h(
          "div",
          { fontFamily: "Archivo", fontSize: tamanhoNome, lineHeight: 0.95, letterSpacing: -2 },
          d.nome,
        ),
        h("div", { fontSize: 34, color: COR.destaque }, `Partido: ${d.partido}`),
      ),
      h(
        "div",
        {
          background: COR.papel,
          color: COR.fundoEscuro,
          borderRadius: 999,
          padding: "16px 32px",
          fontSize: 32,
          alignSelf: "flex-start",
        },
        "Veja o que fez no mandato",
      ),
    ),
  );
  return renderizar(arvore);
}

export async function imagemInicio(): Promise<Buffer> {
  const linha = (texto: string, estilo: Record<string, unknown>) =>
    h("div", { width: 1072, ...estilo }, texto);
  const arvore = h(
    "div",
    {
      width: 1200,
      height: 630,
      background: COR.fundo,
      padding: 64,
      flexDirection: "column",
      fontFamily: "Lexend",
      color: COR.tinta,
    },
    linha("Adote um Político", { fontSize: 30, color: COR.suave, marginBottom: 150 }),
    linha("Votou,", {
      fontFamily: "Archivo",
      fontSize: 86,
      lineHeight: 1,
      letterSpacing: -3,
    }),
    linha("agora fiscalize e cobre.", {
      fontFamily: "Archivo",
      fontSize: 86,
      lineHeight: 1,
      letterSpacing: -3,
      marginBottom: 28,
    }),
    linha("Político não é time de futebol: não é pra torcer, é pra cobrar.", {
      fontSize: 34,
      color: COR.destaque,
    }),
  );
  return renderizar(arvore);
}

async function renderizar(arvore: No): Promise<Buffer> {
  const svg = await satori(arvore as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: FONTES,
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}
