# World Dungeon Map Feature

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.world.dungeonmap.api` | `model`, `repository`, `service`, `ui` | `features.world.api` |

`dungeonmap` owns only dungeon-specific tables and workflows.
It may read or update world-session state only through `features.campaignstate.api`.
Cross-feature selector/read DTOs belong in `api`, while `model` stays focused on dungeon domain and editor state.
The editor view is the composition root only; peer orchestration classes in `ui/editor` use the
`*WorkflowController` suffix consistently.
Use `paint*` naming for transient UI stroke/preview mechanics and `*SquareEdit*` naming for persisted square mutation commands.
The shell-owned upper-right inspector is the single cross-view information surface. Room, area, feature,
endpoint, passage, stat-block, item, and similar reference content must flow through the shared
`DetailsNavigator` so history/back/forward stays coherent for the GM. Dungeon-editor forms, tool settings,
confirmations, validation feedback, and other interactive controls belong in the lower-right state pane instead
of a feature-local details panel. Local deselection must not clear the inspector; the last global info card stays
visible until the GM explicitly opens different inspector content or closes it.
For the dungeon editor, selection of a square, room, area, feature, endpoint, link, or passage is explicit
inspection intent and must automatically publish the matching summary to the shared inspector. The lower-right
state pane must stay focused on editing workflows and must not duplicate those read-only details locally.
