# World Dungeon Map Feature

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.world.dungeonmap.api` | `model`, `repository`, `service`, `ui` | `features.world.api` |

`dungeonmap` owns only dungeon-specific tables and workflows.
It may read or update world-session state only through `features.campaignstate.api`.
Cross-feature selector/read DTOs belong in `api` when dungeon data must cross a feature boundary, while `model` stays focused on dungeon domain and editor state.
Editor-only encounter and encounter-table selector catalogs belong in internal `service.catalog`, not in `api`.
`api` exposes only stable contracts consumed outside `dungeonmap`; the current public surface is the world-facing
`DungeonMapModule` facade, while dungeon view composition stays in internal `ui`.
The editor view is the composition root only; peer orchestration classes in `ui/editor` use the
`*WorkflowController` suffix consistently.
Use `paint*` naming for transient UI stroke/preview mechanics and `*SquareEdit*` naming for persisted square mutation commands.
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
