/* global fetch, Response */
/**
 * Recebe o formulário "Achou um erro?" e abre uma issue no GitHub (Cloudflare Pages Function, plano grátis).
 * Não guarda IP, e-mail nem nada pessoal. Segredo: ERROS_GITHUB_TOKEN (fine-grained, só "Issues: write" no repositório).
 */
const REPO = "charlessonmaxwell/adoteumpolitico";
const json = (status, corpo) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
const limpar = (s, max) =>
  String(s ?? "")
    // eslint-disable-next-line no-control-regex -- remove caracteres de controle
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, "")
    .replace(/@/g, "@​") // não notifica ninguém por menção
    .trim()
    .slice(0, max);

export async function onRequestPost({ request, env }) {
  let d;
  try {
    d = await request.json();
  } catch {
    return json(400, { ok: false, erro: "Envio inválido." });
  }
  // Robôs: campo escondido preenchido ou envio rápido demais
  if (d.site || Date.now() - Number(d.inicio) < 3000) return json(200, { ok: true });
  const mensagem = limpar(d.mensagem, 3000);
  const pagina = limpar(d.pagina, 300);
  const tipo = limpar(d.tipo, 60) || "Outro";
  if (mensagem.length < 10)
    return json(400, { ok: false, erro: "Conte um pouco mais (pelo menos 10 letras)." });
  if (!env.ERROS_GITHUB_TOKEN) return json(503, { ok: false, erro: "indisponivel" });

  const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.ERROS_GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "adoteumpolitico-formulario",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: `[Visitante] ${tipo}: ${mensagem.slice(0, 60)}${mensagem.length > 60 ? "…" : ""}`,
      body: `**Página:** ${pagina || "não informada"}\n**Tipo:** ${tipo}\n\n${mensagem}\n\n---\n_Enviado pelo formulário "Achou um erro?" do site. Nenhum dado pessoal é coletado._`,
      labels: ["erro-reportado"],
    }),
  });
  if (!r.ok)
    return json(502, {
      ok: false,
      erro: "Não conseguimos registrar agora. Tente de novo em alguns minutos.",
    });
  return json(200, { ok: true });
}
