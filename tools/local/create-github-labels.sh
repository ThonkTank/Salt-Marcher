#!/usr/bin/env bash
set -euo pipefail

labels=(
  "risk:R0|6A737D|Risk R0 docs/comments/small reversible refactor"
  "risk:R1|0E8A16|Risk R1 behavior-neutral structure"
  "risk:R2|1D76DB|Risk R2 visible behavior"
  "risk:R3a|B60205|Risk R3a local data migration"
  "risk:R3b|D93F0B|Risk R3b external service or cost"
  "risk:R3c|5319E7|Risk R3c frozen gate surface"
  "gate-change-approved|000000|Owner key turn for frozen gate surfaces"
  "judge-override|FBCA04|Owner-only judge override"
  "abnahme-offen|FBCA04|Owner acceptance pending"
  "abnahme-ok|0E8A16|Owner accepted"
  "abnahme-abgelehnt|B60205|Owner rejected acceptance"
  "owner-feedback|1D76DB|Owner feedback item"
  "security|B60205|Security issue"
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
