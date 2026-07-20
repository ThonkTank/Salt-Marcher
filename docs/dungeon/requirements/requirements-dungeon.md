Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-20
Source of Truth: Confirmed solution-neutral user capabilities and quality needs
for the Dungeon feature.

# Dungeon Feature Requirements

## Goal

Provide one local, GM-operated Dungeon capability for authoring, inspecting,
running, exchanging, and documenting multi-level dungeons. Every surface reads
and changes one coherent dungeon truth while preserving the GM's authority over
fiction and outcomes.

## User And Authority

- one GM is the only operator of the local desktop interface
- players do not receive direct character control or a multi-user editing
  surface
- the GM translates table decisions into Dungeon commands
- SaltMarcher may calculate objective travel facts, expose triggered content,
  and maintain state, but it MUST NOT decide fictional outcomes reserved for
  the GM
- remote access and collaborative multi-user authoring are not required

## Long-Term Capability Scope

One Dungeon is one continuous spatial whole containing all of its rooms, surfaces, levels, and spatial content. It is not a collection of internal Dungeon maps. The raster map is a view of this whole, not a separate authored container. Only an actual exit may transition to another Dungeon or an external place.

Its spatial foundation behaves as one voxel-like 3D grid with 5-foot horizontal
cells and 5-foot vertical resolution. Creating ordinary walkable space produces
floor, traversable volume, and a default ceiling together with 10 feet of clear
height. The GM may later change height in 5-foot steps, including intentional
5-foot crawlspaces and taller chambers. Stacked spaces and minor elevation
shifts remain part of the same Dungeon.

A Room is any bounded, standable interior volume. Chambers, corridors, and
stair spaces share this semantic role during inspection and travel. One Room
may contain several navigation areas that expose meaningful internal choices,
including corridor junctions and branches.

Spatial authoring has two foundational forms: directly drawn anchored Areas and
dynamically generated Paths between two or more endpoints or waypoints.
Horizontal corridors and vertical stair segments are generated parts of one unified 3D Path model. One Path may combine both between endpoints at different elevations. Generated Paths materialize ordinary bounded Room volume; Area and Path describe construction behavior rather than incompatible runtime space types.

The Dungeon capability includes:

- Dungeon catalog management
- square-cell, multi-level authored geometry
- rooms, larger named room groups or areas, walls, doors, unified generated
  3D connection Paths, transitions, markers, and GM-authored traps
- descriptions, inspection, stable Dungeon-Key numbering, and campaign-object
  references
- synchronized raster-map, relationship-graph, and Dungeon-Key workflows
- cell-precise runtime positions for the party and selected relevant actors
- GM-operated dungeon travel with time, routes, events, and factual logging
- a human-readable document export containing the map, Dungeon Key, and stable
  references
- a versioned portable Dungeon package for authored Dungeon truth

New authored object families, tools, rules, and integrations MUST remain
locally addable in source code. A runtime plugin system is not required.

Map-image import and procedural Dungeon generation are not core requirements.

## Primary Surfaces

- raster authoring editor
- abstract relationship-graph design view
- room-list and Dungeon-Key authoring view
- passive runtime raster view for selection, orientation, and detail inspection
- independent runtime `Reisen` state tab for travel controls and status
- human-readable map and Dungeon-Key export

The specialized surfaces MUST select and navigate to the same stable room,
area, object, or actor and MUST remain consistent with one authored Dungeon
truth.

## Campaign Relationships

Rooms, areas, and markers may reference suitable campaign-owned places, NPCs,
factions, encounters, items, scenes, and similar objects. Dungeon stores stable
references without copying or taking ownership of the referenced object's
truth.

## Durability And Safety

- every completed, validated authoring action persists immediately
- previews and canceled gestures remain transient
- saved Dungeons survive restarts and application updates
- migrations, backup, and restore protect authored data
- import MUST preview identity conflicts and missing external references
- the GM may create new identities or map missing external references before import
- import MUST NOT silently overwrite existing authored content
- a portable Dungeon package contains authored Dungeon truth and stable
  references, but not party or actor positions, travel logs, or undo history

## Deferred Low-Priority Capabilities

The target design MUST permit later addition without fundamental restructuring
of:

- moving monster groups with simple schedules
- automated perception comparisons and GM-entered active-check results
- persistent room-associated tracks and pursuit workflows
- a passive second-monitor player view with Fog of War, hidden secrets,
  lighting, and comparable visibility rules

These are long-term product directions, not requirements for the next delivery.
The player view remains display-only and does not change the GM-only control
model.

## Non-Goals

- a tactical battlemap or combat action economy
- automated resolution of attacks, spells, traps, encounters, or unrestricted
  exploration actions
- direct player control
- remote or multi-user operation
- a runtime user-plugin system
- ownership of external campaign-object truth
- procedural Dungeon generation as a core workflow

## Quality Needs

- very large sparse Dungeons remain responsive; a qualification Dungeon contains at
  least 100,000 authored cells
- camera and hover work complete within a 16 ms p95 budget
- editor preview completes within a 50 ms p95 budget
- work scales with the visible or touched region rather than total off-screen
  Dungeon content
- loading and committing expose distinct visible states
- new authored object or tool families, a travel/time/event-rule change, and a
  UI or persistence adapter replacement remain local and do not require changes
  to unrelated features

## Acceptance Outcomes

- authoring, inspection, travel, document export, and package exchange refer to
  the same stable authored identities
- runtime actor state and logs do not become authored Dungeon-package content
- no surface silently invents a second room, connection, description, or
  passability truth
- the GM can understand what changed, cancel transient work, and recover safely
  from rejected or failed operations
- system-calculated facts remain distinguishable from GM-authored content and
  GM-decided outcomes

## References

- [Dungeon Editor Requirements](./requirements-dungeon-editor.md)
- [Dungeon Travel State Requirements](./requirements-dungeon-travel-state.md)
- [Dungeon Travel Requirements](./requirements-dungeon-travel.md)
- [Dungeon Domain Model](../domain/domain-dungeon.md)
- [Dungeon Needs Interview](../../project/interviews/2026-07-20-dungeon-needs-interview.md)
