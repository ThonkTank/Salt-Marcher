#!/usr/bin/env bash
set -euo pipefail

labels=(
  "abnahme-offen|FBCA04|Owner acceptance pending"
  "abnahme-ok|0E8A16|Owner accepted"
  "abnahme-abgelehnt|B60205|Owner rejected acceptance"
  "owner-feedback|1D76DB|Owner feedback item"
  "security|B60205|Security issue"
  "ux|5319E7|User experience issue"
)

for entry in "${labels[@]}"; do
  IFS='|' read -r name color description <<< "$entry"
  if gh label create "$name" --color "$color" --description "$description"; then
    echo "created $name"
  else
    gh label edit "$name" --color "$color" --description "$description"
    echo "updated $name"
  fi
done
