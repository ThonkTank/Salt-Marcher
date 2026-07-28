# World Planner Feature Docs

Status: Active Godot migration owner
Owner: World Planner
Last Reviewed: 2026-07-28
Source of Truth: This document routes to the files below

## Purpose

The `worldplanner` feature owns authored campaign-world planning records for
NPCs, factions, locations, Quests, and rumours.

It stores World Planner-owned notes, lifecycle state, relationships, source
constraints, and recoverable trash. Its Godot provider currently supplies
bounded NPC, faction, and place search plus name-only create, name/note edit,
deletion, and restore to the single Catalog workspace. Its bounded detail lane
shows complete typed entity state; the Inspector edits NPC appearance,
behavior, history, lifecycle, and disposition plus faction disposition and
finite Creature stock limits.
Selected world records also expose attached note-first Quest/rumour threads
with explicit manual resolution and recoverable trash. Foreign-reference
pickers for Creature statblocks, NPC faction/last place, place factions,
faction primary Encounter Tables, and place Encounter Tables are searchable
and bounded. Finite faction stock uses the same Creature provider; omitted
statblocks remain unlimited. Catalog now consumes one derived generation-source
read: selected factions and a location resolve effective table IDs and finite
stock caps without copying Creature or Encounter Table records. Destination
handoffs and reward distribution remain migration work.

It references creature statblocks and encounter tables through their owning
public boundaries, and exposes location choices for later Session Planner-owned
integration. It does not own creature statblocks, encounter rosters, party
truth, combat runtime state, session records, dungeon maps, or hex maps.

## Document Set

### Requirements

- [World Planner Requirements](./requirements/requirements-world-planner.md)

### Architecture

- [World Planner Architecture](./architecture/architecture-world-planner.md)

### Contract

- [World Planner Persistence Contract](./contract/contract-world-planner-persistence.md)

### Domain

- [World Planner Domain Model](./domain/domain-world-planner.md)

## References

- [Creatures Feature Overview](../creatures/README.md) (line 1)
- [Encounter Feature Overview](../encounter/README.md) (line 1)
- [Encounter Table Feature Overview](../encountertable/README.md) (line 1)
- [Session Planner Feature Overview](../sessionplanner/README.md) (line 1)
