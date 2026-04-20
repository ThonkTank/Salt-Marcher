Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Entry point and document map for the dungeon feature.

# Dungeon Feature README

## Purpose

The dungeon feature provides two related surfaces over the same authored
dungeon truth:

- a travel/runtime surface for navigating a dungeon as play progresses
- an editor surface for authoring and revising the dungeon map

The feature preserves one canonical dungeon truth while allowing different
presentations and workflows for travel and editing.

## Documentation Set

- [Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/SPEC.md:1)
- [Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/DOMAIN.md:1)
- [Delivery Notes](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/DELIVERY.md:1)
- [Dungeon Map Slotcontent](/home/aaron/Schreibtisch/projects/SaltMarcher/src/view/slotcontent/main/dungeonmap/dungeon-map.md:1)

## Scope

In scope:

- loading and presenting dungeon maps
- navigating dungeon travel state
- editing dungeon topology and authored semantics
- inspecting rooms, connections, and features

Out of scope:

- general shell behavior
- project-wide persistence governance
- non-dungeon feature behavior

## Status

This documentation set is currently target-state documentation. It is meant to
make ownership and behavior explicit even where implementation is still partial.
