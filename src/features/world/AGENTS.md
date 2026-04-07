# World Feature

## Purpose

`features.world` owns world navigation surfaces and the world-owned boundary that composes `hexmap` and `dungeon`.

## Canonical Types and APIs

- `features.world.api` — public world-owned boundary used by shell bootstrap.
- `WorldModule` — world composition seam that exposes overworld and dungeon-facing surfaces.
- `features.campaignstate.api` — campaign-state seam consumed for persisted world-session position.

## Where New Code Goes

- Put shared world navigation behavior here.
- Keep reusable world-owned UI building blocks shared by runtime and editor surfaces under world-owned UI, not under one editor subtree.
- Keep editor-facing application services on typed request payloads such as `loadMapList`, `loadMap`, and `updateMap`.

## Forbidden Drift

- Do not move `campaign_state` ownership into the world feature.
- Do not add new world package families without naming a stable world-owned owner first.
