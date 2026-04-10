# World Feature

## Purpose

`features.world` owns world navigation surfaces and the world-owned boundary that composes `hexmap` plus dungeon-facing features.

## Canonical Types and APIs

- `WorldObject` — canonical world-owned boundary used by shared bootstrap — composes overworld and dungeon-facing surfaces plus the shared travel scene.
- `features.world.input` — canonical world-owned requests and result carriers for scene registration and view composition.
- `features.world.read.ReadObject` — canonical world read bridge for world-wide transition-target and map-id lookups consumed by dungeon and shell-facing workflows.
- `features.world.read.input` — canonical world-owned read requests and result carriers.
- `features.world.api.ApiObject` — compatibility world boundary. Keep old callers stable here, but do not treat `api/` as placement precedent for new world-owned code.
- `features.world.hexmap.HexmapObject` — hexmap feature root seam — returns the overworld/editor view pair and shared travel surface wiring consumed by the world boundary.
- `features.world.dungeonclean.DungeoncleanObject` — parallel clean dungeon rebuild seam. Use it for migrated capabilities instead of reopening legacy `features.world.dungeon` seams.
- `features.campaignstate.CampaignstateObject` — campaign-state seam consumed for persisted world-session position and time progression.

## Where New Code Goes

- Put shared world navigation behavior here.
- Keep reusable world-owned UI building blocks shared by runtime and editor surfaces under world-owned UI, not under one editor subtree.
- Keep editor-facing world requests on explicit world-owned seams with typed request payloads such as `loadMapList`, `loadMap`, and `updateMap`.
- Put world-wide read bridges under `features.world.read` instead of `features.world.api.read`.
- Keep `api/` as compatibility only; do not place new world-owned boundary logic there.
- Do not use `application` naming here as placement precedent for new touched architecture work.

## Forbidden Drift

- Do not move `campaign_state` ownership into the world feature.
- Do not add new world package families without naming a stable world-owned owner first.
- Do not keep `ApiObject` as the factual world composition root.
- Do not keep `api/read` as the factual world read bridge.
