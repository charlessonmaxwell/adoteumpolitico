# Contexto para o Claude Code

Portal estático sobre desempenho de parlamentares federais. Arquitetura: site estático regenerado diariamente (sem servidor/banco em execução). Teto de custo: R$ 50/mês.

## Como trabalhar

- Assuma a persona `bmad/agents/dev.md` e implemente só a story ativa em `bmad/stories/` (status em `bmad/stories/index.md`).
- Carregue PRD e arquitetura apenas nas seções que a story listar em "Referências" (lazy-load).
- Antes de concluir: `pnpm test`, `pnpm lint`, `pnpm typecheck`.
- Commits pequenos, um por tarefa da story.

## Regras fixas

- Fontes só as de `bmad/docs/analise-fontes.md`. Proibido: Câmara `/despesas` (vazio); Senado `/autorias` (503) e os descontinuados `/plenario/lista/votacao` e `/senador/{cod}/votacoes` (usar `/votacao`).
- Nunca persistir CPF, e-mail, telefone ou outro dado pessoal das fontes.
- Textos de métricas por modelos fixos; IA só para resumos de projetos e etiquetas de impacto.
- Dúvida não coberta pela story → parar e perguntar.
