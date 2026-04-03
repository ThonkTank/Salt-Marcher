# World Feature

| Public API | Internal | Allowed consumers |
| --- | --- | --- |
| `features.world.api` | `hexmap`, `dungeonmap` | `ui.bootstrap` |

`features.world` owns world navigation surfaces and consumes world-session state through
`features.campaignstate.api`.
`features.campaignstate` owns the `campaign_state` schema and persists both overworld position and tile-only
dungeon runtime position.

Reusable world-feature UI building blocks shared by runtime and editor surfaces belong in the
feature's `ui/shared` package rather than an editor-only package. Editor-facing application
services should use typed request payloads, `loadMapList`/`loadMap`/`updateMap`-style method
names, and validate nullable IDs at the service boundary before dispatching background tasks.
