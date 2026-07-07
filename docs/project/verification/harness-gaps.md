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
| `bootstrap/**` | Harness exists, mutation score 45.6% | P2 | Strengthen assertions until mutation score >= 50%. |
| `shell/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/data/party/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/domain/dungeon/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/domain/encounter/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/domain/party/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/domain/worldplanner/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/features/dungeon/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/view/dropdowns/party/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/view/leftbartabs/catalog/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/view/leftbartabs/dungeoneditor/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/view/slotcontent/controls/catalogcrud/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/view/slotcontent/controls/searchfilter/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/view/statetabs/encounter/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/view/statetabs/travel/**` | Harness exists, mutation telemetry timed out | P2 | Split or strengthen the harness until monthly mutation telemetry completes under the per-area timeout. |
| `src/domain/sessionplanner/**` | Harness exists, mutation telemetry pitest_failed | P2 | Repair the harness adapter or baseline so monthly mutation telemetry produces a score. |
| `src/view/leftbartabs/dungeontravel/**` | Harness exists, mutation telemetry pitest_failed | P2 | Repair the harness adapter or baseline so monthly mutation telemetry produces a score. |
| `src/view/leftbartabs/hexmap/**` | Harness exists, mutation telemetry pitest_failed | P2 | Repair the harness adapter or baseline so monthly mutation telemetry produces a score. |
| `src/view/leftbartabs/sessionplanner/**` | Harness exists, mutation telemetry pitest_failed | P2 | Repair the harness adapter or baseline so monthly mutation telemetry produces a score. |
| `src/view/leftbartabs/worldplanner/**` | Harness exists, mutation telemetry pitest_failed | P2 | Repair the harness adapter or baseline so monthly mutation telemetry produces a score. |

## Rule

Touching a gap area requires creating the minimal harness in the same pass or
filing a Harness Gap blocker that references this register.

## Evidence Owner

`checkHarnessMapConsistency` proves mapped harness task names exist and all
registered FOCUSED/AGGREGATE harnesses are mapped. It does not prove that gap
areas are covered; this register is review-owned until the named harnesses
exist.
