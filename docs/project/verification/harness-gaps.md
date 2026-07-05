Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-05
Source of Truth: Behavior-harness coverage gaps that must be closed before touched areas change.

# Harness Gaps

## Purpose

This register names behavior surfaces that do not yet have enough production
route coverage to satisfy the owner-feedback rule in `AGENTS.md`.

## Scope

This file does not define product behavior. It records verification gaps and
the minimal harness proposal needed before a touched area may change.

## Gaps

| Area | Current coverage | Priority | Minimal harness proposal |
| --- | --- | --- | --- |
| `src/view/statetabs/encounter` | Partial through `worldPlannerEncounterHarness` | P1 | Add a state-tab harness that opens the Encounter tab through the shell and exercises saved encounter rendering. |
| `src/domain/party`, `src/view/dropdowns/party` | No dedicated party behavior harness | P1 | Add a party dropdown harness that creates, selects, and publishes active-party state through production services. |
| `src/domain/creatures` | Catalog-adjacent only | P2 | Add a creature catalog domain harness covering create, edit, filter, and readback. |
| `src/domain/encountertable` | No dedicated encounter-table behavior harness | P2 | Add an encounter-table harness covering table creation, row persistence, and lookup. |

## Rule

Touching a gap area requires creating the minimal harness in the same pass or
filing a Harness Gap blocker that references this register.

## Evidence Owner

`checkHarnessMapConsistency` proves mapped harness task names exist and all
registered FOCUSED/AGGREGATE harnesses are mapped. It does not prove that gap
areas are covered; this register is review-owned until the named harnesses
exist.
