Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Editor-facing dungeon behavior, visible states, and acceptance
criteria.

# Dungeon Editor Requirements

## Goal

Define the required editor workflow over committed authored dungeon truth so
the user can manage maps, select stable authored targets, preview changes, and
commit supported mutations without inventing a second authored state source.

## Non-Goals

- shared canvas contract design
- renderer scene structure
- authored dungeon invariants
- SQLite schema detail

## Current State

- SaltMarcher already ships map CRUD, grid or graph view switching, level and
  overlay controls, stable selection, live preview, room paint and delete,
  wall and door editing, handle or cluster movement, and room narration cards.
- SaltMarcher already keeps corridor, stair, and transition tool families
  directly visible in the editor controls, but their end-to-end authored
  behavior is still only partially present compared with the richer sibling
  repo surface.
- Current live editor controls still expose some create/delete variants as
  separate top-level buttons. That is current-state drift from the target
  family-button model below, not a target interaction pattern.
- Current manual testing found drift in corridor, cluster, wall, label, and
  stair workflows. The target behavior below supersedes older verification rows
  that marked those routes as complete when they contradict this document.
- The sibling `salt-marcher` repo shows the fuller visible target-state editor
  experience for corridor creation or merge, stair parameter editing, and
  transition destination selection.
- No current SaltMarcher editor surface evidence was found for dedicated
  committed-history controls. Any future history behavior remains target-state
  rather than currently shipped behavior.

## Visible Structure

- three control rows: map management, level/overlay/projection controls, and
  directly visible tool-family controls
- main content is the shared dungeon map surface in editor mode
- state content shows active tool, selection, preview state, mutation status,
  and room narration cards or tool-specific editing cards

## Tool Family Selection

- tool selection MUST use one focused button per editor tool family instead of
  separate top-level buttons for subactions inside the same family, including
  stair create/delete variants
- the tool-family button row SHOULD be no wider than the tool panel when the
  editor is displayed in the normal tool-panel layout in a `960px` wide app
  window
- room, wall, door, corridor, stair, and transition families MUST use this same
  map-surface gesture mapping:
  LMB or primary input selects or places the family's normal authored target,
  RMB or secondary input deletes or removes the target, and Shift-modified input
  performs the family's alternate edit action when that family defines one
- place and delete intent MUST be separated by the shared map-surface gesture
  mapping instead of a second menu choice after the family button is selected
- family-specific parameters such as stair shape, wall interaction mode,
  transition destination, or corridor endpoint details MAY be edited through
  the state panel or another focused parameter surface, but they MUST NOT
  replace the shared place/delete gesture convention
- secondary tool options that choose a mode, shape, destination kind, link
  behavior, or other parameter value rather than place/delete/alternate edit
  intent MUST appear in a dropdown window anchored under the focused family
  button
- a family-button dropdown MUST preselect the last used sub-option for that
  family, or the first available sub-option when no previous selection exists
- a family-button dropdown MUST close automatically when the pointer leaves the
  dropdown window area
- `Esc` MUST reset the current tool family and sub-option selection back to the
  general `Auswahl` tool

## Required Behavior

- the editor MUST let the user create, rename, delete, load, and reload maps
- created maps MUST start empty
- deleting the currently selected map while at least one other map remains MUST
  remove that map and its authored dungeon content, clear transient selection
  and preview state, and then select the first remaining map in the current
  catalog order
- `Auswahl` MUST remain directly visible
- room, wall, door, corridor, stair, and transition families MUST remain
  directly visible as tool buttons
- directly visible tool buttons MUST represent tool families, not separate
  top-level create and delete variants
- selection MUST resolve stable authored targets rather than presentation-only
  guesses
- preview MUST read as if the pending operation were applied, but MUST NOT
  persist authored truth
- handle drag preview MUST be responsive and MUST avoid a full authored
  map reload during per-mouse-move preview when the typed preview can be
  rendered from the current editor session
- apply MUST commit only on explicit gesture completion
- corridor editing MUST support visible create and delete flows
- stair editing MUST support visible create and delete flows plus stair shape,
  direction, and exit-level configuration
- transition editing MUST support visible create and delete flows plus
  destination selection for dungeon or overworld outcomes
- cluster and room naming MUST support default names plus user-authored custom
  names through the state panel and direct label editing

## Supported Interaction States

- room paint and delete on the active level
- wall create and delete through boundary paths
- wall creation defaults to path-based drawing; single-click wall work is an
  alternate mode, not the default
- door create and delete through boundary selection, including cluster
  perimeter doors on outer walls
- door selection exposes the stable authored door target and deletion status,
  but there are no door-specific editable state-panel fields in this
  requirements set beyond room exit narration and the shared delete/reject
  behavior
- room narration editing from the state pane
- handle movement for selectable editor handles
- straight wall-stretch movement for selected cluster walls
- selected cluster corner movement through published corner handles and
  selected wall-line movement through published wall-midpoint handles
- selecting a cluster floor area MUST expose the same cluster corner and
  wall-run handles as selecting that cluster through its label
- door handles MUST be visible canvas handles, hittable through the shared
  handle route, draggable with live preview, and committed as authored door
  boundary movement
- corridor create and delete flows
- corridor targeting resolves to explicit authored endpoints only: room-side
  doors and corridor-side anchors
- generic room hits and generic corridor hits remain allowed input, but the
  committed corridor MUST bind to a concrete authored door or corridor anchor
- stair create and delete flows with visible shape and exit configuration
- transition create and delete flows with description, destination, and
  bidirectional-link options
- custom cluster and room name editing through state-panel fields and direct
  map-label editing
- grid and graph projection modes
- level and overlay controls that affect presentation only

Corridor, stair, and transition editing are still partial in current
SaltMarcher builds, but they remain visible target-state surface obligations in
this requirements document because the user-facing feature shape is already
evidenced in the sibling repo.

## Clarified Geometry Behavior

- room paint merges only when the newly painted rectangle overlaps at least one authored cell of an existing room or cluster
- a single-cluster overlap merge MUST keep existing room and cluster identity, add the newly painted non-overlapping cells, and recompute the perimeter without duplicated overlap cells
- adjacent room paint with no overlapping authored cell MUST create a distinct room and cluster even when the new rectangle touches an existing room edge
- a freshly painted or adjacent new room uses the painted rectangle's minimum cell as its room component and cluster center until a later explicit move or stretch changes it
- freshly painted or adjacent new rooms MUST read back after commit and reload
  with the full painted floor-cell set and a closed perimeter wall around that
  floor set
- freshly painted or adjacent new room perimeter walls MUST be authored durable
  wall truth after commit; absent perimeter wall rows are old-map compatibility
  input only, not the target output of fresh room creation
- intentional wall deletion on a room perimeter MUST be observable as an authored open edge, distinct from an absent un-authored edge whose perimeter wall may still be derived
- overlap merges MUST NOT leave stale old boundary rows visible as internal walls inside the merged room
- wall finalization is idempotent: existing wall segments reuse topology, absent boundary segments create or mark that segment as wall, and neither path creates duplicate topology rows
- path-based wall drawing starts with a primary click, accepts primary-click
  intermediate points, and commits only when the active wall process is
  completed by secondary input or by a point that falls on an existing wall
- secondary input is context-sensitive for wall work: while a wall-create path
  is active it completes that create path; without an active create path it
  starts or completes a wall-delete path
- single-click wall creation or deletion MAY be toggled through Ctrl or through
  a dropdown anchored under the wall tool button, using the same secondary
  option pattern as the stair tool dropdown
- deleting walls removes the whole contiguous straight wall run until the next
  corner; deleting a corner removes every contiguous straight run meeting at
  that corner until its next corner
- cluster exterior walls MUST NOT be deleted; attempts to delete them reject
  without authored geometry, topology, preview, or selection mutation
- stretching a straight cluster wall moves that wall and its two connected side walls while preserving selected cluster identity and recomputing enclosed cells and perimeter as one mutation
- cluster drag handles MUST publish one handle at every authored wall corner
  and one handle at the midpoint of every authored straight wall run, for both
  interior and exterior walls
- moving a selected cluster corner through a published corner handle MUST
  preserve cluster and room identity, update the true wall-corner vertex rather
  than a bounding-box corner, and recompute the adjacent boundary spans without
  orphan or duplicate wall rows
- dragging a selected wall-midpoint handle MUST move the whole contiguous
  straight wall run one-to-one with pointer movement while preserving cluster
  identity and rejecting invalid geometry atomically
- cluster corner and wall-run drag handles MUST be visible and hittable only while their owning cluster is selected; corner handles render as compact point affordances on true authored corners, and wall-run handles render as compact midpoint affordances on the corresponding wall line
- deleting an unbound door restores the same boundary segment to a wall and removes the door topology or semantic binding; it does not delete the entire wall segment
- deleting a corridor-bound door MUST be rejected without mutating the door, corridor, room boundary, or preview state
- corridor creation MUST use deterministic orthogonal routing between concrete endpoints: horizontal-first, then vertical; vertical-first only when needed; reject if neither candidate is valid
- corridor endpoints MUST be concrete authored endpoints before commit: room-side doors or corridor-side anchors
- corridor creation materializes no door, anchor, corridor, route, or topology
  row until the full start-and-end corridor process completes successfully; all
  pending endpoint and route facts before completion are preview state only
- a generic room hit in corridor mode resolves to the boundary edge that faces the other endpoint, reusing an existing door or authoring exactly one new door there before commit
- a generic corridor hit in corridor mode resolves to the clicked host corridor cell, reusing an existing anchor or authoring exactly one new anchor there before commit
- corridor routes with turns or crossings expose authored anchors at every turn or crossing point and keep straight spans free of unnecessary intermediate anchors
- corridor anchor and waypoint refs MUST NOT render or hit-test as generic canvas drag handles; endpoint movement is owned by the focused corridor point edit route, and corridor tool endpoint deletion uses semantic corridor-body or door-boundary targets
- deleting an intermediate corridor waypoint or connection point reroutes deterministically between the remaining neighboring authored endpoints using the same creation-route policy; invalid replacement routes reject without partial mutation
- deleting a corridor door endpoint removes the branch segment from that door to the nearest surviving branch junction, authored corridor anchor, or other door endpoint, while preserving unaffected branches, surviving topology refs, and non-stale handles
- a cluster with no user-authored name defaults to `Cluster <clusterId>` on the
  map surface, and its label is centered in the cluster's authored floor-cell
  centroid rather than using the first room name or bounding-box midpoint
- a room with no user-authored name defaults to `Raum <roomId>`; its map label
  renders as subdued floor text parallel to the longest available wall run of
  that room rather than as a cluster-style label handle
- cluster and room custom names persist as authored editor behavior and remain
  visible after reload

## Stair Geometry Spec

Stair editing is driven by a `StairGeometrySpec`: shape, anchor cell,
direction, `dimension1`, `dimension2`, generated path cells, generated exits,
and optional corridor binding.

Shape options:

| UI option | Stored shape | Meaning |
| --- | --- | --- |
| `Gerade` | `STRAIGHT` | Straight run from the anchor in the selected direction. |
| `Eckspirale` | `SQUARE` | Angular spiral inside a square footprint. |
| `Rundspirale` | `CIRCULAR` | Round spiral approximated to map cells. |

The stair family dropdown owns only the creation-time shape option and the
last-used shape option. It MUST NOT mutate an existing stair. The state panel
owns selected-stair parameter edits: shape, direction, dimensions, exit-level
span, and any future explicit exit labels.

Parameter meanings:

| Shape | `dimension1` | `dimension2` |
| --- | --- | --- |
| `STRAIGHT` | horizontal run length; default `3`, min `1`, max `64` | exit level span; default `1`, min `1`, max `12` |
| `SQUARE` | outer side length; default `3`, min `2`, max `16` | exit level span; default `1`, min `1`, max `12` |
| `CIRCULAR` | footprint diameter; default `3`, min `3`, max `31`; even values round up before preview | exit level span; default `1`, min `1`, max `12` |

Anchor and direction behavior:

- the anchor is the lower or start cell chosen by the place gesture, selected
  stair handle, or state-panel coordinate edit
- direction is one cardinal map direction and defines the first horizontal step
  or tangent leaving the anchor
- creating a stair without explicit parameters uses `STRAIGHT`, `NORTH`,
  `dimension1=3`, and `dimension2=1`
- after the stair family dropdown selects a supported shape, a primary map click
  MUST place the stair according to the selected shape or report a concrete
  rejection status; the click MUST NOT be ignored silently
- a full stair recompute MUST preserve the stair identity and topology ref,
  recompute path cells and exits from the current spec, and reject the edit
  instead of committing a partial path when any parameter is invalid
- direct path-handle movement is not a full geometry recompute; it may move the
  selected path node while preserving existing exits, as covered separately by
  `DE-STAIR-005`

Validation and rejection:

- unsupported shape values, non-cardinal directions, missing anchors,
  zero-level spans, or dimensions outside the limits above MUST be rejected
- generated path cells MUST be deterministic for the same spec and MUST NOT
  include duplicate cells at the same level
- a generated stair MUST have at least two exits on distinct levels
- a stair path MUST NOT cross authored room interiors except at its generated
  exit cells or at explicitly selected corridor/stair binding cells
- invalid edits leave the previous stair, path, exits, selection, and preview
  state unchanged

Exit and label behavior:

- full recompute generates one exit for the anchor level, one for the target
  level, and one for each intermediate crossed level
- generated exit labels default to `Ausgang z=<level> (<q>,<r>)`
- recompute preserves an existing exit id by its ordered level role when that
  role still exists; removed roles delete their exit rows and new roles receive
  new ids
- future user-authored exit labels remain state-panel-owned and must be
  preserved by exit id during recompute

Delete and corridor binding behavior:

- deleting an unbound stair removes the stair, generated path, generated exits,
  and stair topology ref
- deleting a stair bound to a corridor is rejected unless the user is deleting
  the owning corridor branch through the corridor workflow
- a cross-level corridor between endpoints on different levels creates or reuses
  a corridor-bound stair segment whose exits connect the corridor route across
  the crossed levels
- state-panel edits to a corridor-bound stair MUST preserve the corridor
  endpoints and crossed levels or reject the edit without partial mutation

## Transition Link Behavior

- a bidirectional transition link is created from a selected source transition
  in the state panel by choosing a target dungeon map and target transition id,
  then explicitly saving the link
- the save MUST update the selected source transition to target that map and
  transition, and MUST update the target transition's `linkedTransitionId` back
  to the source transition when the target transition exists in the loaded
  authored dungeon data
- if the selected transition, target map, or target transition cannot be
  resolved, the save is rejected without changing either transition
- the bidirectional link save is one editor mutation from the user's
  perspective: both sides update together or neither side changes
- linked transition labels, selection, and delete protection MUST read back
  from persisted authored transition fields rather than state-panel draft data

## Acceptance Criteria

- Preview, cancel, rejection, and invalid edits never persist authored truth;
  supported commits persist, publish, render, and reload the same authored
  result.
- Map CRUD, selection clearing, room paint/delete/merge/adjacency, room
  narration, door create/delete/protected-delete, and transition link save
  preserve the behavior described above without partial mutation.
- Tool-family controls stay directly visible, fit the `960px` tool-panel
  target, use shared map gestures, remember dropdown sub-options, close
  dropdowns on pointer leave, and reset to `Auswahl` on `Esc`.
- Wall paths keep draft state until explicit completion, never finalize merely
  because a second point is clicked, delete only eligible interior straight
  runs, and reject exterior-wall deletion without changing authored state.
- Cluster handles are proven on selected true corners and selected wall-run
  midpoints for complex shapes; moving a corner or wall run preserves cluster
  identity and recomputes affected geometry atomically.
- Cluster and room labels use the required default text, placement, custom-name
  edit routes, and reload stability.
- Corridor creation accepts room-to-room, room-to-corridor, and
  corridor-to-corridor flows, but commits only after a valid full route between
  two explicit authored endpoints; preview endpoint materialization has no
  persisted side effects before commit.
- Corridor deletion and point deletion preserve unaffected branches and reject
  protected or invalid mutations without partial authored changes.
- Stair creation after dropdown shape selection responds to the map click with
  either a valid committed `StairGeometrySpec` or a concrete rejection status;
  state-panel stair edits preserve identity and recompute deterministically.
- Advanced tool families stay directly visible even when specific authored
  mutations are still delivered incrementally.

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Dungeon Editor-Wide Invariants](../verification/verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor tool matrices](../verification/)
- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
