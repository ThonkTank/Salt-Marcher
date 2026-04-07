# Encounter Table Feature

## Purpose

`features.encountertable` owns encounter tables, their recovery flows, and the public API consumed by shell and encounter-owned features.

## Canonical Types and APIs

- `features.encountertable.api` — public encounter-table boundary.
- `api/` — cross-feature DTOs and service facades for encounter-table reads and recovery entry points.
- `recovery/` — encounter-table-owned recovery workflows and persistence.

## Where New Code Goes

- Put encounter-table reads, writes, and recovery behavior in this feature.
- Keep consumer-specific interpretation rules in the consuming feature rather than in the API seam.

## Forbidden Drift

- Do not move consumer-specific decision policy into `api/`.
- Do not let recovery behavior become a generic shared utility outside encounter-table ownership.
