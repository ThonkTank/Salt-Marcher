# Campaign State Feature

## Purpose

`features.campaignstate` owns the persisted world-session aggregate in `campaign_state`.

## Canonical Types and APIs

- `CampaignstateObject` — canonical campaign-state root seam — accepts connection-aware world-session requests and returns focused session payloads.
- `repository/CampaignstateRepository` — canonical persistence boundary for the singleton `campaign_state` aggregate.
- `features.calendar.CalendarObject` — calendar-owned day/phase progression seam. `campaignstate` persists the session cursor but does not define calendar semantics.
- `api/CampaignStateApi` and `api/CampaignStateReadApi` — legacy compatibility facades. Keep them delegating to the canonical root instead of growing new behavior.
- `api/DungeonTilePosition` — lightweight compatibility value for legacy dungeon-position consumers.

## Where New Code Goes

- Put persisted world-session reads and writes here.
- Keep overworld and dungeon position persistence behind the campaign-state public seam instead of writing the table from consuming features.
- Route day/phase progression through the calendar root while keeping `calendar_id`, `current_epoch_day`, and `current_phase_id` persisted here.
- Put new request carriers under `input/`, protected persisted carriers under `state/`, and JDBC flows under the canonical repository.
- Do not use `api` naming here as the default placement for new owner-local schemas or helpers.

## Forbidden Drift

- Do not move `campaign_state` ownership into `features.world`.
- Do not add consumer-specific policy to the public compatibility surface.
- Do not split this persisted world-session aggregate across consumer features.
- Do not let `campaignstate` redefine calendar-owned progression semantics.
