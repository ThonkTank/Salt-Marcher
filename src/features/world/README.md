# World Feature

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.world.api` | `hexmap`, `dungeonmap` | `ui.bootstrap` |

`features.world` owns world navigation surfaces and consumes world-session state through
`features.campaignstate.api`.
`features.campaignstate` owns the `campaign_state` schema and persists both overworld and dungeon position.
