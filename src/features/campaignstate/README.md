# Campaign State Feature

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.campaignstate.api` | `model`, `repository` | `features.world`, future campaign-state workflows |

`campaign_state` is the current world-session aggregate and its schema is owned here.
It persists cross-mode party position for overworld and dungeon flows until a dedicated world-session feature exists.
