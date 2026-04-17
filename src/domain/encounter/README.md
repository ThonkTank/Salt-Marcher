Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Entry point and document map for the encounter feature.

# Encounter Feature README

## Purpose

The encounter feature owns runtime encounter generation for the currently
active party. It composes party state and creature catalog data into
rule-oriented encounter suggestions without persisting generated encounters as
canonical truth.

## Documentation Set

- [Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/SPEC.md:1)
- [Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/encounter/DOMAIN.md:1)
- [Encounter UI](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/encounter/UI.md:1)

## Scope

In scope:

- deriving encounter budgets from the active party
- filtering the creature catalog into encounter-ready candidates
- generating and ranking multiple encounter alternatives
- supporting reroll, lock, and exclude runtime workflows

Out of scope:

- persisting generated encounters as authored campaign truth
- dungeon room placement or biome ownership
- bootstrap or shell policy
