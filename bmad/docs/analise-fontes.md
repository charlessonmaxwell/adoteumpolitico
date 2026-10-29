# Análise de Fontes de Dados — teste real em 27/10/2026

Consultas feitas direto nas APIs oficiais (navegador), não em documentação de terceiros.

## Câmara dos Deputados (dadosabertos.camara.leg.br/api/v2)
| Dado | Resultado | Situação |
|---|---|---|
| Cadastro | 513 deputados; nome, partido, UF, foto, e-mail | ✅ OK |
| Votos individuais (endpoint) | Funciona para votações recentes (ex.: 14/10/2026 com 429 e 466 votos). Hipótese de "vazio após 05/2024" **refutada** | ✅ OK |
| Votações nominais | Plenário set–out/2026: 80 votações, só **6 nominais** (resto simbólicas, sem voto individual) | ⚠️ Limitação estrutural |
| Arquivo em lote de votos 2026 | Disponível, atualizado hoje (06:56) | ✅ Melhor via de ingestão |
| Presença (API `/eventos`) | Conta **98** sessões deliberativas em 2025 contra **127** do critério oficial (Ato da Mesa 191/2017) — números divergiriam do site da Câmara | ❌ Não usar (29/10/2026) |
| Presença + justificativa (página HTML) | `camara.leg.br/deputados/{id}/presenca-plenario/{ano}`: uma linha por sessão (Presença / Ausência / motivo oficial) + quadro de totais oficiais. 513 páginas, semanal | ✅ Fonte principal (frágil a mudança de layout; trava de 20%) |
| Gastos da cota (endpoint) | **0 registros** para 18 deputados testados, anos 2023–2026 | ❌ Endpoint vazio |
| Gastos (arquivo em lote) | `camara.leg.br/cotas/Ano-AAAA.{csv,json}.zip` — 2026: 4,4 MB (csv) / 5,5 MB (json), atualizado hoje 06:34. Conteúdo 2026: 118.851 despesas, 565 parlamentares (inclui suplentes/ex), **94% com URL do documento fiscal**. Contém CPF do parlamentar — não exibir | ✅ Via oficial de ingestão |
| Proposições por autor | API lista sem situação e sem autor/coautor → **usar arquivos em lote** `proposicoes-AAAA.json` + `proposicoesAutores-AAAA.json` (2026: 47 mil proposições, 59 mil autorias, ~3 s) | ✅ Via arquivos (28/10/2026) |

## Senado Federal (legis.senado.leg.br/dadosabertos)
| Dado | Resultado | Situação |
|---|---|---|
| Cadastro | 81 senadores; foto, partido, UF, bloco | ✅ OK |
| Votos por senador | 426 votos de um senador, último em 15/10/2026 | ✅ OK (resposta pesada: ~900 KB por senador) |
| Votações do plenário | OK; out/2026: 3 votações nominais, nenhuma secreta | ✅ OK |
| Projetos por autor (`/processo`) | 389 processos de um senador; ementa, situação, datas | ✅ OK |
| `/votacao` | Funcionando em 29/10/2026 (~0,3 s). Substituto oficial dos endpoints de votação descontinuados; 1 chamada por ano traz votações + votos dos 81 | ✅ Usar |
| `/autorias` | Erro 503 | ⚠️ Não usar |
| `/plenario/lista/votacao` e `/senador/{cod}/votacoes` | Marcados como descontinuados pelo próprio Senado (desativação completa anunciada para 01/02/2026) | ❌ Não usar |
| Gastos (CEAPS) | API `adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/{ano}` (JSON e CSV). 2026: 15.933 despesas, 89 senadores (inclui suplentes/ex), campos: tipo, fornecedor, CNPJ, data, valor, detalhamento | ✅ OK — atenção: há data de documento futura (30/10/2026), exige validação |

| Presença | **Não existe por sessão.** Só comparecimento em votações nominais, com tipos (Atividade parlamentar, Comunicação de ausência, Afastamento etc.) + lista de licenças (`/senador/{codigo}/licencas`) | ⚠️ Métrica diferente da Câmara |
| Link do documento fiscal (CEAPS) | Campo inexistente | ❌ Não exibível |

## Volume de votações — ano de 2025 (medido)
| Casa | Votações no plenário | Nominais (voto individual) | Nominais com tema econômico* | Proposições/matérias distintas |
|---|---|---|---|---|
| Câmara | 2.041 | 429 (21%) | 69 | 25 (com algum ruído do filtro) |
| Senado | — | 128, das quais 72 secretas (autoridades) → 56 abertas | não classificado (API não traz ementa na lista) | 39 matérias abertas no total; parte econômica estimada em ~10 |

*Filtro por palavras-chave na ementa (imposto, tributo, renda, crédito, dívida, fiscal, previdência etc.). Inclui falsos positivos; exige revisão.

Leitura: cada proposição relevante gera várias votações nominais (texto-base + destaques). A unidade certa para o épico 6 é a **proposição**, não a votação: ~25–35 proposições econômicas/ano somando as duas casas.

## IFI / impacto econômico
Notas técnicas em PDF, sem API. Não verificado em volume. Hipótese mantida: cobertura baixa.

## Impacto nos épicos
- Épico 1 (fundação): viável; usar arquivos em lote da Câmara em vez de endpoint por endpoint
- Épico 3 (votações): viável, mas o eleitor só verá voto individual em votações nominais (poucas)
- Épico 4 (gastos): **viável** — Câmara via arquivo em lote anual (endpoint vazio), Senado via API CEAPS; dois formatos a unificar + regra de validação de datas
- Épico 5 (projetos): viável; precisa regra de filtro de tipos
- Épico 6 (impacto): depende de votações nominais (poucas) + fonte em PDF — o mais frágil
