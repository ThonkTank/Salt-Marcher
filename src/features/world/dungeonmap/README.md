# World Dungeon Map Feature

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.world.dungeonmap.api` | `model`, `repository`, `service`, `ui` | `features.world.api` |

`dungeonmap` owns only dungeon-specific tables and workflows.
It may read or update world-session state only through `features.campaignstate.api`.
Cross-feature selector/read DTOs belong in `api` when dungeon data must cross a feature boundary, while `model` stays focused on dungeon domain and editor state.
Within `model`, `model.index` is the canonical feature-internal loaded-state lookup layer; editor and inspector read paths should use it instead of rolling ad-hoc scans over `DungeonMapState`.
Editor-only encounter and encounter-table selector catalogs belong in internal `service.catalog`, not in `api`.
Feature-internal workflow result DTOs that must be shared between low-level services and UI/application code belong in `application`.
`DungeonLinkCreateResult`/`DungeonMoveResult` and their status enums live there as the canonical result model; do not mirror them in `service` or `ui`.
`api` exposes only stable contracts consumed outside `dungeonmap`; the current public surface is the world-facing
`DungeonMapModule` facade plus the explicit bootstrap surface in `api/DungeonMapBootstrap`, while dungeon view composition stays in internal `ui`.
`service` is split by read/write responsibility:
- `DungeonMapQueries` is the UI-facing read surface and delegates to the canonical read-only query logic in `DungeonMapQueryService`. Query flows must not reconcile or delete persisted state.
- `DungeonMapCommands` is the UI-facing write surface and delegates to the canonical write facade in `DungeonMapEditorService`.
- `DungeonMapServices` is the feature-local composition bundle passed into dungeon views so UI workflow code does not reach into static services directly.
- Startup/bootstrap owns one-time persisted reconciliation for legacy rows, and write-side services own ongoing invariants after mutations.
`ui/canvas` owns map rendering, hit-testing, hover/selection overlays, and raw canvas gesture mechanics.
`ui/canvas/model` owns canvas-only loaded-state caches, preview topology, label layout, and interaction state.
Keep `DungeonCanvasModel` as the root canvas-facing facade, with focused collaborators under `ui/canvas/model`
instead of growing one mutable state holder for rendering, previews, labels, and interaction feedback.
`ui/editor` is the editor composition and widget layer: `DungeonEditorView` is the composition root there, and the
package also owns editor controls, dropdown/widget helpers, inspector builders, and editor state holders.
`ui/editor/inspector/actions` defines the narrow inspector-side edit callbacks. Inspector content/builders should depend
on those action contracts rather than concrete workflow controllers so the global inspector remains a composition layer,
not another editing coordinator.
`ui/editor/panes/cards` contains widget-only sidebar card components; workflow/orchestration stays outside those cards in the editor view/controllers.
`ui/editor/workflow` owns editor orchestration only. `DungeonEditorCoordinator` stays at the package root as the single editor orchestration facade. `workflow/loading` owns startup and async load flows, `workflow/selection` owns selection state plus inspector publication/restore, `workflow/connection` owns link/endpoint/passage interaction flows, `workflow/entity` owns map/area/feature editing flows, `workflow/painting` owns transient paint sessions plus persisted square/wall edit submission, and `workflow/binding` owns sidebar event wiring. Keep `DungeonEditorView` focused on wiring shell surfaces and delegating editor behavior to the coordinator. UI helpers such as `DungeonMapDropdowns` remain in `ui/editor` because they render anchored editor UI instead of coordinating workflow.
Use `paint*` naming for transient UI stroke/preview mechanics and `*SquareEdit*` naming for persisted square mutation commands.
Within `service.topology`, keep reconciliation collaborators narrow and policy-focused: room-selection preference,
component discovery, and merged-room metadata rules should live in dedicated helpers instead of collapsing back into
one monolithic reconciler class.
Dungeon square paint topology is overlap-driven, not adjacency-driven: painting isolated empty space creates a new room with walls on all exposed edges; painting empty space directly adjacent to rooms still creates a new room and only adds missing boundary walls; painting across empty space plus exactly one existing room extends that overlapped room, adding new outer walls and removing walls that become internal; painting across empty space plus multiple existing rooms merges all overlapped rooms into one room, keeping only the outer perimeter walls.
The shell-owned upper-right inspector is the single cross-view information surface. Room, area, feature,
endpoint, passage, stat-block, item, and similar reference content must flow through the shared
`DetailsNavigator` so history/back/forward stays coherent for the GM. Dungeon-editor forms, tool settings,
confirmations, validation feedback, and other interactive controls belong in the lower-right state pane instead
of a feature-local details panel. Narrow quick edits in the inspector are allowed only when they stay
single-entity scoped on the currently open room or feature and keep the inspector useful as a persistent
reference card while the GM runs the game. Local deselection must not clear the inspector; the last global
info card stays visible until the GM explicitly opens different inspector content or closes it.
For the dungeon editor, selection of a square, room, area, feature, endpoint, link, or passage is explicit
inspection intent and must automatically publish the matching summary to the shared inspector. The lower-right
state pane must stay focused on editing workflows and must not duplicate those read-only details locally.
