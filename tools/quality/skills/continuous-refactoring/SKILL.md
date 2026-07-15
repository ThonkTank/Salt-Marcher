---
name: continuous-refactoring
description: Use before production-code, check/enforcement, or dependency work to keep cleanup inside the normal pass without creating broad cleanup waves or new gates.
---

# Continuous Refactoring

Use this skill when production code, check/enforcement packages, or dependency
surfaces are edited.

## Rules

1. Identify the cleanup naturally inside the current write set.
2. Fix structural or legacy-removal findings inside the scoped pass when
   proportional; otherwise name the blocker or open a scoped GitHub issue.
3. Prefer small local simplification that reduces the current change's risk.
4. Do not create broad cleanup waves, new gates, or speculative abstractions
   without explicit user scope.
5. If the cleaner fix needs a wider write set, record the scope decision needed
   instead of hiding it as follow-up.
6. Run the verification route required by `AGENTS.md`.

## Handoff

Report cleanup done, blockers, and any scope decision left for the user.
