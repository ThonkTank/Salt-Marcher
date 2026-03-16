# World Dungeonmap Feature

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.world.dungeonmap.api` | `model`, `repository`, `service`, `ui` | `features.world.api`, `ui.shell` |

`DungeonMapModule` remains in `api` as the feature composition entry point, while `DungeonRoomSummary` is the cross-feature read DTO used by the shell inspector.

Internal subpackages are organized by subsystem:
- `service.catalog`, `service.editor`, `service.runtime`, `service.topology`, `service.campaignstate`
- `ui.async`, `ui.selector`, `ui.inspector`, `ui.workspace`

Current schema policy:
- Dungeon storage is still in an early iteration phase and is treated as disposable local state.
- For dungeon schema changes, prefer updating the schema and repository code directly, then clearing local dungeon rows/data on the development machine.
- Do not add dungeon-specific compatibility migrations, fallback reads, or legacy schema support unless the feature has been declared stable.
