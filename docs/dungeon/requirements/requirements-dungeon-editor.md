Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-20
Source of Truth: Confirmed solution-neutral Dungeon authoring and inspection
behavior.

# Dungeon Editor Requirements

## Goal

Let one GM author and maintain complete multi-level Dungeon truth through three
specialized, synchronized views without requiring duplicate edits or exposing
internal storage and routing concepts.

## Shared Authoring Outcomes

The editor MUST let the GM:

- create, rename, load, reload, and delete Dungeon maps
- author and inspect rooms, named room groups or areas, walls, doors, corridors,
  stairs, transitions, markers, traps, descriptions, and campaign references
- work on positive and negative levels and coordinates without a fixed map
  boundary
- select a stable authored object and find the same object in every applicable
  view
- preview, confirm, cancel, undo, and redo supported changes
- receive a clear, specific explanation when a change cannot be applied

Exact pointer buttons, menus, dropdown behavior, pixel widths, and control
placement are replaceable UX design. Required outcomes are fast selection,
understandable preview, explicit completion or cancellation, safe rejection,
and discoverable tools.

## Raster Authoring View

The editor raster view owns direct spatial authoring:

- draw and reshape room and area geometry
- place and edit walls, doors, corridors, stairs, transitions, markers, traps,
  and other spatial objects
- select authored objects, rooms, and areas for detailed inspection
- change levels, pan, zoom, jump to coordinates, fit selection, and fit authored
  content
- show pending geometry as a non-persisted preview
- expose enough specific feedback to repair invalid or conflicting geometry

The runtime travel raster is not an authoring surface. It displays the map
passively and lets the GM select rooms, objects, actors, and other targets to
open their descriptions in a detail pane.

## Relationship-Graph Design View

The graph is an abstract, zoomed-out Dungeon-design and debugging surface. It
MUST help the GM inspect and manage:

- room and room-group flow
- the distribution of decision complexity
- travel times between relevant points
- placement and density of puzzles, loot, encounters, curiosities, and similar
  content
- important relationships and transitions that are difficult to understand at
  raster scale

The GM may rearrange rooms and room groups in the graph. SaltMarcher translates
those changes into raster geometry as far as possible.

### Protected Graph-Edit Preview

- graph rearrangement begins a protected, transient edit mode
- the raster result appears only when the GM returns to the raster editor
- the GM may repair translated geometry with ordinary raster-editor tools
- no graph-edit result becomes permanent until the GM accepts the combined
  result
- before acceptance, one action restores the complete Dungeon state from
  immediately before graph editing began
- this protected restoration remains available independently of the ordinary
  undo/redo depth or memory cap
- failed or ambiguous translation MUST NOT silently discard authored content

## Room List And Dungeon Key

The room-list view presents a focused, human-readable Dungeon Key. It MUST let
the GM efficiently edit primarily textual and semantic content through spacious
room-editing dialogs.

Each room entry includes at least:

- stable editable display number
- name
- read-aloud description
- GM description or notes
- exits and relationships
- linked actors, objects, encounters, and events

SaltMarcher initially assigns unique display numbers. The GM may change or
reorder them without changing internal room identity or breaking references.

## Hybrid Room Descriptions

A rendered room description combines:

- dynamic geometry facts and spatial relationships
- GM-authored descriptive attributes such as shape, height, materials,
  atmosphere, temperature, moisture, door appearance, and similar qualities

During travel, relative language such as “in front of you”, “left”, and
“right” derives from current party heading and approach. Outside current travel,
the Dungeon Key, editor, and document export use stable map directions such as
north or southwest.

The editor lets the GM choose an entrance or heading to preview the relative
read-aloud result. Geometry changes recompute geometric relations without
overwriting GM-authored attributes.

Descriptions such as blocked, locked, heavy, cold, or damp affect generated
wording and placement in the dynamic description. They MUST NOT silently create
passability or action rules.

## Commit, Preview, And History

- each completed, validated authoring action persists immediately
- previews, canceled gestures, camera changes, selection, and rejected work do
  not persist authored truth
- rejection preserves the last valid authored state and identifies the reason
- undo/redo covers at least the latest 200 ordinary committed changes in the
  current editor session
- unusually large operations may be limited by a documented encoded-memory
  budget
- a new commit after undo discards that session's redo branch
- undo/redo preserves stable authored identities
- history is session-scoped and is not exported as Dungeon truth
- one action spanning several maps, such as a bidirectional transition, commits
  and reverses atomically

## Sparse-Map Responsiveness

- authored coordinates have no fixed width or height boundary
- camera, hover, selection, preview, and rendering work scales with visible
  primitives and touched spatial regions
- off-screen authored content does not force global work for a local gesture
- camera and hover work meet a 16 ms p95 budget
- preview over already available local data meets a 50 ms p95 budget
- qualification includes at least 100,000 authored cells on a sparse map

## Extensibility Qualification

The editor design is considered adaptable only when adding a new authored
object or tool family requires local, explicit changes and does not require
unrelated feature, travel, persistence, or shell rewrites.

## Acceptance Outcomes

- one room, area, object, relationship, and description remains recognizable
  across raster, graph, and Dungeon-Key views
- geometry editing stays in the raster authoring view
- graph edits remain safely reversible until raster cleanup and final acceptance
- text-centric editing is efficient in the Dungeon-Key view
- generated geometry text updates without destroying GM-authored semantics
- document output remains understandable without current runtime party state
- ordinary local work remains responsive on the sparse qualification map

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Dungeon Travel Requirements](./requirements-dungeon-travel.md)
- [Maps Canvas Requirements](../../maps/requirements/requirements-maps-canvas.md)
- [Dungeon Needs Interview](../../project/interviews/2026-07-20-dungeon-needs-interview.md)
