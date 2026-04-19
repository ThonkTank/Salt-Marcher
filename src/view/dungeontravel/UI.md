Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: UI composition, interactions, and user-visible states for the
dungeon travel component.

# Dungeon Travel UI

## Purpose

The dungeon travel surface is the runtime-oriented presentation over committed
dungeon truth. It emphasizes navigation, room context, and immediate travel
actions rather than authoring.

## Travel Surface

### Top-Left Controls

The travel top-left panel mirrors the compact runtime structure from the
reference application while remaining inside the current shared-shell slots.

Visible elements:

- zoom summary
- current dungeon or load state summary
- level row with current floor label, floor step controls, and an overlay
  trigger

### Travel Canvas

The travel canvas reuses the shared dungeon renderer and adopts the original
Salt Marcher visual identity.

Visible elements:

- dark canvas background with tiered grid lines and visible axes
- room and corridor geometry rendered directly on the canvas
- wall and door overlays in the original palette
- aggregated room or corridor labels
- active runtime focus highlighted through the same canvas selection language

Core interactions:

- select the active runtime focus from the canvas or state list
- pan and zoom with travel-local camera state

Camera changes redraw the current travel workspace without reloading the map.

### Room Inspector

The room inspector is the main information surface for travel.

It presents:

- room identity and authored description
- exits and traversability notes
- feature summaries
- jump targets to connected rooms

### Runtime State Panel

The runtime state panel is a separate runtime-state contribution in the shared
shell runtime-state area. The travel tab itself leaves that area free.

The travel tab contribution and the separate runtime-state contribution share
one runtime-session API in
`src/view/dungeonshared/api/DungeonTravelRuntimeSession`.

Shell-facing wiring stays local to `src/view/dungeontravel/assembly/` and
`src/view/dungeonshared/assembly/`.

The `dungeonshared` runtime-state contribution owns dungeon map management and
lightweight runtime focus context for travel.

Visible contents:

- map search
- map list and explicit load action
- map creation
- delete loaded map
- travel summary card for active dungeon, floor, overlay mode, and current
  focus
- inspector list that mirrors selectable runtime targets into the shell
  inspector

## References

- [Dungeon Feature README](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/README.md:1)
- [Dungeon Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/SPEC.md:1)
