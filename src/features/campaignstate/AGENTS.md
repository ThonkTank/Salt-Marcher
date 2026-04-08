# Campaign State Feature

## Purpose

`features.campaignstate` owns the persisted world-session aggregate in `campaign_state`.

## Canonical Types and APIs

- `features.campaignstate.api` — current public compatibility surface consumed by world-owned features. Keep cross-feature access here, but do not treat `api/` as the placement precedent for new owner-internal code.
- `CampaignStateApi` — current mutation facade for persisted session state.
- `CampaignStateReadApi` — current read facade for persisted session state.
- `DungeonTilePosition` — lightweight dungeon runtime position value exported through the public compatibility surface.

## Where New Code Goes

- Put persisted world-session reads and writes here.
- Keep overworld and dungeon position persistence behind the campaign-state public seam instead of writing the table from consuming features.
- Do not use `api` naming here as the default placement for new owner-local schemas or helpers.

## Forbidden Drift

- Do not move `campaign_state` ownership into `features.world`.
- Do not add consumer-specific policy to the public compatibility surface.
- Do not split this persisted world-session aggregate across consumer features.
