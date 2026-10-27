# Arquitetura — Visão Geral

## Decisão
**Site estático regenerado diariamente.** Sem servidor de aplicação e sem banco de dados em execução.

## Restrições que definiram a escolha
- Custo de operação ≤ R$ 50/mês
- Desenvolvimento e manutenção por 1 pessoa com Claude Code
- Fontes oficiais atualizam 1x/dia (arquivos gerados de madrugada) → tempo real não agrega valor
- Tráfego imprevisível (picos via WhatsApp) não pode gerar custo nem queda

## Diagrama
```
[06:00 diário] GitHub Actions
   │
   ├─ 1. Coleta ──────► Câmara: API v2 + arquivos em lote (votos, cota) + HTML presença (semanal)
   │                    Senado: API legislativa + API CEAPS
   ├─ 2. Tratamento ──► normaliza, valida, agrega por parlamentar → JSON
   ├─ 3. Enriquecimento IA (só itens novos) ──► resumos populares + etiquetas épico 6
   ├─ 4. Build ───────► Astro gera ~600 páginas + índice de busca
   └─ 5. Deploy ──────► Cloudflare Pages (CDN)
                              │
                         Eleitor (web responsiva)
```

## Stack
| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | TypeScript (Node 22) em tudo | Uma linguagem só: menos contexto para o Claude Code, manutenção mais barata |
| Site | Astro (geração estática) | Páginas leves, ótimo em celular, sem servidor |
| Busca | Pagefind (índice estático no navegador) | 594 parlamentares: instantâneo e sem custo |
| Rotinas | GitHub Actions (cron) | Gratuito em repositório público |
| Hospedagem | Cloudflare Pages | Banda ilimitada no plano gratuito; absorve picos |
| IA | Claude Haiku via API | Volume pequeno e tarefa simples (resumo/rotulagem) |
| Métricas | Cloudflare Web Analytics | Gratuito, sem cookies, conta visitantes únicos |
| Fila de revisão e "reportar erro" | GitHub Issues | Sem sistema extra para manter |

## Alternativas descartadas
- **Next.js + Supabase:** banco em execução; plano gratuito estoura com ~120 mil despesas/ano da Câmara + Senado
- **VPS própria:** R$ 30–60/mês e manutenção de servidor (segurança, backup, atualização)

## Componentes (arquivos)
- `01-pipeline-dados.md` — coleta, tratamento, armazenamento
- `02-site.md` — páginas, busca, responsividade
- `03-ia.md` — resumos populares e etiquetas de impacto
- `04-custos-riscos.md` — custo mensal e riscos
