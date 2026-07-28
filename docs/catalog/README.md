# Catalog Feature

Status: Active Godot migration owner
Owner: Catalog
Last Reviewed: 2026-07-28
Source of Truth: This document routes to the files below

Catalog is the application capability for finding, evaluating, and explicitly
handing reference content to another active workspace. It presents Creatures,
Items, saved Encounters, World Planner records, and Encounter Tables inside one
`Katalog` navigation entry. The production Godot shell currently connects the
Creature and Item sections to Shared Definitions, NPCs/factions/places to the
active Campaign's World Planner provider, and Encounter Tables plus saved
Encounters to their own Campaign partitions. All providers sort stably before
bounded paging through one retained result table. A selected NPC, faction, or place exposes its
World Planner-owned note-first Quest and rumour threads in the Inspector;
Encounter Tables expose weighted provider details and create/edit. Saved
Encounters expose complete roster details, Creature-backed create/edit, and
recoverable trash/restore without transferring roster ownership to Catalog.

## Reading Order

1. Read [Catalog Requirements](requirements/requirements-catalog.md) for
   user-visible behavior and acceptance criteria.
2. Read [Catalog Architecture](architecture/architecture-catalog.md) for the
   durable target structure, ownership, and dependency direction.

## Document Set

### Requirements

- [Catalog Requirements](requirements/requirements-catalog.md)

### Architecture

- [Catalog Architecture](architecture/architecture-catalog.md)
