---
name: code-exploration
description: Use before planning or reviewing SaltMarcher changes where existing code behavior, workflow routing, build/check logic, or repo-local tool behavior affects the decision.
---

# Code Exploration

Use source-backed evidence before planning from nearby files.

## Workflow

1. Name the behavior, workflow, check, tool, or route the task depends on.
2. Search with `rg` or `rg --files`.
3. Read source in execution order from public entrypoint through dispatch,
   state mutation, publication, and proof surface.
4. Compare sibling workflows before assuming shared behavior.
5. Classify evidence as `Owner-Proven`, `Evidence-Proven`, `Candidate`, or
   `Suspect`.
6. For behavior changes, identify the owning behavior harness or report a
   `Harness Gap`.
7. For bug/regression/refactor work, search `docs/project/journal/` for the
   surface or symptom and read hits.
8. Plan only from owner-proven or source/command-backed facts.

## Handoff

Report entrypoint, dispatch path, state owner, variants checked, harness, tools
used, and unknowns only when they affected the decision.
