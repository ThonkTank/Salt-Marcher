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
The shell-owned upper-right details pane is reserved for static/read-only navigation summaries; dungeon-editor
forms, tool settings, confirmations, and other interactive controls belong in the lower-right state pane.
