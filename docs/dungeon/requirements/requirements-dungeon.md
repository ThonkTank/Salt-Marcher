Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-21
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
- project-wide actor autonomy is the explicit exception: for enabled NPCs and
  monsters it may choose and execute bounded jobs and resolve non-party
  conflicts as defined by the Actor Autonomy Requirements
- remote access and collaborative multi-user authoring are not required

## Long-Term Capability Scope

One Dungeon is one continuous spatial whole containing all of its rooms,
surfaces, levels, and spatial content. It is not a collection of internal
Dungeon maps. The raster map is a view of this whole, not a separate authored
container. A Passage link may transition to another Dungeon or external place.

Its spatial foundation behaves as one voxel-like 3D grid with 5-foot horizontal
cells and 5-foot vertical resolution. Creating ordinary walkable space produces
floor, traversable volume, and a default ceiling together with 10 feet of clear
height. The GM may later change height in 5-foot steps, including intentional
5-foot crawlspaces and taller chambers. Stacked spaces and minor elevation
shifts remain part of the same Dungeon.

The raster editor presents an active 10-foot 2D story over two 5-foot vertical
steps and onion-slices geometry above and below. The GM may change slices during
a gesture, allowing click-and-drag operations to span a 3D Volume. Stacked
stories share the same Dungeon geometry; intermediate floors, floors generally,
and walls remain independently editable.

A Volume is bounded, standable geometric interior space. Chambers, corridors,
stair spaces, and comparable geometric forms share movement semantics. A
SaltMarcher silently derives navigation areas from Volume geometry to expose
meaningful internal choices such as corridor junctions and branches. They have
no stable identity, name, description, or authored content and may be freely
recalculated after geometry changes. Manual correction is low priority.

A Room is a stable GM-authored content identity associated with a Volume. It
owns name, descriptions, Features, references, and comparable semantic work.
One Room is associated with at most one Volume and one Volume with at most one
Room at a time; either may temporarily remain unassigned. Moving the Volume
preserves that Room identity and association. After a Volume merge or split,
SaltMarcher immediately makes a best-effort Room assignment for every resulting
Volume; the GM may revise it, and unused authored Rooms remain preserved.
After a split, the existing Room follows the best-matching result and every
other Volume receives a new empty Room. Inherited attributes still apply;
voxel-anchored Features and surface content follow geometry, while full Room
prose is not duplicated automatically. Derived navigation areas
structure a Volume, while room groups collect several Rooms or Volumes.

A Room may provide descriptive defaults for its associated Volume. The GM may
assign overriding authored descriptions, attributes, or templates to selected
contiguous wall, floor, or ceiling regions. Only explicitly described surface
regions require stable content identities and preservation; undescribed voxel
faces remain plain geometry.

Descriptive attributes use common freely valued categories plus GM-defined
attributes and exceptional free text. Values inherit from Dungeon through an
optional Level, an optional room group, Room, and finally an explicitly
described surface region. A Level is a GM-defined set of z-levels within the
same continuous 3D Dungeon, not a map. Level z-level sets do not overlap for
inheritance. Each Room belongs to at most one Level, which the GM may choose or
skip even when the Volume spans several z-levels. SaltMarcher may propose but
MUST NOT force the assignment or split geometry. Allowed parent paths are
Dungeon/Room, Dungeon/Group/Room, Dungeon/Level/Room, and
Dungeon/Level/Group/Room. Dungeon-level groups may span z-levels; Level-owned
groups stay within that Level. Further nested group levels are initially
excluded. Each inheritance path is unambiguous. Different attribute keys
accumulate; a more specific value for the same key replaces only that key. The
GM may explicitly suppress or clear an inherited key. Overlapping collections
or tags may support filters and diagnostics but do not inherit. Attribute
inheritance does not create rules, passability, or effects.

A rendered Room description is a GM-ordered sequence of authored prose, derived
geometry facts, effective attributes, exits, visible Passages, and optional
authored transition text. The GM may reorder blocks and suppress individual
derived facts. Geometry changes update only affected derived content and never
overwrite or reorder GM-authored text.

Description blocks and relevant authored objects may be visible, GM-only, or
hidden until discovered. Secret status is authored truth; discovery by the
current party is separate runtime state. Undiscovered secrets remain absent
from player-readable descriptions and exits without changing explicit
passability. Hidden content may optionally define a search method, DC, private
discovery notes, and revealed text or facts. A passive or GM-entered active
result may prompt the GM privately, but only GM confirmation reveals the
content; manual reveal and re-hide remain available.

Every Dungeon Feature initially has an exact 3D voxel position anchored within
one Volume. Moving or reshaping the Volume carries its Feature anchors with it.
If destructive geometry makes reliable mapping impossible, the Feature remains
preserved without an anchor until reassigned. Encounter context may follow
referenced mobile actors or groups without duplicating their identity. Only
Traps and Encounters support automatic proximity activation. Traps may define zero or more
arbitrary voxel-set trigger fields separate from their anchors. Trigger voxels
remain associated with their Volumes, may span several adjacent Volumes, and
only control notification or travel interruption; they do not alter
passability or decide outcomes. A Trap may own maximum and current Charges for consecutive GM-confirmed actual
activations and a Reset Duration that restores all Charges together. The GM
chooses whether recharge begins at zero Charges or immediately below maximum.
Further activation does not restart a running countdown; completion restores all
Charges. The GM may manually correct the state. An explicit Actor Autonomy job
may reset a Trap. A placed Dungeon Encounter primarily uses
the existing Encounter capability as the source of monster composition and
statistics. Its Dungeon placement adds the voxel anchor, local notes, detection
context, and autonomy integration rather than duplicating Encounter truth. One
concrete Encounter or monster group has at most one current Dungeon placement;
equivalent repetitions require independent Encounter copies. Movement changes
the same group's anchor rather than creating another placement. Encounter
detection uses the shared perception behavior rather than a private proximity
radius. Dungeon Loot placement uses existing Loot content and ultimately
the same shared Loot object as Encounter and Session Generation. The Dungeon
adds voxel placement and local context rather than duplicating currencies,
items, or magic-item truth. One concrete Loot object has at most one current
Dungeon anchor; other feature references do not duplicate it spatially, and
multiple physical occurrences require independent copies. Loot and Curiosities do not activate from proximity alone. Puzzle is a
built-in Curiosity classification rather than a separate foundational Feature
kind; other GM-defined Curiosity tags may be added. Initial Curiosity content
is limited to name, player-readable or read-aloud text, GM-only operation or
solution notes, categories, and tags. It does not program solution steps,
success conditions, or consequences.

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
non-branching dynamically generated Paths between two endpoints with optional
waypoints.
Corridors, stairs, ramps, ladders, shafts, and comparable connection segments
are generated parts of one unified 3D Path model. One Path may combine several
forms between endpoints at different elevations. Segment forms and optional
position constraints are authored properties of the Path, while its exact voxel
route may be derived. Generated Paths materialize ordinary bounded Volumes; Area and Path describe
construction behavior rather than incompatible runtime space types.

Each Path endpoint carries an exact 3D anchor on a Volume boundary.
SaltMarcher may propose boundary anchors when the GM connects Rooms; the GM may
reposition or pin them. A current navigation area may be derived for routing
but is not part of endpoint identity.

A Path connects through separate Passages in Volume boundaries. Door, opening,
gate, hatch, window, secret door, and comparable depictions are visual assets or
decorations of one functional Passage concept. A Passage owns its stable
authored identity, description, whole-face geometry, explicit passability, and
independent sight, light, and sound transmission facts. A Path owns route and
travel properties.

Any Passage may connect geometrically or link to another Passage in the same or
another Dungeon, or to an external campaign place. There is no separate Dungeon
exit type. Link direction and return link are independent per side. Each side
keeps its own description, passability, sensory facts, and optional added
travel time. A missing target leaves a visible, unavailable broken link without
deleting the local Passage or its content.

The Dungeon capability includes:

- Dungeon catalog management
- square-cell, multi-level authored geometry
- rooms, larger named room groups or areas, walls, doors, unified generated
  3D connection Paths, transitions, and GM-authored traps
- descriptions, inspection, stable Dungeon-Key numbering, and campaign-object
  references
- synchronized raster-map, relationship-graph, and Dungeon-Key workflows
- cell-precise runtime positions for the party and selected relevant actors
- GM-operated dungeon travel with time, routes, events, and factual logging
- a human-readable document export containing the map, Dungeon Key, and stable
  references
- a versioned portable Dungeon package for authored Dungeon truth
- a passive display-only second-monitor view using party knowledge, current
  perception, and Fog of War

There is no generic spatial Marker or Prop kind; placed content has a
purpose-specific Dungeon role. An individually authored furnishing, flavor
element, or table-facing interaction is a Curiosity. Incidental furnishing may
remain Room or surface description, and other Features such as Loot may
reference a Curiosity.

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

Rooms, areas, Passages, and Dungeon Features may reference suitable
campaign-owned places, NPCs,
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
- complete exploration runtime state survives restarts, including actors,
  groups, headings, routes, knowledge, timed states, and open prompts
- every migration creates and restore-tests a backup before mutation
- rolling backups use configurable time, count, and storage retention with safe
  defaults, and the GM may request a manual backup
- after a crash, a committed operation is observably either wholly old or
  wholly new, never partial
- a failed migration leaves original and backup unchanged, prevents writable
  opening, and offers diagnostics, retry, and restore
- import MUST preview identity conflicts and missing external references
- the GM may create new identities or map missing external references before import
- import MUST NOT silently overwrite existing authored content
- a portable Dungeon package contains authored Dungeon truth and stable
  references, but not party or actor positions, travel logs, or undo history
- the human-readable export is configurable across raster slices, reduced or
  detailed graph, Dungeon Key, and optional Feature or GM appendices; a
  visibility profile controls secrets and GM-only material
- normal catalog deletion archives a Dungeon, pauses active exploration, and
  preserves links and runtime state
- final deletion moves the Dungeon into a restorable local trash for 30 days;
  explicit immediate destruction remains available
- duplication creates new authored identities and remaps internal references,
  preserves external references, and excludes runtime, knowledge, logs, and
  undo history

## Environment And Runtime Integration

The long-term requirement includes:

- light sources attached to geometry, Features, items, or actors, with optional
  ambient light inherited from Dungeon through Level to Room
- event and persistent sound sources, plus extensible sensory channels
- independent boundary facts for passability, sight, light, and sound
- persistent, logged state actions that may atomically change several authored
  environment states after GM confirmation or an explicit authored trigger
- D&D 5e 2014 perception over 3D line of sight, lighting, distance, cover, and
  relevant senses
- persistent movement tracks, per-actor or per-group track knowledge, search,
  decay, and segment-based pursuit
- integration with project-wide actor autonomy for local spatial jobs,
  movement, perception, tracks, and conflict context
- a passive second-monitor player view with current visibility, remembered
  geometry, unknown space, secrets, and the union of party knowledge

These are binding target capabilities even when delivery is deferred. The
player view remains display-only and does not change the GM-only control model.

## Non-Goals

- a tactical battlemap or combat action economy
- automated resolution of attacks, spells, traps, encounters, or unrestricted
  exploration actions
- direct player control
- remote or multi-user operation
- a runtime user-plugin system
- ownership of external campaign-object truth
- procedural Dungeon generation as a core workflow
- player interaction with the passive second-monitor output

## Quality Needs

- very large sparse Dungeons remain responsive; a qualification Dungeon contains at
  least 100,000 authored cells
- camera and hover work complete within a 16 ms p95 budget
- editor preview completes within a 50 ms p95 budget
- work scales with the visible or touched region rather than total off-screen
  Dungeon content
- a 100,000-authored-cell Dungeon presents its first usable viewport and
  context within 2 seconds p95; remaining data may load progressively
- heavy route, graph, and batch previews show progress within 100 ms, become
  cancellable above 2 seconds, and do not block camera, selection, or
  independent reads
- an ordinary editor commit completes within 500 ms p95
- passive player-view updates complete within 100 ms p95 after movement or a
  visibility change
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
- disconnected but locally valid Volumes and dangling Passages remain valid;
  invalid structural geometry cannot be committed
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
- [Actor Autonomy Requirements](../../autonomy/requirements/requirements-actor-autonomy.md)
- D&D evidence:
  `/home/aaron/Schreibtisch/projects/references/literature/dnd-basic-rules-2014-adventuring.md`
  ([public source](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/adventuring))
