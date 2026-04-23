Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-23
Source of Truth: Entry point and document map for the encounter feature.

# Encounter Feature README

## Purpose

The encounter feature owns runtime encounter generation for the currently
active party and saved encounter-plan roster truth. It composes party state and
creature catalog data into rule-oriented encounter suggestions, then persists
only the user-accepted roster when the user saves a plan.

## Documentation Set

- [Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/SPEC.md:1)
- [Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/DOMAIN.md:1)
- [Persistence](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/encounter/PERSISTENCE.md:1)
- [Encounter Table Feature README](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encountertable/README.md:1)
- [Encounter UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/statetabs/encounter/UI.md:1)

## Scope

In scope:

- deriving encounter budgets from the active party
- filtering the creature catalog into encounter-ready candidates
- generating and ranking multiple encounter alternatives
- adding catalog creature rows into a manual runtime roster
- saving and opening encounter-plan rosters

Out of scope:

- persisting initiative, combat, result, or loot state as encounter-plan truth
- dungeon room placement or biome ownership
- bootstrap or shell policy
