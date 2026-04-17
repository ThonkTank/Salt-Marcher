Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Entry point and document map for the dungeon map feature set.

# Dungeon Map Overview

## Purpose

The dungeon map feature provides two related surfaces over the same authored
dungeon truth:

- a travel/runtime surface for navigating a dungeon as play progresses
- an editor surface for authoring and revising the dungeon map

The feature must preserve one canonical dungeon truth while allowing different
presentations and workflows for travel and editing.

## Documentation Set

- [Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/features/dungeonmap/spec.md:1)
- [Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/features/dungeonmap/domain.md:1)
- [UI Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/features/dungeonmap/ui.md:1)
- [Delivery Notes](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/features/dungeonmap/delivery.md:1)

## Scope

In scope:

- loading and presenting dungeon maps
- navigating dungeon travel state
- editing dungeon topology and authored semantics
- inspecting rooms, connections, and features

Out of scope for this documentation set:

- general shell behavior
- project-wide persistence governance
- non-dungeon feature behavior

## Status

The dungeon map documentation is currently a target-state specification. It is
intended to define behavior and ownership clearly even where implementation is
still partial.
