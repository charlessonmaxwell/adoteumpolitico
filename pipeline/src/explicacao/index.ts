import { createHash } from "node:crypto";
import { getBytes, getJson } from "../util/http.js";
import type { ProjetoVotado } from "../rotina/votos-por-projeto.js";

/**
 * Explicação popular de cada projeto votado.
 * Ordem: reaproveita a da última publicação (se o texto oficial não mudou) →
 * molde fixo (sem IA) → IA. Qualquer falha deixa o projeto sem explicação; a página sai igual.
 */

export const MODELO = "claude-haiku-5-5";
const LIMITE_TEXTO_COMPLETO = 24_000; // caracteres (~8 mil tokens; bem abaixo da faixa de preço de 100 mil)

export interface ProjetoComExplicacao extends ProjetoVotado {
  explicacao?: string;
  /** Impressão do texto oficial usado para gerar a explicação (refaz se mudar). */
  explicacaoBase?: string;
  explicacaoOrigem?: "molde" | "ia";
}

export const baseDe = (p: Pick<ProjetoVotado, "titulo" | "ementa">) =>
  createHash("sha256").update(`${p.titulo}\n${p.ementa}`).digest("hex").slice(0, 16);

const sigla = (titulo: string) => titulo.split(" ")[0]?.toUpperCase() ?? "";

/** Nome e cargo em indicações ("o nome do Senhor FULANO ..., para exercer o cargo de X"). */
function indicacao(ementa: string): { nome: string; cargo: string } | null {
  const nome =
    /(?:Senhora?|Sr\.?|Sra\.?|General de Exército)\s+([A-ZÀ-Ý][\p{L}.'-]*(?:\s+(?:de|da|do|das|dos|e|[A-ZÀ-Ý][\p{L}.'-]*))*)/u.exec(
      ementa,
    )?.[1];
  const m =
    /para (exercer o cargo de|o cargo de|compor o|compor a|ocupar o cargo de|exercer a função de)\s+([^,;]+?)(?:,|\.|;| na vaga| nos termos|$)/i.exec(
      ementa,
    );
  const artigo = m?.[1]?.toLowerCase().startsWith("compor") ? `${m[1].slice(-1)} ` : "";
  const cargo = m?.[2] ? artigo + m[2].replace(/\s+e$/, "") : undefined;
  if (!nome) return null;
  const nomeBonito = nome
    .trim()
    .replace(/\s+(de|da|do|das|dos|e)$/i, "")
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, e: string, l: string) => e + l.toUpperCase())
    .replace(/ (De|Da|Do|Das|Dos|E) /g, (m) => m.toLowerCase());
  return { nome: nomeBonito, cargo: (cargo ?? "um cargo público").trim() };
}

/** Explicação por molde fixo para tipos previsíveis; null quando precisa de IA. */
export function moldeFixo(p: Pick<ProjetoVotado, "titulo" | "ementa" | "casa">): string | null {
  const s = sigla(p.titulo);
  const quem = p.casa === "senado" ? "Senadores" : "Deputados";
  if (
    ["MSF", "OFS"].includes(s) ||
    /submete à apreciação do senado federal.*(nome|indicação)/i.test(p.ementa)
  ) {
    const i = indicacao(p.ementa);
    if (!i) return null;
    return `${quem} votaram a indicação de ${i.nome} para ${i.cargo}. A indicação vem de fora do Senado (do presidente da República ou de outro órgão), mas o Senado precisa aprovar.`;
  }
  if (s === "PDL" && /^escolhe (o|a) senhora?/i.test(p.ementa)) {
    const i = indicacao(p.ementa);
    if (!i) return null;
    return `${quem} votaram a escolha de ${i.nome} para ${i.cargo}. Essa vaga é indicada pelo Congresso.`;
  }
  if (["REQ", "RQS"].includes(s)) {
    const alvo =
      /(?:Proposta de Emenda à Constituição|Projeto de Lei[^n]*|PEC|PL)\s*n?º?\s*[\d./]+/i.exec(
        p.ementa,
      )?.[0];
    return `É um pedido sobre o andamento da votação${alvo ? ` (${alvo})` : ""}, como acelerar ou mudar a ordem. Não muda nenhuma lei por si só.`;
  }
  if (
    /^institui (o|a)?\s*(dia|semana|mês|mes|ano)\b|\bcomo (o )?(dia|mês|mes|semana) (nacional )?d/i.test(
      p.ementa,
    ) &&
    p.ementa.length < 200
  ) {
    return "Cria uma data no calendário oficial, para campanhas e conscientização. É uma lei simbólica: não cria benefício nem gasto direto.";
  }
  return null;
}

/** Ementa que não diz o que muda (ex.: "Altera a Lei nº 9.605, de 1998."). */
export const ementaVaga = (ementa: string) =>
  ementa.length < 90 && /^altera\b/i.test(ementa.trim());

// Palavras de opinião, só em minúscula e como palavra inteira ("Boa Vista" e "Bombeiros" passam)
const PROIBIDAS =
  /(?<![\p{L}])(bom|boa|ruim|polêmic[oa]s?|absurd[oa]s?|important(e|es|íssim[oa])|excelente|péssim[oa]|vergonh\p{L}*|histórico|injust[oa])(?![\p{L}])/u;

export const PROMPT = `Você explica projetos de lei do Congresso brasileiro para o povo, em português simples.
Regras:
- No máximo 3 frases curtas, até 450 caracteres no total.
- Diga o que muda na prática e quem é afetado.
- Sem opinião, sem adjetivos de valor (bom, ruim, polêmico, importante), sem citar partidos ou políticos.
- Não invente: use só o que está no texto. Se o texto não disser o que muda, responda exatamente: SEM_INFORMACAO
- Não repita o número do projeto. Responda só com a explicação, sem título.`;

export type ChamarIA = (texto: string) => Promise<string>;

export function chamarIAReal(chave: string, fetcher: typeof fetch = fetch): ChamarIA {
  return async (texto) => {
    const r = await fetcher("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 300,
        system: PROMPT,
        messages: [{ role: "user", content: texto }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new Error(`IA respondeu ${r.status}`);
    const j = (await r.json()) as { content?: { type: string; text?: string }[] };
    return (j.content ?? [])
      .map((c) => c.text ?? "")
      .join("")
      .trim();
  };
}

/** Texto completo do projeto da Câmara (PDF do inteiro teor). Null se indisponível. */
export async function textoCompletoCamara(idProjeto: string): Promise<string | null> {
  const id = idProjeto.replace(/^camara-/, "");
  const d = await getJson<{ dados?: { urlInteiroTeor?: string } }>(
    `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${id}`,
    { tentativas: 2 },
  );
  const url = d.dados?.urlInteiroTeor;
  if (!url) return null;
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(await getBytes(url, { tentativas: 2 }));
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text).replace(/\s+/g, " ").slice(0, LIMITE_TEXTO_COMPLETO) || null;
}

/** Resposta da IA aceitável para publicar? */
export function validarExplicacao(t: string): string | null {
  const s = t.replace(/\s+/g, " ").trim();
  if (!s || s.includes("SEM_INFORMACAO") || s.length > 600 || PROIBIDAS.test(s)) return null;
  return s;
}

export interface OpcoesExplicar {
  anteriores: Map<string, ProjetoComExplicacao>;
  ia?: ChamarIA | null;
  textoCompleto?: (id: string) => Promise<string | null>;
  maxIA?: number;
  paralelo?: number;
  log?: (m: string) => void;
}

export async function explicarProjetos(
  projetos: ProjetoVotado[],
  o: OpcoesExplicar,
): Promise<{ projetos: ProjetoComExplicacao[]; contagem: Record<string, number> }> {
  const cont = { reaproveitadas: 0, molde: 0, ia: 0, falhas: 0, pendentes: 0 };
  const saida: ProjetoComExplicacao[] = [];
  const fila: ProjetoComExplicacao[] = [];
  for (const p of projetos) {
    const base = baseDe(p);
    const ant = o.anteriores.get(p.id);
    if (ant?.explicacao && ant.explicacaoBase === base) {
      saida.push({
        ...p,
        explicacao: ant.explicacao,
        explicacaoBase: base,
        explicacaoOrigem: ant.explicacaoOrigem,
      });
      cont.reaproveitadas++;
      continue;
    }
    const m = moldeFixo(p);
    const novo: ProjetoComExplicacao = m
      ? { ...p, explicacao: m, explicacaoBase: base, explicacaoOrigem: "molde" }
      : { ...p };
    if (m) cont.molde++;
    else fila.push(novo);
    saida.push(novo);
  }

  const max = o.maxIA ?? 1500;
  if (!o.ia) cont.pendentes = fila.length;
  else {
    const ia = o.ia;
    const lote = fila.slice(0, max);
    cont.pendentes = fila.length - lote.length;
    let i = 0;
    const trabalhador = async () => {
      while (i < lote.length) {
        const p = lote[i++]!;
        try {
          let texto = `Projeto: ${p.titulo}\nEmenta oficial: ${p.ementa}`;
          if (ementaVaga(p.ementa) && p.casa === "camara" && o.textoCompleto) {
            const completo = await o.textoCompleto(p.id).catch(() => null);
            if (completo) texto += `\n\nTexto completo do projeto (trecho):\n${completo}`;
          }
          const ok = validarExplicacao(await ia(texto));
          if (ok) {
            p.explicacao = ok;
            p.explicacaoBase = baseDe(p);
            p.explicacaoOrigem = "ia";
            cont.ia++;
          } else cont.falhas++;
        } catch {
          cont.falhas++;
        }
      }
    };
    await Promise.all(Array.from({ length: o.paralelo ?? 4 }, trabalhador));
  }
  o.log?.(
    `Explicações: ${cont.reaproveitadas} reaproveitadas, ${cont.molde} por molde, ${cont.ia} pela IA, ${cont.falhas} sem explicação, ${cont.pendentes} pendentes`,
  );
  return { projetos: saida, contagem: cont };
}
