# Épico 4 — Gastos da cota parlamentar

## Objetivo
Mostrar quanto e com o que o parlamentar gasta da cota para exercício da atividade parlamentar.

## Stories
### 4.1 Resumo de gastos
- CA1: total gasto no período e por categoria (passagens, combustível, divulgação etc.)
- CA2: comparação neutra com a média da casa
- CA3: equivalência popular opcional (ex.: "equivale a X salários mínimos"), sempre com o valor exato ao lado

### 4.2 Detalhe das despesas
- CA1: lista de despesas com fornecedor, valor e data
- CA2 (Câmara): link para o documento fiscal quando disponível (~94% das despesas)
- CA3 (Senado): sem link — exibir "documento não disponibilizado pelo Senado" (campo não existe na fonte)
- CA4: maiores fornecedores destacados (dado, sem acusação)
- CA5: CPF do parlamentar presente na fonte nunca é exibido

### 4.3 Validação de qualidade
- CA1: despesas com data futura ou inválida não entram nos totais até a correção na origem; ficam registradas para auditoria

## Fontes (confirmadas em 27/10/2026)
- Câmara: arquivo anual `camara.leg.br/cotas/Ano-AAAA.json.zip` (endpoint da API está vazio)
- Senado: API CEAPS `adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/{ano}`

## Dependências
Épicos 1 e 2.
