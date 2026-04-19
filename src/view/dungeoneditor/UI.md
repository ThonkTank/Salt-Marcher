Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: UI composition, interactions, and user-visible states for the
dungeon editor component.

# Dungeon Editor UI

## Purpose

The dungeon editor is the authoring-oriented surface for changing dungeon truth.
It extends the shared map presentation with editing controls, preview behavior,
and commit-oriented interactions.

Shell registration is owned by `DungeoneditorViewContribution`.

Shell-facing composition and inspector publication are owned by
`DungeoneditorViewContribution`, while the runtime-session facade lives under
`src/view/dungeoneditor/View/`.

## Editor Surface

### Editor Canvas

The editor extends the shared dungeon canvas with authoring affordances and the
visual language of the original Salt Marcher dungeon map.

Visible presentation rules:

- dark canvas background with tiered grid lines and visible axes
- room and corridor cells rendered directly on the canvas rather than as
  separate tile widgets
- walls and doors rendered as canvas overlays in the original color palette
- aggregated room or corridor labels rendered inside the map surface
- selection highlighted on the canvas and mirrored into the shell inspector

Current editor interactions:

- select visible authored objects by clicking the canvas
- pan and zoom with editor-local camera state
- move between floors from the left control panel or keyboard shortcuts

### Editor Management

The editor keeps the original control grouping while staying inside the current
shared-shell architecture.

Visible controls:

- top-left `Dungeon` group with map selector, `Neuen Dungeon`,
  `Dungeon bearbeiten`, and a graph-mode placeholder button
- top-left level row with current floor label, floor step controls, and an
  overlay trigger
- top-left `Werkzeug` group with the reference-order tool buttons
- right state panel with dungeon metadata, current selection, tool summary, and
  mutation feedback

### Tool Model

The editor presents at least these tool families:

- neutral selection
- area paint
- floor paint
- wall paint
- door placement
- stair placement
- corridor connection

Each tool defines visible intent and docking state:

- user intent
- available capability summary
- whether an existing domain capability is already wired

The local implementation does not back-port the original editor engine. Tool
buttons preserve the original presentation order, but only current
domain-backed capabilities are interactive.

## Interaction Rules

- only one editing tool is active at a time
- the visible top-left tool buttons keep the reference layout even when a tool
  is still a placeholder
- pan and zoom redraw the current editor surface without reloading the map
- selection and focus update inspector content consistently
- canvas styling stays aligned with the original dungeon map palette even when
  local domain data is still placeholder-shaped

## References

- [Dungeon Feature README](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/README.md:1)
- [Dungeon Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/DOMAIN.md:1)
