# Contexto para o Claude Code

Projeto: portal estático sobre desempenho de parlamentares federais. Arquitetura aprovada: site estático regenerado diariamente.

## Regras
- Implemente apenas a story ativa em `docs/stories/`. Carregue PRD/arquitetura só nas seções que a story referenciar (lazy-load).
- TypeScript estrito em tudo. Testes com Vitest junto do código.
- Teto de custo: R$ 50/mês. Nada de servidor, banco em execução ou serviço pago novo sem decisão registrada em `docs/architecture/`.
- Textos de métricas saem de modelos fixos, sem IA. IA só para resumos de projetos e etiquetas de impacto.
- Nunca exibir CPF vindo das fontes.
- Trava: se o volume de dados cair mais de 30% de um dia para o outro, não publicar.

## Endpoints proibidos
- Câmara: `/despesas` (vazio) — usar arquivo `cotas/Ano-AAAA.json.zip`
- Senado: `/votacao` e `/autorias` (503)
