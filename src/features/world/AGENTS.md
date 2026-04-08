# World Feature

## Purpose

`features.world` owns world navigation surfaces and the world-owned boundary that composes `hexmap` and `dungeon`.

## Canonical Types and APIs

- `features.world.api.ApiObject` — public world-owned boundary used by shared bootstrap — composes overworld and dungeon-facing surfaces plus the shared travel scene.
- `features.world.hexmap.HexmapObject` — hexmap feature root seam — returns the overworld/editor view pair and shared travel surface wiring consumed by the world boundary.
- `features.campaignstate.api` — campaign-state seam consumed for persisted world-session position.

## Where New Code Goes

- Put shared world navigation behavior here.
- Keep reusable world-owned UI building blocks shared by runtime and editor surfaces under world-owned UI, not under one editor subtree.
- Keep editor-facing application services on typed request payloads such as `loadMapList`, `loadMap`, and `updateMap`.

## Forbidden Drift

- Do not move `campaign_state` ownership into the world feature.
- Do not add new world package families without naming a stable world-owned owner first.
