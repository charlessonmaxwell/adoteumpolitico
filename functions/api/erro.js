/* global fetch, Response, crypto, TextEncoder, btoa, URLSearchParams */
/**
 * Recebe o formulário "Achou um erro?" e repassa para um Google Form (Cloudflare Pages Function, plano grátis).
 * Respostas na planilha "Erros - Adote um Político". O visitante só envia; não guarda IP, e-mail nem nada pessoal.
 * Valores públicos (aparecem no próprio link do Form); ERROS_FORM_ID / ERROS_CAMPOS no Cloudflare só sobrescrevem.
 */
const FORM_ID = "1FAIpQLSdHmsx3WJO5lGhkvo4kYZLClm_jgn0VK9GW3ffsv_0OPIfssA";
const CAMPOS = "entry.447320788,entry.1904711986,entry.1994705230"; // tipo, mensagem, página
const json = (status, corpo) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
const limpar = (s, max) =>
  String(s ?? "")
    // eslint-disable-next-line no-control-regex -- remove caracteres de controle
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, "")
    .trim()
    .slice(0, max);

// Limite por visitante: 5 envios a cada 10 minutos. Fica só na memória da Function (zera ao reiniciar);
// o IP vira um hash e nunca é gravado.
const LIMITE = 5;
const JANELA_MS = 10 * 60 * 1000;
const envios = new Map();
async function excedeuLimite(request) {
  const ip = request.headers.get("cf-connecting-ip") || "desconhecido";
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const chave = btoa(String.fromCharCode(...new Uint8Array(bytes))).slice(0, 16);
  const agora = Date.now();
  if (envios.size > 5000)
    for (const [k, v] of envios) if (agora - v.inicio > JANELA_MS) envios.delete(k);
  const atual = envios.get(chave);
  if (!atual || agora - atual.inicio > JANELA_MS) {
    envios.set(chave, { inicio: agora, total: 1 });
    return false;
  }
  atual.total += 1;
  return atual.total > LIMITE;
}

export async function onRequestPost({ request, env }) {
  if (await excedeuLimite(request))
    return json(429, {
      ok: false,
      erro: "Muitos envios seguidos. Tente de novo em alguns minutos.",
    });
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
  const campos = String(env.ERROS_CAMPOS || CAMPOS)
    .split(",")
    .map((c) => c.trim());
  const formId = env.ERROS_FORM_ID || FORM_ID;
  const corpo = new URLSearchParams();
  corpo.append(campos[0], tipo);
  corpo.append(campos[1], mensagem);
  corpo.append(campos[2], pagina);
  const r = await fetch(
    `https://docs.google.com/forms/d/e/${encodeURIComponent(formId)}/formResponse`,
    { method: "POST", body: corpo, redirect: "manual" },
  );
  if (r.status >= 400)
    return json(502, {
      ok: false,
      erro: "Não conseguimos registrar agora. Tente de novo em alguns minutos.",
    });
  return json(200, { ok: true });
}
