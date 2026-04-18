Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
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

The creatures filter pane is the filter-control presentation for the creatures
catalog itself. Other runtime tabs own their local filter views unless they
cross an explicit public view boundary.

## Workspace

Visible elements:

- paged creature result table
- previous and next page actions
- page summary
- status message for empty, success, and error states

Selecting a creature opens the inspector detail surface for that creature.
The root contribution delegates all slice wiring into `assembly/`.
Presentation state and actions are owned under `ViewModel/`, while shell
adaptation for inspector publishing remains in `assembly/`.

## User-Visible States

- filter options unavailable but catalog fallback still usable
- no creatures match the current filters
- creature detail unavailable
