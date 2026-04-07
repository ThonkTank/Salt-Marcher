# Campaign State Feature

## Purpose

`features.campaignstate` owns the persisted world-session aggregate in `campaign_state`.

## Canonical Types and APIs

- `features.campaignstate.api` — public campaign-state boundary consumed by world-owned features.
- `CampaignStateApi` — mutation seam for persisted session state.
- `CampaignStateReadApi` — read seam for persisted session state.
- `DungeonTilePosition` — lightweight dungeon runtime position value exported through the API.

## Where New Code Goes

- Put persisted world-session reads and writes here.
- Keep overworld and dungeon position persistence behind the campaign-state API instead of writing the table from consuming features.

## Forbidden Drift

- Do not move `campaign_state` ownership into `features.world`.
- Do not add consumer-specific policy to the API layer.
- Do not treat this file as a roadmap for a different future feature.
