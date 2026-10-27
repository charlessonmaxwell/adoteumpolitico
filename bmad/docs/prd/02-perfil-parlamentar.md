# Épico 2 — Busca e perfil do parlamentar

## Objetivo
O eleitor encontra seu parlamentar em segundos e vê um resumo simples do mandato.

## Stories
### 2.1 Buscar parlamentar
Como eleitor, quero buscar por nome, estado ou partido, para achar meu deputado ou senador.
- CA1: busca tolera erro de digitação e nome parcial
- CA2: filtro por UF mostra a bancada do estado

### 2.2 Página de perfil
Como eleitor, quero uma página única do parlamentar, com um resumo de cada métrica, para entender o mandato de relance.
- CA1: exibe foto, nome, partido, UF, casa e um bloco-resumo de cada épico (3 a 6)
- CA2: nenhum texto com nota, ranking ou adjetivo sobre o parlamentar
- CA3: cada bloco linka para o detalhe

### 2.3 Textos em linguagem popular
Como eleitor, quero que números venham explicados em frases simples.
- CA1: cada métrica tem frase explicativa gerada a partir de modelo de texto (ex.: "faltou 12 de 100 sessões")
- CA2: termos técnicos (ex.: "sessão deliberativa") têm explicação ao tocar/passar o mouse

### 2.4 Compartilhar perfil
- CA1: link do perfil gera prévia com nome e foto ao ser compartilhado

### 2.5 Medição de visitas
- CA1: visitas e usuários únicos medidos por página, sem coletar dados pessoais

## Dependências
Épico 1.
