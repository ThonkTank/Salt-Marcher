Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
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
reference application.

Visible elements:

- zoom summary
- current dungeon or load state summary
- level row with current floor label, floor step placeholders, and an overlay
  placeholder trigger

### Travel Canvas

The travel canvas reuses the dungeon render but emphasizes runtime state.

Visible elements:

- party token with facing
- current traversable layout
- active travel focus

Core interactions:

- select or drag the party marker
- move focus to the current or next room
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

The runtime state panel owns dungeon map management for travel.

Expected contents:

- map search
- map list and explicit load action
- map creation
- delete loaded map

## References

- [Dungeon Feature README](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/README.md:1)
- [Dungeon Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/SPEC.md:1)
