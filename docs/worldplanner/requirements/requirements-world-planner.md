# World Planner Requirements

## Goal

Provide authored campaign-world records through the shared Catalog and
Inspector surfaces so the user can:

- create and maintain NPCs linked to existing creature statblocks
- record NPC appearance, behavior, history, and notes
- organize NPCs into factions
- define faction encounter-table and optional statblock inventory limits
- define tagged locations with separate read-aloud text and GM notes, and link
  them to factions and encounter tables
- use factions and locations as encounter-generation source constraints
- add NPCs to combat through the Encounter state tab
- confirm combat losses manually and reactivate defeated NPCs later
- expose World Planner location choices for later Session Planner-owned
  integration

## Non-Goals

- editing creature statblocks or importing creature truth into World Planner
- NPC Encounter participation, automatic combat-loss accounting, and
  post-combat loss confirmation in the current Electron slice
- persisting encounter runtime combat state inside World Planner
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
   statblock from the faction's primary encounter table. Missing limits mean
   unlimited stock; unrelated statblocks cannot be added directly.
7. The user creates locations with a name and at least one free-form tag,
   optionally records read-aloud text separately from GM notes, links factions,
   attaches location-owned encounter tables, and stages an optional Hex
   placement in the same editor. Missing maps, factions, and encounter tables
   can be created from that editor; each created record is linked without
   resetting the location draft.
8. The user chooses factions or a location in the Catalog to limit
   random encounter generation.
9. The user adds NPCs to combat.
10. At combat end, the Encounter state tab shows candidate losses and the user
   confirms which losses should update World Planner state.
11. Defeated NPCs stop counting as available until the user reactivates them.
12. Later Session Planner-owned work can read World Planner location choices
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
- The editable faction inventory consists only of creatures in its current
  primary encounter table. Changing tables preserves limits for shared
  creatures and removes all other limits.
- A finite faction inventory limit caps the generated count for that creature
  statblock.
- Missing faction inventory limits are unlimited by default.
- A generator request that cannot satisfy finite inventory caps must return a
  clear no-solution state instead of exceeding owned stock.

## Expected Capabilities

- list, create, rename, edit, and delete World Planner NPCs, factions, and
  locations
- show NPC details in the shell details/Inspector area
- select statblocks only from the existing Creatures public boundary
- add or remove NPCs from factions without mutating creature truth
- configure faction stock as finite or unlimited per creature statblock
- create a missing encounter table from above the faction editor without
  losing the faction draft; the saved table becomes the selected primary table
- create a missing map, faction, or encounter table from the location editor
  without losing any location field; the saved record becomes selected or
  linked immediately
- configure location-to-faction and location-to-table links
- edit campaign-wide free-form location tags and a separate read-aloud field
- suggest matching campaign tags through a bounded, canonical-distinct read
  without introducing a separately editable tag registry
- stage a location placement or removal in the shared editor without mutating
  Hex truth until the location is saved
- inspect another map or create a map without implicitly moving an existing
  location; placement changes only through an explicit selection or removal
- remove faction membership and location links without deleting the referenced
  provider records
- select factions and locations in encounter-generation controls
- add an NPC to combat while preserving its World Planner identity
- show a post-combat loss confirmation before durable NPC or inventory state
  changes
- reactivate a defeated named NPC
- expose location choices through a public boundary for future
  Session Planner-owned integration
- store faction disposition and NPC modifiers toward the PCs so runtime scenes
  can derive friendly, neutral, and hostile Encounter roles

## Acceptance Criteria

- World Planner persists authored NPC, faction, location, lifecycle, notes,
  links, and inventory-limit truth as its own feature state.
- a location editor requires a non-empty name and at least one tag; tags are
  bounded free-form strings rather than a fixed type or region enum
- read-aloud text and GM notes remain distinct fields
- Catalog and Hex use the same location dialog implementation, Catalog and
  inline creation use the same faction dialog implementation, and every table
  creation or edit uses the same encounter-table dialog implementation
- the shell exposes no separate World Planner left-bar entry and no World
  Planner-owned state pane
- Catalog list selection opens World Planner details and existing editing
  actions in the Inspector while the global Encounter state remains visible
- NPCs store creature statblock references, not copied statblock fields.
- Factions can contain any number of NPCs and one primary encounter table.
- Faction statblock limits are optional and unlimited by default.
- Faction inventory limits outside the selected primary encounter table are
  rejected; removing table entries prunes affected limits atomically.
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
  its location links and NPC memberships; deleting a location clears only NPC
  location references while preserving those NPCs
- Creature statblocks, encounter-table membership, encounter rosters, party
  members, combat HP, dungeon maps, and hex maps stay in their owning
  contexts.

## Active Electron Slice

The current Electron slice implements campaign-local NPC, location, and
faction CRUD through Catalog. NPCs select one existing Creature statblock,
carry active/defeated lifecycle, four prose fields, a bounded disposition
modifier, and optional single faction and location references. The active NPC
section provides debounced search, lifecycle/faction/location filters, an
Inspector, a guarded editor, and confirmed deletion. NPC membership mutations
compare both NPC and faction revisions and return both updated snapshots.
Locations link any number of factions and direct encounter tables. Factions
own notes, disposition, an optional primary encounter table, and optional
finite creature inventory caps. These sources constrain both the visible
monster catalog and Scene-group generation. NPC Encounter participation and
durable combat-loss workflows remain deferred.
Catalog and Hex compose the same complete domain-owned World Location editor.
Its creation command returns the exact created location together with the next
catalog snapshot, while each consumer retains ownership of its surrounding
workflow. The editor stages an optional map selection; saving persists the
World Planner mutation first and then performs the explicit Hex placement or
removal command. A failed second command leaves the saved location intact and
reports the partial success. The workspace integration boundary supplies the
editor's related-record creators. Inline map, faction, and encounter-table
creation use the same dialogs as their direct Catalog or Hex entry points and
return the exact new record to the still-mounted location draft. Faction table
selection remains an anchored, searchable popup and retains inline table
creation.

## References

- [World Planner Domain Model](../domain/domain-world-planner.md) (line 1)
- [World Planner Persistence Contract](../contract/contract-world-planner-persistence.md) (line 1)
