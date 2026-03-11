# World Feature

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.world.api` | `hexmap`, `dungeonmap` | `ui.bootstrap` |

`features.world` owns world navigation surfaces and shared world-session concerns.
The persistent world session currently lives in `campaign_state` and stores both overworld and dungeon position.
