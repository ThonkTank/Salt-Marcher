Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: UI structure, interactions, and user-visible states for the
creatures catalog component.

# Creatures UI

## Purpose

The creatures tab is the read-only catalog workspace for creature lookup and
shared encounter-facing filter interactions.

## Controls

Visible elements:

- debounced name search
- CR min/max range control
- popup multi-select filters for size, type, subtype, biome, and alignment
- active filter chips with per-chip removal
- global filter reset

The creatures filter pane is the canonical filter-control presentation for
creature-backed runtime tabs. Encounter may reuse the same filter component
with a reduced set of enabled filters.

## Workspace

Visible elements:

- paged creature result table
- previous and next page actions
- page summary
- status message for empty, success, and error states

Selecting a creature opens the inspector detail surface for that creature.

## User-Visible States

- filter options unavailable but catalog fallback still usable
- no creatures match the current filters
- creature detail unavailable
