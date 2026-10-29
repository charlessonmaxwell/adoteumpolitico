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

## Decisão revisada em 29/10/2026: manter sem banco em execução
Questionada pelo usuário ("precisamos consultar"). Mantida, porque:
- dados mudam 1x/dia na fonte; consulta pré-calculada às 6h vale o dia todo (carga só de leitura)
- geração das ~650 páginas leva ~2 s (lote automático, sem trabalho manual)
- busca do eleitor roda no navegador sobre índice de ~45 KB
- dados tratados somam ~515 MB: banco hospedado estouraria planos gratuitos (~R$ 140/mês vs. teto de R$ 50)
- CDN absorve picos de acesso; nada para invadir; mantém a última versão boa se a fonte quebrar

**Necessidade registrada:** o usuário quer analisar os dados com consultas livres. **Opção B (pós-MVP, custo zero):** a rotina diária passa a publicar também um arquivo SQLite com todos os dados, consultável com SQL (DB Browser ou via Claude).

**Gatilho para banco em execução (opção C):** funcionalidade com escrita ou estado por usuário (login, alertas, comentários) ou consulta livre sobre os detalhes no próprio site.
