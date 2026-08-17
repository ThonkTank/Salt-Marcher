# Version truth

This file is checked against executable registries by `pnpm check:version-truth`.
Edit the owning registry or constant first; documentation drift fails the
canonical check.

## Persistence

| Role | Current schema | Complete forward path | Migration owner |
| --- | ---: | --- | --- |
| installation | 33 | `27 -> 28 -> 29 -> 30 -> 31 -> 32 -> 33` | `installation-schema-migrations.ts` |
| campaign | 33 | `27 -> 28 -> 29 -> 30 -> 31 -> 32 -> 33` | `campaign-schema-migrations.ts` |

Migration registry contract: **5**.

## Generation

| Dimension | Current | Canonical owner |
| --- | --- | --- |
| Encounter engine | `encounter-v5` | `session-generation.ts` |
| Reward engine | `reward-v3` | `session-generation.ts` |
| Generator config | `Config V5` | `generator-presets.ts` |
| Session-generation catalog | `catalog-2026-08-16` | `resources/sessiongeneration/registry.json` |
| Catalog content hash | `59f4a9ab7b7164b9151d5339f41136701efa45a58666ee1cab7cff101b224a03` | current catalog manifest |

Persisted reward runs remain readable for: `reward-v2`, `reward-v3`. Commands
and newly generated runs require the current Reward engine version. Unknown
versions fail contract validation; saved concrete runs,
not an old engine implementation, remain replay authority.
