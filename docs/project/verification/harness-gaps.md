Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
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
| `src/domain/creatures` | Catalog-adjacent only | P2 | Add a creature catalog domain harness covering create, edit, filter, and readback. |
| `src/domain/encountertable` | No dedicated encounter-table behavior harness | P2 | Add an encounter-table readback harness covering authored summary lookup, weighted candidate lookup, empty selection, XP ceiling, and storage-error publication. |
| `src/domain/worldplanner/** -> src/domain/encounter/**` | Route gap: `worldPlannerEncounterHarness` uses fixture world snapshots, fixture encounter repository, and no-op publication sinks while mapped as cross-context encounter/worldplanner behavior proof. | P1 | Route the harness through production World Planner publication/persistence, encounter source wiring, and saved-plan publication, or relabel the current task as fixture/component proof and add a production-route harness before touched cross-context behavior relies on it. |
| `src/view/dropdowns/party/**` | Route gap: `partyDropdownHarness` drives contribution models, content models, intent handlers, and hand-built input events directly instead of the shell-bound JavaFX dropdown route. | P1 | Fire the real dropdown controls through contribution binding and assert rendered trigger/content plus published active-party readback, or keep the direct-handler task as component proof and add a production-route dropdown harness. |
| `src/view/statetabs/encounter/**` | Route gap: `encounterStateTabHarness` renders a harness-created `MutableEncounterStateFeed` snapshot with no-op services instead of production encounter publication into the state tab. | P1 | Drive the production encounter service/publication model and read back the real `EncounterStateModel`, or retain the current task as render-only proof and add a production-route state-tab harness. |

## Rule

Touching a gap area requires creating the minimal harness in the same pass or
filing a Harness Gap blocker that references this register.

## Evidence Owner

`checkHarnessMapConsistency` proves mapped harness task names exist and all
registered FOCUSED/AGGREGATE harnesses are mapped. It does not prove that gap
areas are covered; this register is review-owned until the named harnesses
exist.
