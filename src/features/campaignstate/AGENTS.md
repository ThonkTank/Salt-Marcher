# Campaign State Feature

This file uses the root owner-slice architecture. The package names mentioned below describe the current public boundary and current homes, not permission to invent new sibling package families.

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.campaignstate.api` | `model`, `repository` | `features.world`, future campaign-state workflows |

`campaign_state` is the current world-session aggregate and its schema is owned here.
It persists cross-mode party position for overworld flows plus tile-only dungeon runtime position until a
dedicated world-session feature exists.
