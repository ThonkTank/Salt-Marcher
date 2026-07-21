Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-21
Source of Truth: Confirmed solution-neutral Dungeon authoring and inspection
behavior.

# Dungeon Editor Requirements

## Goal

Let one GM author and maintain complete multi-level Dungeon truth through three
specialized, synchronized views without requiring duplicate edits or exposing
internal storage and routing concepts.

## Shared Authoring Outcomes

The editor MUST let the GM:

- create, rename, load, reload, and delete Dungeons
- author and inspect rooms, named room groups or areas, walls, doors, corridors,
  stairs, transitions, traps, descriptions, and campaign references
- copy a complete authored Room, door, or comparable content identity, or
  selected reusable parts of its authored content, and assign the copy to
  suitable geometry
- work on positive and negative levels and coordinates without a fixed Dungeon
  boundary
- select a stable authored object and find the same object in every applicable
  view
- preview, confirm, cancel, undo, and redo supported changes
- receive a clear, specific explanation when a change cannot be applied

Exact pointer buttons, menus, dropdown behavior, pixel widths, and control
placement are replaceable UX design. Required outcomes are fast selection,
understandable preview, explicit completion or cancellation, safe rejection,
and discoverable tools.

## Authoring Entry Points

The raster view and relationship graph are equal primary entry points for a new
Dungeon. Both represent one continuous Dungeon whole rather than separate maps. A GM may begin and continue structural authoring in either view.
Changes in each view synchronously affect the same Dungeon structure; neither
view is merely a downstream presentation of the other.

The Dungeon Key is a secondary refinement surface for descriptions and other
primarily textual content after or alongside structural authoring.

## Raster Authoring View

The editor raster view owns direct spatial authoring. Ordinary floor drawing
uses 5-foot horizontal cells and 5-foot vertical resolution, and automatically
creates floor, traversable Volume, and a 10-foot-clear default ceiling. The
normal editor presents one 10-foot story as a 2D active slice spanning two
vertical steps. Geometry immediately above and below appears through
onion-slicing.

The GM may switch slices before or during an editing gesture. A click-and-drag
surface operation may therefore span several slices and create a 3D Volume.
Stories may be stacked directly; removing an intermediate floor opens the
vertical geometry. Floors and walls remain independently editable despite the
automatically created standard shell.

Floor mode paints or erases horizontal faces on cells at the active height
using the configured brush and eraser forms. Wall mode draws walls through
click-and-drag along cell edges and sets vertical extent in 5-foot steps.
Selection can then move, extend, shorten, or change their height. Automatically
created boundaries become ordinary editable floors and walls. Off-grid walls
remain deferred.

Its foundational fixed-Area tools are:

- a brush with selectable shapes and adjustable radius
- a polygon or surface tool that draws different area forms through
  click-and-drag
- an eraser with matching shape and radius capabilities
- selection that can move, distort, and edit existing geometry

Selection supports one target, additive selection, rectangle, lasso, a 3D
range, and type or property filters. If several objects occupy the hit point,
the editor shows a candidate list that can be cycled; it never relies on a
silent fixed hit priority. A spatial range touching only part of a Volume
selects the whole Volume for transforms and does not cut it.

Selected Volumes may be moved and copied on the grid, rotated in 90-degree
steps, mirrored horizontally or vertically, and deformed through corner or edge
handles. Ground-plan handles change the complete prism by default. Arbitrary
angles and off-grid scaling are not required. Multiple selected Volumes
transform as one arrangement while preserving their relative spacing and
internal links; external Paths reroute in preview.

Brush, surface tool, and eraser operate directly on geometry regardless of the
current selection. Overlapping or newly connected geometry automatically merges
Volumes; separating geometry automatically splits a Volume. Completion requires
no additional confirmation dialog, and ordinary undo is the expected recovery
path.

After every merge or split, SaltMarcher immediately makes a best-effort complete
Room assignment for every resulting Volume. The assignment does not block
geometry editing and the GM may change it afterward. Existing authored Rooms
not selected for an assignment remain preserved without geometry.

After a split, the existing Room follows the best-matching resulting Volume.
Every other resulting Volume receives a new initially empty Room. Inherited
Dungeon, Level, and group attributes continue to apply. Voxel-anchored Features
and described surface regions follow their geometry, while complete Room prose
is not duplicated automatically. The GM may copy or reassign it afterward.
Selection remains relevant to transforms and detailed edits, not to
choosing the target of drawing or erasing.

Floor, traversable Volume, and default ceiling remain one coordinated spatial
result while these tools operate.

The raster model supports two foundational geometry forms:

- directly drawn anchored Areas whose geometry changes only through explicit GM
  edit or removal
- unified non-branching generated 3D Paths between two endpoints and optional
  waypoints; one Path may combine corridor, stair, ramp, ladder, shaft, and
  comparable segments

Both forms produce bounded, standable geometric Volumes. Chambers, corridors,
stair spaces, and comparable forms use equivalent movement semantics even when
their authoring behavior differs. A Volume may be partitioned into navigation
areas at meaningful internal decisions such as corridor junctions.

A Path remains parametrically defined by two endpoints, optional waypoints,
cross-section, and further path properties. One Path never branches;
T-junctions and networks arise from separate Paths meeting at a common anchor
or Volume. It may carry an authored connection form for individual segments,
including corridor, stair, ramp, ladder, or shaft. SaltMarcher proposes route,
Passages, and segment forms in a protected preview. The GM can override a form
or refine the route with waypoints and pins. Segment forms remain properties of
the same Path rather than separate foundational content objects.

The Path's exact voxel geometry derives from those facts. Moving a connected
endpoint produces a rerouted preview rather than a silent commit. Normal path
editing changes points or parameters. Routing avoids existing geometry and
rejects an impossible route instead of silently breaking through it. The
default cross-section is 5 feet wide and 10 feet high; the complete Path or an
individual segment may override width and height in 5-foot steps.

The GM may explicitly convert a Path into a fixed Area for fully custom
geometry. Conversion preserves its current materialized volume and ends
automatic rerouting.

Every Path endpoint has an exact 3D anchor on a Volume boundary. When the GM
connects Rooms without choosing exact anchors, SaltMarcher proposes suitable
boundary anchors. The GM can move or pin them. Current navigation areas may be
derived from geometry for routing and graph presentation but are not stable
semantic endpoint identities. An unpinned endpoint may move to a suitable new
boundary after geometry changes. A pinned endpoint follows its local position
on the Volume and produces a repairable preview conflict if no valid route can
preserve it.

A Path meets each Volume through a separate Passage at its boundary. Passage is
one functional concept; door, opening, gate, hatch, window, secret door, and
comparable forms are visual assets or decorations. A Passage may be placed only
on an existing wall or Volume boundary, but one Volume side is sufficient for a
dangling authored approach into unbuilt space.

Passage geometry uses complete 5-foot boundary faces, with 10-foot default
height. Width and height remain resizable in 5-foot steps under the same
identity. A wide Passage is authored as one wide object; adjacent independently
created Passages remain independent. Overlap with another Passage is rejected
atomically with a specific reason.

Removing Passage geometry restores the wall but preserves Passage identity,
description, and authored facts unassigned until reassigned or explicitly
deleted. If later geometry has one unambiguous fit, it rebinds automatically;
ambiguous fits require a preview and GM choice.

Any Passage may link to another Passage in the same or another Dungeon or to an
external campaign place. There is no special exit kind. Direction and return
link are authored independently per side, and each side keeps its own
description, passability, sensory facts, and optional added travel duration. A
missing target leaves a visible broken and unavailable link until relinked or
removed.

## Feature Placement And Environment Authoring

Encounter, Trap, Loot, and Curiosity use one shared placement mode: select the
kind or owning source, place its exact voxel anchor, then edit kind-specific
details. An existing Feature anchor may be dragged or reassigned across Volumes
without changing identity. Several Features may share a voxel and use the same
candidate-list selection behavior as other ambiguous hits.

Trap trigger editing is a raster overlay with brush, range, and eraser tools.
All trigger voxels for one Trap form one semantic set, even when they span
Volumes. Feature layers are independently toggleable, show a type symbol, and
show the name on hover or selection. Secret visibility follows the selected GM
or player perspective.

The editor lets the GM author light sources attached to geometry, Features,
items, or actors, plus optional ambient light inherited from Dungeon through
Level to Room. It independently edits passability and boundary transmission
for sight, light, sound, and later sensory channels. Persistent sound sources
and authored state actions may also be spatially anchored.

A Feature may offer named, GM-confirmed state actions that atomically set or
toggle several Passage, light, sound, or mechanism states. Only explicit
authored triggers such as time, entering an area, elapsed duration, or a
confirmed action may invoke such an action automatically. The resulting state
persists until another action, trigger, or GM edit changes it.

Additional raster capabilities include:

- draw and reshape room and area geometry
- place and edit walls, Passages, unified connection Paths, links, traps,
  and other purpose-specific spatial objects
- select authored objects, rooms, and areas for detailed inspection
- change levels, pan, zoom, jump to coordinates, fit selection, and fit authored
  content
- show pending geometry as a non-persisted preview
- expose enough specific feedback to repair invalid or conflicting geometry

The runtime travel raster is not an authoring surface. It displays the Dungeon
passively and lets the GM select rooms, objects, actors, and other targets to
open their descriptions in a detail pane.

## Relationship-Graph Design View

The graph is an abstract, zoomed-out Dungeon-design and debugging surface. It
represents the party's meaningful navigation decisions rather than mirroring
every raster object one-to-one. Rooms, room groups, and relevant decision
points may appear as nodes; routes and transitions appear as edges. Incidental
geometry may be collapsed only when real choices, connection types, current
states, and travel effects remain understandable.

Authored Passages, Paths, and links influence graph
relationships. Mere geometric adjacency without an authored opening does not
create an edge. A structurally present but currently impassable connection
remains visible with a distinct state. Geometrically detected climb, jump, or
similar special-route candidates remain distinguishable from ordinary safe
connections.

It MUST help the GM inspect and manage:

- room and room-group flow
- the distribution of decision complexity
- travel times between relevant points
- placement and density of puzzles, loot, encounters, curiosities, and similar
  content
- important relationships and transitions that are difficult to understand at
  raster scale

Graph detail is adjustable. At maximum detail the graph may show every
individual door, room, and connection. At progressively reduced levels it
collapses unbranched routes, individual rooms, and then room groups into
higher-level routes and navigation decisions. Flow, travel-time, and content
facts aggregate to the visible level without replacing or discarding their
underlying authored facts.

The strongest reduction follows Melan-diagram principles documented by The
Alexandrian:

- straighten non-branching routes and remove irrelevant turns
- collapse doors, intermediate spaces, and short dead ends that do not create a
  meaningful macro-level navigation choice
- preserve true forks, loops, secret or unusual paths, and level connections
- avoid counting fake loops whose branches immediately rejoin without creating
  meaningful route diversity
- let edge length communicate approximate travel effort without reproducing
  raster geometry

Unlike the original analysis-only method, SaltMarcher's graph is also an
authoring surface. It MUST preserve the distinction between abstract planned
structure and protected provisional raster translation.

The graph additionally supports a debug-style content heatmap. A route in this
primary diagnostic means one edge between two visible graph nodes, not a full
multi-node start-to-destination journey. Nodes and edges use colors, icons, or
comparable encodings to show the type and concentration of Treasure,
Encounters, Curiosities, puzzles, danger, rewards, and comparable authored
content across the Dungeon.

A later full-path comparison may build on these facts but has lower priority
than the immediate node-and-edge heatmap. Diagnostics inform GM judgment and
MUST NOT enforce one supposedly correct Dungeon structure or content balance.

The GM can toggle individual heatmap layers for danger, Encounters, Treasure,
other rewards, Curiosities, puzzles, secrets, and additional content types.
One active layer uses a clear intensity scale across nodes and edges. A combined
overview uses distinguishable icons, bars, or a comparable multi-category
encoding rather than one ambiguous mixed color.

The graph can switch between absolute content amount and concentration relative
to travel time or route extent. Collapsing graph detail aggregates the
underlying node and edge values to the visible level without losing category
distinctions.

Heatmap facts come only from explicit authored Dungeon Features, not from
guessing content out of room prose. Initial feature kinds include Encounter,
Trap, Loot, and Curiosity.

A Curiosity is the common Feature kind for puzzles, individually authored
flavor, table-facing interactions, and concrete furnishings such as a table,
statue, or fountain. There is no separate generic Prop kind. Incidental
furnishing may remain Room or surface description, while Loot or other
purpose-specific Features may reference the Curiosity. Puzzle is a built-in Curiosity classification rather than a
separate foundational Feature kind; additional GM-defined tags may be added.
Its initial content consists of a name, player-readable or read-aloud free text,
GM-only notes for operation, solution, or possible reactions, plus categories
and tags. It has no programmed solution steps, success conditions, or automatic
consequences. Later versions may add optional links or simple consequences such
as changing lights or unlocking a referenced door without replacing GM-authored
text or authority.
Diagnostics may count all Curiosities and the Puzzle-classified subset
separately, but MUST NOT assign Curiosities a qualitative score.

The graph may show advisory pacing warnings for probable underfilling,
overfilling, or local content concentration. Warnings remain explainable,
overridable, and non-blocking.

Danger and Loot diagnostics use the existing DMG-guided budget models already
owned by SaltMarcher. The GM can define intended character level and planned
session count for a complete Dungeon, one level, or one area. Authored Encounter,
Trap, and Loot Features are compared with the resulting XP, gold, and magic-item
budgets.

Curiosity diagnostics use count and local density only. They MUST NOT infer
quality or importance from Curiosity prose. General content-density references
such as The Alexandrian's approximate content-bearing-room guidance may add
separate pacing hints, but MUST NOT replace the rule-based danger and Loot
budgets.

Target level inherits from the complete Dungeon into levels and areas unless the
GM overrides it at a narrower scope. Planned sessions do not duplicate into
every child scope. The GM explicitly allocates Dungeon session shares to levels
or areas, and unallocated shares remain visible.

Child budget and actual-content summaries roll up without double counting. A
scope without allocated sessions still receives neutral heatmaps, Curiosity
density, and general distribution hints, but no misleading XP, gold, or
magic-item budget warning.

The GM may rearrange rooms and room groups in the graph. SaltMarcher translates
those changes into raster geometry as far as possible.

Creating a room in the graph immediately creates provisional raster geometry.
Graph position and relationships provide the initial room and connections. The
GM may optionally supply rough size, shape, or level hints without drawing
cells in the graph. The result remains protected Graph-Edit Preview state until
the GM returns to the raster editor, refines or restores it, and explicitly
accepts it.

Every graph detail level remains editable with abstraction-appropriate
operations:

- detailed views edit individual rooms, doors, and connections
- middle detail may move, duplicate, connect, or remove complete rooms and room
  groups as units
- the strongest reduction may restructure high-level routes and groups

A connection authored between collapsed groups is provisional planning intent.
SaltMarcher may generate plausible concrete endpoints and raw geometry for the
protected raster preview, but MUST NOT silently resolve ambiguity to an
arbitrary door or cell.

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

SaltMarcher initially assigns display numbers unique within one conceptual
Level. The GM may change or reorder them without changing internal Room
identity or breaking references. Moving a Room into a Level with a conflict
assigns the next free number. Cross-Level and Dungeon-wide references and
exports show `Level + number`.

Full-text search, filters for number, Level, group, Feature, secret, and status,
and sorting support large Dungeon Keys. Selecting a result navigates to the same
object in graph and raster.

Batch editing may change every supported field, including names, read-aloud
text, and GM notes. Text batches support complete replacement, prepend, append,
and search/replace. A batch applies immediately and atomically as one undoable
editor action; it does not require a separate preview.

## Hybrid Room Descriptions

A rendered room description combines:

- dynamic geometry facts and spatial relationships
- GM-authored descriptive attributes such as shape, height, materials,
  atmosphere, temperature, moisture, door appearance, and similar qualities

During travel, relative language such as “in front of you”, “left”, and
“right” derives from current party heading and approach. Outside current travel,
the Dungeon Key, editor, and document export use stable map directions such as
north or southwest.

The rendered description is an ordered sequence of blocks. Blocks may contain
GM-authored read-aloud prose, derived geometry facts, inherited or local
attributes, exits and visible Passages, and additional authored transitions or
prose. The GM may reorder blocks, suppress individual derived facts, and insert
authored text between them.

The editor lets the GM choose an entrance or heading to preview the relative
read-aloud result. Geometry changes recompute only affected derived facts
without overwriting or reordering GM-authored text and attributes.

Description blocks and relevant authored objects may be normally visible,
GM-only, or hidden until discovered. An undiscovered secret Passage is omitted
from player-readable text and visible exits. Secret status remains authored
truth; discovery by the current party is separate runtime state. The editor can
preview both undiscovered and discovered renderings. Visibility does not alter
explicit passability.

Hidden content may optionally define a search method, DC, private discovery
notes, and the text or facts revealed afterward. SaltMarcher may compare passive
values or a GM-entered active-check result and privately notify the GM. It MUST
NOT reveal content without GM confirmation. The GM may manually reveal or hide
it again.

Descriptions such as blocked, locked, heavy, cold, or damp affect generated
wording and placement in the dynamic description. They MUST NOT silently create
passability or action rules.

Common categories such as material, condition, light, temperature, moisture,
smell, sound, and atmosphere accept freely authored values. The GM may add
custom named attributes and exceptional free-text phrasing.

Descriptive attributes inherit through Dungeon, optional Level, optional room
group, Room, and explicitly described surface-region scopes. A Level is a
GM-defined set of z-levels in the same continuous 3D Dungeon, not another map.
Every inheriting object has one unambiguous parent path. A Room belongs to at
most one Level; SaltMarcher may propose one from geometry, but the GM may assign
the conceptual Level or skip the Level scope entirely. A multi-z-level Room is
never geometrically split to satisfy inheritance. Level z-level sets do not
overlap for inheritance. Allowed parent paths are Dungeon to Room, Dungeon to
room group to Room, Dungeon to Level to Room, and Dungeon to Level to room group
to Room. A Dungeon-level group may span z-levels; a Level-owned group remains
within that conceptual Level. Further nested room-group levels are initially
excluded. Different attribute keys accumulate through inheritance. A more
specific value for the same key replaces only that key, while other inherited
values remain. The GM may explicitly suppress or clear an inherited key.
Additional overlapping collections or tags may support filtering and heatmaps
but do not inherit attributes. The editor exposes every effective value and its
origin and lets the GM restore inheritance. Attribute inheritance MUST NOT
create rules, passability, or effects.

## Geometry And Authored-Content Lifecycles

- a Room may provide default descriptive attributes for its complete associated
  Volume
- the GM may select a contiguous wall, floor, or ceiling region and assign
  overriding descriptions, attributes, or templates to that surface region
- an explicitly described surface region receives a stable authored content
  identity and the same preservation and reassignment guarantees as Rooms and
  doors
- raw undescribed voxel faces do not each require a separate content identity
- Passages remain explicit independent objects because they affect travel
- every Dungeon Feature initially has one exact 3D voxel anchor within a Volume
- moving or reshaping that Volume carries the Feature anchor with it
- when destructive geometry prevents reliable anchor mapping, the Feature
  remains preserved for reassignment
- Encounter context may follow referenced mobile actors or groups without
  duplicating their identity
- only Traps and Encounters initially support automatic proximity activation
- a Trap may own zero or more trigger fields separate from its Feature anchor
- each trigger field is an arbitrary GM-marked voxel set rather than a required
  radius or fixed shape
- trigger voxels remain associated with their Volumes and follow Volume movement
  or deformation; one Trap may span fields in several adjacent Volumes
- trigger fields only notify and interrupt travel, and do not alter passability
  or decide fictional outcomes
- a Trap defines maximum and current Charges; only a GM-confirmed actual
  activation consumes one
- at zero Charges the Trap cannot activate automatically
- Reset Duration restores all Charges together
- per Trap, the GM chooses whether the reset countdown starts only at zero or as
  soon as current Charges fall below maximum
- consuming another Charge does not restart a running countdown; its completion
  restores all Charges regardless of intervening use
- the GM may manually correct current Charges and reset state
- an explicit Actor Autonomy job may perform a Trap reset
- a placed Dungeon Encounter primarily references the existing SaltMarcher
  Encounter capability for monster composition and statistics rather than
  duplicating them
- the Dungeon placement adds its voxel anchor, local Dungeon notes, detection
  behavior, and autonomy integration
- one concrete Encounter or monster group has at most one current Dungeon
  placement; repeated equivalent encounters require independent Encounter copies
- later movement changes that group's existing anchor rather than creating
  another placement
- Encounter detection uses the shared perception behavior
- Dungeon Loot placement uses existing Loot content and ultimately the same
  shared Loot object used by Encounter and Session Generation, rather than
  duplicating currencies, items, or magic-item truth
- the Dungeon placement adds the voxel anchor and local Dungeon context
- one concrete Loot object has at most one current Dungeon anchor; Encounter
  and Session Generation references do not create additional spatial copies
- repeated physical Loot requires independent copies, while movement changes
  the existing anchor
- Loot and Curiosity Features do not activate solely because the party is nearby
- a Volume is geometric truth; a Room is stable GM-authored content associated
  with a Volume
- one Room is assigned to at most one Volume and one Volume to at most one Room
  at a time; either may temporarily be unassigned
- navigation areas are silently derived from Volume geometry for routing and
  decision presentation; they have no stable identity, name, description, or
  authored content and may be freely recalculated
- manual navigation-area correction is optional and low priority, while room
  groups collect several Rooms or Volumes
- moving a Volume preserves its Room association and Room identity
- after a Volume is removed, split, or made unrecognizable, SaltMarcher attempts
  a safe reassociation to suitable resulting geometry
- when reliable reassociation is not possible, the Room and all of its authored
  content remain available without a geometry assignment
- the same protection applies to other described authored identities, including
  doors: deleting their geometry does not delete their description or semantic
  content
- only an explicit content-deletion action removes preserved GM-authored content
- the GM may duplicate whole authored identities or selected content parts and
  assign the resulting content independently to other suitable geometry
- an ordinary reassignment or copy receives its own identity and changes
  independently
- the GM may explicitly turn supported authored content into a reusable template
  and assign that template to several instances
- template assignments remain linked and automatically receive later template
  changes
- a template initially contains a GM-selected set of authored content blocks;
  geometry, geometry assignment, and stable object identity remain excluded
- only included blocks stay linked; other instance content remains independently
  editable, while editing a linked block requires deliberate detachment
- the GM may deliberately detach one linked instance or block; detached content
  preserves its current value and changes independently
- this template granularity is an initial testable workflow and may be refined
  after practical usability evaluation
- the reassociation mechanism is replaceable; the required outcome is visible,
  recoverable preservation without silent data loss

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
- one action spanning several Dungeons, such as paired Passage links, commits
  and reverses atomically
- all geometry and content tools remain available during active exploration;
  a committed change becomes travel truth immediately
- a geometry or passability commit revalidates active autoroutes; an invalid
  route stops at its last completed segment with a specific reason
- if edited geometry removes an actor cell, the preview first relocates that
  actor to the nearest valid cell in the same Volume, then a directly connected
  Volume; without such a cell the edit is rejected
- geometry and administrative actor relocations commit and undo atomically;
  relocation consumes no travel time or events and is logged with the edit
- committed geometry is always structurally travel-valid; empty Dungeons,
  disconnected locally valid Volumes, and dangling Passages remain valid

## Sparse-Dungeon Responsiveness

- authored coordinates have no fixed width or height boundary
- camera, hover, selection, preview, and rendering work scales with visible
  primitives and touched spatial regions
- off-screen authored content does not force global work for a local gesture
- camera and hover work meet a 16 ms p95 budget
- preview over already available local data meets a 50 ms p95 budget
- qualification includes at least 100,000 authored cells in a sparse Dungeon

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
- selection, transforms, Path routing, Passage lifecycle, Feature placement,
  and live actor relocation preserve stable authored identities
- generated geometry text updates without destroying GM-authored semantics
- document output remains understandable without current runtime party state
- ordinary local work remains responsive in the sparse qualification Dungeon

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Dungeon Travel Requirements](./requirements-dungeon-travel.md)
- [Maps Canvas Requirements](../../maps/requirements/requirements-maps-canvas.md)
- [Dungeon Needs Interview](../../project/interviews/2026-07-20-dungeon-needs-interview.md)
- Alexandrian evidence:
  `/home/aaron/Schreibtisch/projects/references/literature/alexandrian-xandering-the-dungeon.md`
- Melan-diagram evidence:
  `/home/aaron/Schreibtisch/projects/references/literature/alexandrian-melan-diagram.md`
- Sector-crawl evidence:
  `/home/aaron/Schreibtisch/projects/references/literature/alexandrian-sector-crawl.md`
- Dungeon-type evidence:
  `/home/aaron/Schreibtisch/projects/references/literature/alexandrian-types-of-dungeons.md`
