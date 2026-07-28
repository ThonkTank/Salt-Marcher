# World Planner Requirements

Status: Confirmed product requirements
Owner: World Planner
Last Reviewed: 2026-07-28
Source of Truth: This document

## Goal

Provide authored campaign-world records through the shared Catalog and
Inspector surfaces so the user can:

- create and maintain NPCs linked to existing creature statblocks
- record NPC appearance, behavior, history, and notes
- organize NPCs into factions
- define faction encounter-table and optional statblock inventory limits
- define locations and link them to factions and encounter tables
- keep note-first Quest and rumour threads attached to NPCs, factions, or
  locations and resolve them manually
- use factions and locations as encounter-generation source constraints
- add NPCs to combat through the Encounter state tab
- confirm combat losses manually and reactivate defeated NPCs later
- expose World Planner location choices for later Session Planner-owned
  integration

## Non-Goals

- editing creature statblocks or importing creature truth into World Planner
- editing encounter tables
- persisting encounter runtime combat state inside World Planner
- autonomous Quest completion, trigger graphs, or reward distribution
- storing party membership, dungeon map truth, or hex map truth
- replacing saved encounter plans, the Encounter state tab, or the Session
  Planner session record

## Primary User Flows

1. The user opens the Catalog and selects `NPCs`, `Fraktionen`, or `Orte`.
2. Selection opens the record's details and existing editing actions in the
   Inspector.
3. The user creates NPCs and selects an existing creature statblock for each
   NPC.
4. The user records appearance, behavior, history, and notes for NPCs.
5. The user creates factions, assigns one primary encounter table, and adds any
   number of NPCs.
6. The user optionally sets finite faction stock limits per creature
   statblock. Missing limits mean unlimited stock.
7. The user creates locations, links factions, and attaches location-owned
   encounter tables.
8. From a selected NPC, faction, or location Inspector, the user creates a
   titled Quest or rumour with free-form notes and later edits, closes, reopens,
   trashes, or restores that thread explicitly.
9. A Quest may retain stable contributor references and structured XP or item
   rewards for later owner integrations; a rumour has no contributors.
10. The user chooses factions or a location in the Catalog to limit
   random encounter generation.
11. The user adds NPCs to combat.
12. At combat end, the Encounter state tab shows candidate losses and the user
   confirms which losses should update World Planner state.
13. Defeated NPCs stop counting as available until the user reactivates them.
14. Later Session Planner-owned work can read World Planner location choices
   through a public boundary without World Planner defining session records.

## Source Constraint Behavior

- Unset faction, location, or table filters mean unconstrained for that source
  dimension.
- Explicit source constraints combine by intersection of available candidate
  sources.
- A location contributes its own encounter tables plus tables reachable through
  linked factions.
- A faction contributes its primary encounter table and its NPC or statblock
  inventory.
- A finite faction inventory limit caps the generated count for that creature
  statblock.
- Missing faction inventory limits are unlimited by default.
- A generator request that cannot satisfy finite inventory caps must return a
  clear no-solution state instead of exceeding owned stock.

## Expected Capabilities

- list, create, rename, edit, and delete World Planner NPCs, factions, and
  locations
- inspect deleted NPCs, factions, and locations in recoverable trash and
  restore the same stable identity
- show NPC details in the shell details/Inspector area
- select statblocks only from the existing Creatures public boundary
- add or remove NPCs from factions without mutating creature truth
- configure faction stock as finite or unlimited per creature statblock
- configure location-to-faction and location-to-table links
- remove faction membership and location links without deleting the referenced
  provider records
- select factions and locations in encounter-generation controls
- add an NPC to combat while preserving its World Planner identity
- show a post-combat loss confirmation before durable NPC or inventory state
  changes
- reactivate a defeated named NPC
- expose location choices through a public boundary for future
  Session Planner-owned integration
- create, edit, manually close/reopen, recoverably delete, and restore Quest and
  rumour threads from the Inspector of an attached active world record
- store Quest contributor IDs plus positive XP and item-quantity rewards
  without granting or distributing them
- store faction disposition and NPC modifiers toward the PCs so runtime scenes
  can derive friendly, neutral, and hostile Encounter roles

## Acceptance Criteria

- World Planner persists authored NPC, faction, location, lifecycle, notes,
  links, inventory-limit, Quest, and rumour truth as its own feature state.
- NPC statblock, faction, last-place, and place-faction editing uses searchable
  bounded provider choices; it never asks the user to type a foreign stable ID.
- the shell exposes no separate World Planner left-bar entry and no World
  Planner-owned state pane
- Catalog list selection opens World Planner details and existing editing
  actions in the Inspector while the global Encounter state remains visible
- NPCs store creature statblock references, not copied statblock fields.
- Factions can contain any number of NPCs and one primary encounter table.
- Faction statblock limits are optional and unlimited by default.
- Encounter generation cannot generate more finite-stock creatures of a
  statblock than the selected faction or location source owns.
- Location-constrained generation uses only encounter tables available through
  the selected location.
- Combat does not mutate durable World Planner state until the user confirms
  the loss summary after combat.
- Defeated named NPCs are unavailable for generation and selection until
  reactivated.
- World Planner exposes location references without storing or defining
  Session Planner-owned records.
- an NPC belongs to at most one faction and its effective disposition is the
  clamped sum of faction base and NPC modifier
- deleting an NPC removes its faction membership; deleting a faction removes
  its location links; deleting a location removes only the location
- deletion moves the complete owner record into recoverable trash; restore
  preserves its stable identity and reattaches only relationships whose other
  endpoint is still active and unclaimed
- narrative resolution is only `open` or `closed` and changes only through an
  explicit user command; no stored condition or background process closes it
- Quest and rumour subjects are active World Planner NPCs, factions, or places;
  removing a subject detaches that relationship atomically, and restoring it
  reattaches only a still-existing narrative
- structured rewards remain undistributed planning truth until the progression
  owner integrates them in a later milestone
- Creature statblocks, encounter-table membership, encounter rosters, party
  members, combat HP, dungeon maps, and hex maps stay in their owning
  contexts.

## References

- [World Planner Domain Model](../domain/domain-world-planner.md) (line 1)
- [World Planner Architecture](../architecture/architecture-world-planner.md) (line 1)
- [World Planner Persistence Contract](../contract/contract-world-planner-persistence.md) (line 1)
