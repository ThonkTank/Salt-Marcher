# Schema Reference

This repository now defines lightweight runtime schemas for upcoming domain data (factions, places, dungeons, playlists, calendar events, loot templates).

## Validation Commands

| Command | Description |
|---------|-------------|
| `devkit lint tags` | Scans presets for tag values and checks them against `docs/TAGS.md`. |
| `devkit schema validate` | Transpiles `src/domain/schemas.ts` on the fly and validates Markdown documents (currently the samples in `samples/**`). |
| `devkit migrate factions-v1 [--dry-run]` | Normalises faction documents (ensures array tags, numeric member counts, version field). |

## Document Locations

| Entity      | Location (plugin)           | Notes |
|-------------|-----------------------------|-------|
| Factions    | `samples/fraktionen`        | Sample files used for schema validation; user vault files expected under `SaltMarcher/Fraktionen`. |
| Places      | `samples/orte`              | Demonstrates hierarchical ownership/influence fields. |
| Dungeons    | `samples/dungeons`          | Square-grid metadata, rooms, tokens, fog. |
| Playlists   | `samples/playlists`         | Tracks, fade settings, context rules. |
| Events      | `samples/events`            | Recurring/single schedule examples with triggers/effects. |
| Loot        | `samples/loot`              | XP range, gold formula, item tables, inherent loot. |

See `src/domain/schemas.ts` for full validator definitions.

## Next Steps
- Wire schema validation into CI once vault migrations land.
- Extend samples once real data structures stabilise.
