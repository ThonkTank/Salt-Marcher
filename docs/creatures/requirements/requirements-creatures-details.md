Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Creature Inspector detail entry structure and visible stat
block behavior.

# Creature Details UI

## Component Purpose

The creature detail entry renders a read-only stat block in the shell Inspector.
It is opened by catalog rows and may be reused by later encounter-facing views.
The Creatures feature owns one reusable Inspector detail experience for every
surface that opens a creature by id.

## Visible Surfaces

- The shell Inspector header and history controls remain shell-owned.
- The detail content renders a D&D-style stat block with creature name, meta
  text, core stats, ability scores, traits, properties, and actions.

## Interactions

- An owning surface opens the creature detail entry and requests one creature by
  id through the Creatures feature's public read API.
- The Inspector entry presents the resulting creature detail state.
- The entry does not mutate creature data.
- Missing or inaccessible details show a compact error message inside the
  Inspector content area.

## Visible States

- Loading: `Loading stat block...`
- Not found: `Creature not found.`
- Storage error: `Creature details could not be loaded.`
- Loaded: the stat block consistently presents the pane, heading, meta text,
  separators, ability grid, property text, section headers, and actions.

## Acceptance Criteria

- opening creature details from a catalog row shows exactly one Inspector detail
  entry for the selected creature
- the detail surface remains read-only and exposes no mutation controls for
  creature truth
- missing creature ids render a compact not-found message inside the Inspector
  content area rather than leaving the shell details area blank
- storage failures render an inline error message without crashing the shell
  Inspector host
- loaded stat blocks consistently render pane structure, meta text, ability
  grid, property sections, and actions

## References

- [Catalog Tab UI](requirements-creatures-catalog.md)
- [Creatures Domain Model](../domain/domain-creatures.md)
