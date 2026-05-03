Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
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

## Required Behavior

- the editor MUST let the user create, rename, delete, load, and reload maps
- created maps MUST start empty
- `Auswahl` MUST remain directly visible
- room, wall, door, corridor, stair, and transition families MUST remain
  directly visible as tool buttons
- selection MUST resolve stable authored targets rather than presentation-only
  guesses
- preview MUST read as if the pending operation were applied, but MUST NOT
  persist authored truth
- apply MUST commit only on explicit gesture completion
- corridor editing MUST support visible create and delete flows
- stair editing MUST support visible create and delete flows plus stair shape,
  direction, and exit-level configuration
- transition editing MUST support visible create and delete flows plus
  destination selection for dungeon or overworld outcomes

## Supported Interaction States

- room paint and delete on the active level
- wall create and delete through boundary paths
- door create and delete through boundary selection, including cluster
  perimeter doors on outer walls
- room narration editing from the state pane
- handle movement for selectable editor handles
- straight wall-stretch movement for selected cluster walls
- corridor create and delete flows
- corridor targeting resolves to explicit authored endpoints only: room-side
  doors and corridor-side anchors
- generic room hits and generic corridor hits remain allowed input, but the
  committed corridor MUST bind to a concrete authored door or corridor anchor
- stair create and delete flows with visible shape and exit configuration
- transition create and delete flows with description, destination, and
  bidirectional-link options
- grid and graph projection modes
- level and overlay controls that affect presentation only

Corridor, stair, and transition editing are still partial in current
SaltMarcher builds, but they remain visible target-state surface obligations in
this requirements document because the user-facing feature shape is already
evidenced in the sibling repo.

## Acceptance Criteria

- The editor loads committed authored dungeon truth before any mutation starts.
- If the user previews an edit, the pending result is visible without
  persisting authored truth.
- If the user applies a supported edit, the resulting authored state is
  committed and reloaded.
- If the user cancels an edit, no authored mutation is committed.
- Invalid or unsupported moves are rejected without partial geometry commits.
- Empty-grid clicks clear selection.
- Saving room narration persists room visual and exit descriptions through the
  dungeon write model.
- The door tool accepts cluster outer walls that touch exactly one room cell so
  explicit outer doors can be authored.
- Corridor creation accepts room-to-room, room-to-corridor, and
  corridor-to-corridor flows, but the committed result is always a new
  corridor segment between two explicit authored endpoints.
- If the user clicks a room without selecting a door, the editor MUST reuse an
  exact existing door on the chosen edge or author a new door on that edge
  before committing the corridor.
- If the user clicks a corridor without selecting an anchor, the editor MUST
  reuse an exact existing corridor anchor on the chosen host corridor cell or
  author a new anchor there before committing the corridor.
- Explicit outer-door clicks and explicit corridor-anchor clicks MUST reuse the
  chosen authored endpoint rather than creating a duplicate.
- Deleting a door that is already bound as an explicit corridor endpoint is
  rejected without partially mutating authored truth.
- Deleting a corridor that still owns corridor anchors referenced by other
  corridors is rejected without partially mutating authored truth.
- Advanced tool families stay directly visible even when specific authored
  mutations are still delivered incrementally.

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
