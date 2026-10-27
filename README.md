# Meu Político de Estimação

Portal público que mostra, em linguagem simples, o desempenho de cada deputado federal e senador: presença, votos, gastos da cota e projetos — sempre com a fonte oficial.

## Como funciona
Site estático regenerado todo dia às 06:00 (horário de Brasília). Sem servidor e sem banco de dados em execução.

```
GitHub Actions (cron diário)
  1. Coleta        → APIs e arquivos da Câmara e do Senado
  2. Tratamento    → normaliza, valida, agrega por parlamentar (JSON)
  3. Enriquecimento → IA só em itens novos (resumos e etiquetas)
  4. Build         → Astro gera ~600 páginas + índice Pagefind
  5. Deploy        → Cloudflare Pages
```

## Stack
TypeScript (Node 22) · Astro · Pagefind · GitHub Actions · Cloudflare Pages · Claude Haiku · Cloudflare Web Analytics

## Custo-alvo
~R$ 10–20/mês (teto: R$ 50/mês).

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `pipeline/` | coleta, tratamento, enriquecimento e trava de qualidade |
| `data/` | JSON gerado pelo pipeline (não versionado) |
| `src/` | site Astro |
| `docs/` | brief, PRD, arquitetura e stories (BMAD) |
| `.github/workflows/` | rotina diária |

## Rodar localmente
```bash
npm install
npm run pipeline   # coleta e trata os dados
npm run dev        # site em http://localhost:4321
```

## Fontes
Dados Abertos da Câmara dos Deputados e Dados Abertos do Senado Federal. Encontrou erro? Abra uma issue.

## Licença
MIT
