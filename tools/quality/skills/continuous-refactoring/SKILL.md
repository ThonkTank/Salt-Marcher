---
name: continuous-refactoring
description: Use before production-code, check/enforcement, or dependency work to keep cleanup inside the normal pass without creating broad cleanup waves or new gates.
---

# Continuous Refactoring

Use this skill when production code, check/enforcement packages, or dependency
surfaces are edited.

## Rules

1. Identify the cleanup naturally inside the current write set.
2. Remove `LEGACY_REMOVE_ON_TOUCH` support you touch, or report a blocker.
3. Prefer small local simplification that reduces the current change's risk.
4. Do not create broad cleanup waves, new gates, or speculative abstractions
   without explicit user scope.
5. If the cleaner fix needs a wider write set, record the scope decision needed
   instead of hiding it as follow-up.
6. Run the verification route required by `AGENTS.md`.

## Handoff

Report cleanup done, markers removed or blockers, and any scope decision left
for the user.
