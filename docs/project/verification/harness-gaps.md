Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
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
| `src/domain/encountertable` | No dedicated encounter-table behavior harness | P2 | Add an encounter-table readback harness covering authored summary lookup, weighted candidate lookup, empty selection, XP ceiling, and storage-error publication. |
| `src/view/statetabs/encounter/**` | Route gap: `encounterStateTabHarness` renders a harness-created `MutableEncounterStateFeed` snapshot with no-op services instead of production encounter publication into the state tab. | P1 | Drive the production encounter service/publication model and read back the real `EncounterStateModel`, or retain the current task as render-only proof and add a production-route state-tab harness. |

## Rule

Touching a gap area requires creating the minimal harness in the same pass or
filing a Harness Gap blocker that references this register.

## Evidence Owner

`checkHarnessMapConsistency` proves mapped harness task names exist and all
registered FOCUSED/AGGREGATE harnesses are mapped. It does not prove that gap
areas are covered; this register is review-owned until the named harnesses
exist.
