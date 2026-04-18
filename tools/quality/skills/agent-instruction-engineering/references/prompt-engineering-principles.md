# Prompt Engineering Principles

This reference distills the local SaltMarcher prompt-engineering research into
rules that are directly useful for agent instruction artifacts.

## Primary Principles

- Install an expert mental model, not a checklist.
- Put trigger conditions in the highest-authority surface that is loaded early.
- Prefer explicit scope boundaries over broad "use judgment" language.
- Keep instruction density high; cut commentary that does not change behavior.
- Tie prompt changes to observable quality goals or evaluation surfaces.

## Codex And Coding-Agent Principles

- Bias toward completion-oriented autonomy when the artifact governs coding or
  review work.
- Avoid forcing upfront plans or progress boilerplate unless the product
  specifically needs them.
- Give concrete guidance about tool usage only where the harness would otherwise
  behave incorrectly.
- Calibrate effort and verbosity with clear defaults instead of contradictory
  style demands.
- State when subagents or parallel work are useful instead of globally banning
  or requiring them.

## Instruction Design Heuristics

- Put the most important non-negotiable rules near the top.
- Prefer direct operational verbs: `read`, `verify`, `preserve`, `stop`,
  `report`.
- Encode ownership boundaries explicitly so the agent knows where not to write.
- Use examples sparingly and only when they teach a fragile edge case.
- Remove redundant reminders that the model would already do naturally.

## Evaluation Heuristics

- Judge prompt changes by changed behavior, not by how polished the text looks.
- Prefer targeted checks against known failure modes.
- Re-run consistency checks after editing one instruction surface that has
  neighbors.
- When a prompt is slower, noisier, or more brittle, simplify before adding
  more rules.
