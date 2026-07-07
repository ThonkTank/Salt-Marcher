#!/usr/bin/env bash
set -euo pipefail

labels=(
  "risk:R0|6A737D|Risk R0 docs/comments/small reversible refactor"
  "risk:R1|0E8A16|Risk R1 behavior-neutral structure"
  "risk:R2|1D76DB|Risk R2 visible behavior"
  "risk:R3a|B60205|Risk R3a local data migration"
  "risk:R3b|D93F0B|Risk R3b external service or cost"
  "risk:R3c|5319E7|Risk R3c frozen gate surface"
  "judge-override|FBCA04|Owner-only judge override"
  "abnahme-offen|FBCA04|Owner acceptance pending"
  "abnahme-ok|0E8A16|Owner accepted"
  "abnahme-abgelehnt|B60205|Owner rejected acceptance"
  "owner-feedback|1D76DB|Owner feedback item"
  "security|B60205|Security issue"
  "ux|5319E7|User experience issue"
  "explorer-finding|1D76DB|System-generated exploratory smoke finding"
  "prio:P1|B60205|Priority P1"
  "prio:P2|D93F0B|Priority P2"
  "task:feature|1D76DB|Autonomous task class: feature"
  "task:bug|B60205|Autonomous task class: bug"
  "task:architecture|5319E7|Autonomous task class: architecture"
  "task:quality|0E8A16|Autonomous task class: quality"
  "task:performance|D93F0B|Autonomous task class: performance"
  "task:consolidation|0E8A16|Autonomous task class: consolidation"
  "task:docs|6A737D|Autonomous task class: docs"
  "task:verification|1D76DB|Autonomous task class: verification"
  "task:governance|5319E7|Autonomous task class: governance"
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

looper_label_file="tools/looper-system/config/github-labels.tsv"
if [[ -f "$looper_label_file" ]]; then
  while IFS=$'\t' read -r name color description; do
    [[ -n "$name" && "$name" != \#* ]] || continue
    if gh label create "$name" --color "$color" --description "$description"; then
      echo "created $name"
    else
      gh label edit "$name" --color "$color" --description "$description"
      echo "updated $name"
    fi
  done < "$looper_label_file"
fi
