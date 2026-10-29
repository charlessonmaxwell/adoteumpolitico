# Adote um Político

Portal público que mostra, em linguagem simples, o que cada deputado federal e senador faz no mandato: presença, votos, gastos e projetos, a partir de dados oficiais da Câmara e do Senado.

## Princípio de neutralidade

- O portal mostra **fatos com fonte**. Nunca dá nota, ranking ou adjetivo a um parlamentar.
- Todo dado tem link para a origem oficial e a data em que foi coletado.
- Quando a fonte não tem a informação (por exemplo, voto individual em votação simbólica), o portal diz isso explicitamente.

## Fontes

- [Dados Abertos da Câmara dos Deputados](https://dadosabertos.camara.leg.br)
- [Dados Abertos do Senado Federal](https://legis.senado.leg.br/dadosabertos)
- API administrativa do Senado (CEAPS)

Detalhes e limitações confirmadas: `bmad/docs/analise-fontes.md`.

## Desenvolvimento

```bash
pnpm install
pnpm test        # testes (usam respostas gravadas, sem chamar as APIs)
pnpm lint        # ESLint + Prettier
pnpm typecheck   # TypeScript

pnpm coleta:parlamentares   # coleta real: gera data/parlamentares.json
```

Planejamento do projeto (brief, PRD, arquitetura, stories): pasta `bmad/`.
