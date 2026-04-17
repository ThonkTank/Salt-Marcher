Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: UI composition, interactions, and user-visible states for the
dungeon editor component.

# Dungeon Editor UI

## Purpose

The dungeon editor is the authoring-oriented surface for changing dungeon truth.
It extends the shared map presentation with editing controls, preview behavior,
and commit-oriented interactions.

## Editor Surface

### Editor Canvas

The editor extends the base map canvas with authored editing affordances.

Expected editor-specific interactions:

- select clusters, rooms, connections, and features
- drag selected affordances where editing is allowed
- preview pending edits directly on the canvas
- commit or cancel the active gesture
- pan and zoom with editor-local camera state

### Editor Management

The editor extends map management with authoring operations.

Expected controls:

- top-left `Dungeon` group with map selector, `Neuen Dungeon`,
  `Dungeon bearbeiten`, and a view-mode placeholder button
- top-left level row with current floor label, floor step placeholders, and an
  overlay placeholder trigger
- top-left `Werkzeug` group with the reference-order tool buttons
- right state panel with loaded-map metadata and `Delete loaded`

### Tool Model

The editor supports at least these tool families:

- neutral selection
- area paint
- floor paint
- wall paint
- door placement
- stair placement
- corridor connection

Each tool defines:

- user intent
- input form
- preview behavior
- commit trigger

The tool does not define the domain repair or topology conflict logic.

## Interaction Rules

- only one editing tool is active at a time
- the visible top-left tool buttons keep the reference layout even when a tool
  is still a placeholder
- visible preview is shown for in-progress edits
- pan and zoom redraw the current editor surface without reloading the map
- `Esc` cancels the active edit
- undo and redo replay committed editor history
- selection and focus update inspector content consistently

## References

- [Dungeon Feature README](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/README.md:1)
- [Dungeon Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/DOMAIN.md:1)
