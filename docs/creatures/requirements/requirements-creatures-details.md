Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Creature Inspector detail entry structure and visible stat
block behavior.

# Creature Details UI

## Component Purpose

The creature detail entry renders a read-only stat block in the shell Inspector.
It is opened by catalog rows and may be reused by later encounter-facing views.
The slotcontent unit owns the reusable Inspector entry adapter so active-root
Binders do not duplicate detail-entry assembly.

## Visible Surfaces

- The shell Inspector header and history controls remain shell-owned.
- The detail content renders a D&D-style stat block with creature name, meta
  text, core stats, ability scores, traits, properties, and actions.

## Interactions

- The owning active-root Binder pushes the slotcontent-owned Inspector entry
  and supplies a creature-detail loader from the creatures application service.
- The Inspector entry constructs the shell entry spec, loads one creature by id,
  and binds the result into this slotcontent unit.
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

## Acceptance Criteria

- opening creature details from a catalog row publishes one slotcontent-owned
  Inspector entry instead of duplicating detail-entry assembly in each Binder
- the detail surface remains read-only and exposes no mutation controls for
  creature truth
- missing creature ids render a compact not-found message inside the Inspector
  content area rather than leaving the shell details area blank
- storage failures render an inline error message without crashing the shell
  Inspector host
- loaded stat blocks use the centralized `stat-block-*` selector family for
  pane structure, meta text, ability grid, property sections, and actions

## References

- [Catalog Tab UI](docs/creatures/requirements/requirements-creatures-catalog.md:1)
- [Creatures Domain Model](docs/creatures/domain/domain-creatures.md:1)
- [View Layer Standard](docs/project/architecture/patterns/view-layer.md:1)
