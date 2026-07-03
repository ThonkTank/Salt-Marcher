Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Map catalog, startup, camera, projection, overlay, and tool-control route expectations for Dungeon Editor behavior verification.

# Dungeon Editor Map, Projection, And Controls Matrix

## Purpose

This document owns route expectations for map catalog operations, startup responsiveness, camera controls, level/projection controls, overlay controls, and tool-family controls. Shared proof model, status vocabulary, gesture convention, and completion criteria remain in [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md). Fixture definitions live in [Dungeon Editor Fixture Catalog](verification-dungeon-editor-fixtures.md).

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-MAP-001` | Create map | Map create action and submit | `F9_MAP_CATALOG` | Submitting `Gamma` creates one new `dungeon_maps` row, selects an empty map named `Gamma`, clears preview, and renders the empty editor map. | Ready |
| `DE-MAP-002` | Rename map | Map rename action and submit | `F9_MAP_CATALOG` | Renaming `Alpha` to `Alpha Prime` changes only the selected map name; authored geometry, map id, selection, and render content remain stable. | Ready |
| `DE-MAP-003` | Delete map | Map delete action and confirm | `F9_MAP_CATALOG` | Deleting `Beta` removes its authored rows, keeps `Alpha` and `Zeta`, falls back to first catalog map `Alpha`, clears transient state, and renders `Alpha`. | Ready |
| `DE-MAP-004` | Load map | Map selector | `F9_MAP_CATALOG` | Selecting `Beta` changes selected map id and surface name to `Beta`, reads exactly `B1`, and renders only `B1`. | Ready |
| `DE-MAP-005` | Reload map | Reload menu item | `F9_MAP_CATALOG` | Reload rebuilds from persisted authored state, keeps selected map, clears preview/drafts, and renders persisted truth instead of stale preview. | Ready |
| `DE-START-001` | Startup avoids loading large persisted current geometry | Discovered shell startup and map key route | `F14_LARGE_CURRENT_GEOMETRY_MAP` | Startup lists but does not auto-load the large map, records discovered-shell startup latency as a diagnostic, keeps floor-cell and boundary-edge rows intact, renders the unloaded placeholder, and processes `Esc` within key-route latency. | Ready |
| `DE-CAM-001` | Camera pan right | Middle mouse press, drag, release | `F1_SINGLE_ROOM` | Dragging `(300,300)` to `(420,300)` changes only viewport `panX` by `+120`; authored rows and map snapshot truth stay unchanged. | Ready |
| `DE-CAM-002` | Camera pan left | Middle mouse press, drag, release | `F1_SINGLE_ROOM` | Dragging `(420,300)` to `(300,300)` changes only viewport `panX` by `-120`; authored rows and map snapshot truth stay unchanged. | Ready |
| `DE-CAM-003` | Camera pan down | Middle mouse press, drag, release | `F1_SINGLE_ROOM` | Dragging `(300,300)` to `(300,420)` changes only viewport `panY` by `+120`; authored rows and map snapshot truth stay unchanged. | Ready |
| `DE-CAM-004` | Camera pan up | Middle mouse press, drag, release | `F1_SINGLE_ROOM` | Dragging `(300,420)` to `(300,300)` changes only viewport `panY` by `-120`; authored rows and map snapshot truth stay unchanged. | Ready |
| `DE-CAM-005` | Zoom in around cursor | Scroll event | `F1_SINGLE_ROOM` | Positive wheel input increases zoom through `Viewport.zoomAround`, keeps authored state unchanged, and keeps cursor-anchored scene coordinates stable. | Ready |
| `DE-CAM-006` | Zoom out around cursor | Scroll event | `F1_SINGLE_ROOM` | Negative wheel input decreases zoom through `Viewport.zoomAround`, keeps authored state unchanged, and keeps cursor-anchored scene coordinates stable. | Ready |
| `DE-LVL-001` | Projection level up by visible control | Next-level button | `F6_MULTI_LEVEL_FLOORS` | Clicking `+` increments `projectionLevel` by `1`, leaves map truth unchanged, and renders the next active level. | Ready |
| `DE-LVL-002` | Projection level down by visible control | Previous-level button | `F6_MULTI_LEVEL_FLOORS` | Clicking `-` from level `1` decrements to `0`, leaves map truth unchanged, and renders level `0` as active. | Ready |
| `DE-LVL-003` | Projection level up by shortcut | Map-surface key route | `F6_MULTI_LEVEL_FLOORS` | Pressing `E` increments projection level without authored row changes and renders the next active level. | Ready |
| `DE-LVL-004` | Projection level down by shortcut | Map-surface key route | `F6_MULTI_LEVEL_FLOORS` | Pressing `Q` decrements projection level without authored row changes and renders the previous active level. | Ready |
| `DE-LVL-005` | Projection level up to empty positive level | Next-level button | `F1_SINGLE_ROOM` | Clicking `+` increments `projectionLevel` to empty `z=1`, leaves map truth unchanged, updates the visible level label, and renders no active `z=0` floor cells. | Ready |
| `DE-LVL-006` | Projection level down to empty negative level | Previous-level button | `F1_SINGLE_ROOM` | Clicking `-` reaches empty `z=-1`, leaves map truth unchanged, updates the visible level label, and renders no active `z=0` floor cells. | Ready |
| `DE-LVL-007` | Author room on empty negative level | Room paint after negative projection shift | `F1_SINGLE_ROOM` | Painting a room while the editor projects `z=-1` writes authored floor cells at `level_z=-1`, keeps the active projection at `z=-1`, and renders the new negative-level room. | Ready |
| `DE-VIEW-001` | Switch to graph projection | Graph view toggle | `F1_SINGLE_ROOM` | Clicking `Graph` sets `viewMode=GRAPH`, keeps authored topology unchanged, and renders graph projection. | Ready |
| `DE-VIEW-002` | Switch to grid projection | Grid view toggle | `F1_SINGLE_ROOM` | Clicking `Grid` sets `viewMode=GRID`, keeps authored topology unchanged, and renders grid projection. | Ready |
| `DE-OVR-001` | Onion slicing off | Overlay controls | `F6_MULTI_LEVEL_FLOORS` | Selecting `off` stores off/empty overlay settings without authored row changes and renders only the active level. | Ready |
| `DE-OVR-002` | Onion slicing nearby range | Overlay mode, range spinner, opacity slider | `F6_MULTI_LEVEL_FLOORS` | Selecting nearby range `1` opacity `0.35` stores those overlay settings and renders adjacent levels with non-active opacity. | Ready |
| `DE-OVR-003` | Onion slicing selected levels | Overlay mode and selected-levels text field | `F6_MULTI_LEVEL_FLOORS` | Entering `-1,1,2` stores selected-level overlay settings and renders only selected non-active levels as onion slices. | Ready |
| `DE-OVR-004` | Onion slicing control popup | Overlay trigger popup | `F6_MULTI_LEVEL_FLOORS` | Popup input stores the committed overlay result, shows popup state while open, and updates render after input. | Ready |
| `DE-TOOL-001` | Family button row fits 960px tool panel | Focused tool-family button row | `F0_EMPTY_MAP` | In a `960px` app window, `Auswahl`, `Raum`, `Wand`, `Tür`, `Korridor`, `Treppe`, `Übergang`, and `Feature` remain inside the tool panel without separate top-level create/delete variants. | Ready |
| `DE-TOOL-002` | Secondary option dropdown opens under family button | Family button dropdown | `F0_EMPTY_MAP` | Opening stair options keeps stair active, defaults to `Gerade`, exposes `Eckspirale` and `Rundspirale`, and anchors the dropdown under the button. | Ready |
| `DE-TOOL-003` | Secondary option dropdown restores prior sub-option | Family button dropdown | `F0_EMPTY_MAP` | Reopening a family dropdown preselects the last selected supported sub-option, or the first option when no prior choice exists. | Ready |
| `DE-TOOL-004` | Secondary option dropdown auto-closes on pointer leave | Family button dropdown | `F0_EMPTY_MAP` | Moving the pointer outside an open dropdown closes it while preserving selected family and last sub-option state. | Ready |
| `DE-TOOL-005` | Escape resets to selection tool | Map-surface key route | `F0_EMPTY_MAP` | Pressing `Esc` while a non-selection family is active resets snapshot and controls state to `Auswahl` and closes current popups. | Ready |
| `DE-TOOL-006` | Escape clears secondary-option dropdown intent | Secondary-option dropdown key route | `F0_EMPTY_MAP` | Pressing `Esc` with a dropdown active resets family/sub-option intent to `Auswahl`; reopening the family falls back to first option. | Ready |

## References

- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Fixture Catalog](verification-dungeon-editor-fixtures.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
