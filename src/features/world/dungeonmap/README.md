# World Dungeonmap Feature

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.world.dungeonmap.api` | `model`, `repository`, `service`, `ui` | `features.world.api`, `ui.shell` |

`DungeonMapModule` remains in `api` as the feature composition entry point, while `DungeonRoomSummary` is the cross-feature read DTO used by the shell inspector.
