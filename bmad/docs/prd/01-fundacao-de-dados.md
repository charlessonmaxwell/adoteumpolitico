# Épico 1 — Fundação de dados

## Objetivo
Coletar e manter atualizados, de forma automática, os dados oficiais de todos os parlamentares federais. Habilita todos os demais épicos.

## Stories
### 1.1 Coletar cadastro de parlamentares
Como sistema, quero importar os 513 deputados e 81 senadores em exercício, para servir de base ao portal.
- CA1: nome, partido, UF, foto oficial e casa legislativa importados
- CA2: mudanças (licença, suplente assumiu) refletidas na próxima atualização

### 1.2 Coletar presença e votações
- CA1: presença em sessões deliberativas e voto nominal por parlamentar importados
- CA2: cada registro guarda link da fonte e data de coleta

### 1.3 Coletar gastos da cota parlamentar
- CA1: despesas por parlamentar, categoria, fornecedor, valor e data importadas
- CA2: link para o documento fiscal quando disponível

### 1.4 Coletar projetos apresentados
- CA1: proposições de autoria/coautoria, ementa e situação de tramitação importadas

### 1.5 Atualização automática diária
- CA1: rotina roda sozinha ao menos 1x/dia
- CA2: falha de coleta gera alerta e mantém o último dado válido no ar, com data visível

## Dependências
Fontes confirmadas em 27/10/2026 (detalhe em `docs/analise-fontes.md`):
- Câmara: API v2 (cadastro, proposições, eventos), arquivos em lote (votos e cota parlamentar), página HTML de presença (justificativas)
- Senado: API legislativa (cadastro, votos, processos, licenças) e API administrativa (CEAPS)
- Endpoints instáveis (Senado `/votacao`, `/autorias`: 503) não devem ser usados; endpoint de despesas da Câmara está vazio
