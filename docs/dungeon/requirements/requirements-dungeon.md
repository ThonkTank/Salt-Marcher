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

A Volume is bounded, standable geometric interior space. Chambers, corridors,
stair spaces, and comparable geometric forms share movement semantics. A
Volume may contain several navigation areas that expose meaningful internal
choices, including corridor junctions and branches.

A Room is a stable GM-authored content identity associated with a Volume. It
owns name, descriptions, Features, references, and comparable semantic work.
One Room is associated with at most one Volume and one Volume with at most one
Room at a time; either may temporarily remain unassigned. Moving the Volume
preserves that Room identity and association. Navigation areas partition a
Volume, while room groups collect several Rooms or Volumes.

A Room may provide descriptive defaults for its associated Volume. The GM may
assign overriding authored descriptions, attributes, or templates to selected
contiguous wall, floor, or ceiling regions. Only explicitly described surface
regions require stable content identities and preservation; undescribed voxel
faces remain plain geometry.

Every Dungeon Feature initially has an exact 3D voxel position anchored within
one Volume. Moving or reshaping the Volume carries its Feature anchors with it.
If destructive geometry makes reliable mapping impossible, the Feature remains
preserved without an anchor until reassigned. Encounters are initially
stationary; optional mobility is a later capability. Only Traps and Encounters
initially support automatic proximity activation. Traps may define zero or more
arbitrary voxel-set trigger fields separate from their anchors. Trigger voxels
remain associated with their Volumes, may span several adjacent Volumes, and
only control notification or travel interruption; they do not alter
passability or decide outcomes. A Trap may own maximum and current Charges for consecutive GM-confirmed actual
activations and a Reset Duration that restores all Charges together. The GM
chooses whether recharge begins at zero Charges or immediately below maximum.
Further activation does not restart a running countdown; completion restores all
Charges. The GM may manually correct the state. A far-future monster
routine may explicitly reset a Trap. A placed Dungeon Encounter primarily uses
the existing Encounter capability as the source of monster composition and
statistics. Its Dungeon placement adds the voxel anchor, local notes, detection
context, and any later schedule rather than duplicating Encounter truth.
Encounter detection provisionally uses a radius derived from the referenced
monster statistics. Loot and Curiosities do not
activate from proximity alone.

The GM may copy a complete Room, door, or comparable authored identity, or
selected parts of its authored content, and assign the resulting content to
other suitable geometry without violating one-to-one assignment. Ordinary
copies receive independent identities. The GM may instead explicitly create a
reusable template whose assigned instances remain linked and automatically
receive template changes. A linked instance or content block may be deliberately detached,
preserving its current content for independent editing. Templates initially
contain GM-selected authored content blocks and never geometry, geometry
assignment, or stable object identity. This granularity remains subject to
practical usability validation.

Spatial authoring has two foundational forms: directly drawn anchored Areas and
dynamically generated Paths between two or more endpoints or waypoints.
Corridors, stairs, ramps, ladders, shafts, and comparable connection segments
are generated parts of one unified 3D Path model. One Path may combine several
forms between endpoints at different elevations. Segment forms and optional
position constraints are authored properties of the Path, while its exact voxel
route may be derived. Generated Paths materialize ordinary bounded Volumes; Area and Path describe
construction behavior rather than incompatible runtime space types.

Each Path endpoint belongs semantically to one navigation area associated with
a Room and carries an exact 3D anchor on the attached Volume's boundary.
SaltMarcher may propose boundary anchors when the GM connects semantic areas;
the GM may reposition or pin them.

A Path connects through separate Passages in Volume boundaries. Openings,
doors, hatches, secret doors, and comparable forms share this Passage role. The
Passage identity owns description and explicit binary passability; the Path
owns route and travel properties.

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
- removing, splitting, or making geometry unrecognizable does not silently
  delete associated Rooms, door descriptions, or other GM-authored semantic
  content
- SaltMarcher attempts safe reassociation after geometry changes; content that
  cannot be reliably reassociated remains available without geometry until the
  GM reassigns or explicitly deletes it
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
