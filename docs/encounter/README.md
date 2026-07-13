Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-07
Source of Truth: Entry point and document map for the encounter feature.

# Encounter Feature README

## Purpose

The encounter feature owns runtime encounter generation for the currently
active party and saved encounter-plan roster truth. It composes party state and
creature catalog data into rule-oriented encounter suggestions, then persists
only the user-accepted roster when the user saves a plan.

## Documentation Set

- [Feature Spec](docs/encounter/requirements/requirements-encounter.md:1)
- [Domain Model](docs/encounter/domain/domain-encounter.md:1)
- [Persistence](docs/encounter/contract/contract-encounter-persistence.md:1)
- [Saved Plans Contract](docs/encounter/contract/contract-encounter-saved-plans.md:1)
- [Plan Budget Contract](docs/encounter/contract/contract-encounter-plan-budget.md:1)
- [Builder Inputs Contract](docs/encounter/contract/contract-encounter-builder-inputs.md:1)
- [Encounter State Contract](docs/encounter/contract/contract-encounter-state.md:1)
- [Encounter Table Feature README](docs/encountertable/README.md:1)
- [Encounter UI](docs/encounter/requirements/requirements-encounter-state-tab.md:1)
- [Encounter Verification](docs/encounter/verification/verification-encounter.md:1)

## Open Issues

- [Encounter issues](https://github.com/ThonkTank/Salt-Marcher/issues?q=is%3Aissue%20is%3Aopen%20label%3Afeature%3Aencounter)

## Scope

In scope:

- deriving encounter budgets from the active party
- reading saved encounter plans as party-specific budget summaries for planner
  surfaces
- filtering the creature catalog into encounter-ready candidates
- generating and ranking multiple encounter alternatives
- adding catalog creature rows into a manual runtime roster
- saving and opening encounter-plan rosters

Out of scope:

- persisting initiative, combat, result, or loot state as encounter-plan truth
- dungeon room placement or biome ownership
- bootstrap or shell policy
