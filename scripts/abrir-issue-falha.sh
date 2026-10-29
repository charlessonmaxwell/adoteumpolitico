#!/usr/bin/env bash
# Abre (ou comenta, se já houver uma aberta) a issue de falha do pipeline.
set -euo pipefail
TITULO="$1"
CORPO="${2:-relatorio-falha.md}"
[ -f "$CORPO" ] || echo "Falha antes da coleta (instalação ou ambiente). Ver log: $RUN_URL" > "$CORPO"
echo -e "\n\nExecução: $RUN_URL" >> "$CORPO"
gh label create pipeline --color B60205 --description "Falha na atualização de dados" --force >/dev/null
ABERTA=$(gh issue list --label pipeline --state open --json number -q '.[0].number')
if [ -n "$ABERTA" ]; then
  gh issue comment "$ABERTA" --body-file "$CORPO"
else
  gh issue create --title "$TITULO" --label pipeline --body-file "$CORPO"
fi
