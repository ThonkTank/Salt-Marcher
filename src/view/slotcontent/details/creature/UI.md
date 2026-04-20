Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Creature Inspector detail entry structure and visible stat
block behavior.

# Creature Details UI

## Component Purpose

The creature detail entry renders a read-only stat block in the shell Inspector.
It is opened by catalog rows and may be reused by later encounter-facing views.

## Visible Surfaces

- The shell Inspector header and history controls remain shell-owned.
- The detail content renders a D&D-style stat block with creature name, meta
  text, core stats, ability scores, traits, properties, and actions.

## Interactions

- The owning active-root Binder loads one creature by id through the creatures
  application service and passes the read result into this slotcontent unit.
- The entry does not mutate creature data.
- Missing or inaccessible details show a compact error message inside the
  Inspector content area.

## Visible States

- Loading: `Loading stat block...`
- Not found: `Creature not found.`
- Storage error: `Creature details could not be loaded.`
- Loaded: stat block content uses the centralized `stat-block-*` selector
  family for the pane, heading, meta text, separators, ability grid, property
  text, section headers, actions, and loading/error messages.
