# Encounter Table Feature

## Purpose

`features.encountertable` owns encounter tables, their recovery flows, and the current public compatibility surface consumed by shell and encounter-owned features.

## Canonical Types and APIs

- `EncountertableObject` — canonical root seam for encounter-table reads, writes, linked-loot-table updates, and candidate loading.
- `recovery.RecoveryObject` — canonical root seam for encounter-table backup and restore workflows.
- `features.encountertable.api` — current public encounter-table compatibility surface. Keep cross-feature reads here, but do not treat `api/` as the destination for new owner-internal placement.
- `api/` — existing cross-feature DTO and facade package for encounter-table reads and recovery entry points. Preserve compatibility when touching it, but place new owner-local internals elsewhere in the feature.
- `recovery/` — encounter-table-owned recovery workflows and persistence.

## Where New Code Goes

- Put encounter-table reads, writes, and recovery behavior in this feature.
- Keep consumer-specific interpretation rules in the consuming feature rather than in the public compatibility surface.
- Do not use `api` or `service` naming here as placement precedent for new touched architecture work.

## Forbidden Drift

- Do not move consumer-specific decision policy into the public compatibility surface.
- Do not reintroduce `service` as the factual encounter-table root.
- Do not let recovery behavior become a generic shared utility outside encounter-table ownership.
