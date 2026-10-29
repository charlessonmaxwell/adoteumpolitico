#!/usr/bin/env bash
# Publica o conteúdo de uma pasta na branch `data` como um único commit (sem histórico).
# Motivo: os dados mudam todo dia (~centenas de MB brutos); com histórico o repositório
# cresceria vários GB por ano. Os dados são reproduzíveis a partir das fontes oficiais.
set -euo pipefail
DIR="$1"
MSG="$2"
cd "$DIR"
rm -rf .git
git init -q -b data
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -qm "$MSG"
git push -qf "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" data
echo "Publicado na branch data: $MSG"
