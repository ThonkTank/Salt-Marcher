# Loot Persistence Contract

Development schema 27 stores Loot in campaign SQLite:

- `loot_treasure`, `loot_container`, and `loot_item` are the Treasure aggregate
- `loot_allocation` records completed recipient shares
- `loot_operation_receipt` binds every create, update, move, generated accept,
  group-and-reward commit, distribution, or ledger-correction command ID to a
  canonical request fingerprint and its typed original result; a different
  request with the same ID fails with `idempotency_conflict`
- `loot_metadata` revisions the separately loaded Loot projection
  and backs the dedicated `loot.changed` invalidation event
- `character_loot_ledger_metadata` and `character_loot_entry` are owned by
  CharacterLoot and record award provenance plus append-only linked corrections
- `session_generation_run` stores immutable session- or group-reward metadata
  pinned to its unique semantic-origin fingerprint;
  `session_generation_group_source`, `session_generation_group_entry`,
  `session_generation_encounter`,
  `session_generation_treasure`, `session_generation_item`,
  `session_generation_container`, `session_generation_warning`, and
  `session_generation_audit` store its ordered child records

Foreign keys are used only inside an owner. Location, Scene, Group, character,
catalog, and generated-source identities are logical references validated by
application commands where applicable. This prevents another owner from
cascading away Loot history.

The run root never stores one aggregate `run_json` blob or localized display
text. Child facts are strictly Zod-validated when written and rehydrated,
immutable run tables have no update operation, and renderer presenters derive
localized summaries from typed values.

All write inputs and read projections are Zod-validated at IPC boundaries.
Renderer code has no SQLite or filesystem access. Generated-run creation,
Treasure commands, distribution, ledger reads, and corrections execute in the
utility process.

A `group_reward` source may refer to a prospective group and therefore stores
a nullable group revision. Its normalized entry rows preserve living and dead
quantities. `loot.commitGroupReward` validates that immutable source first and
then validates every submitted generated origin against that run and every
catalog origin against the immutable registry artifact named by the run's
`catalogVersion` and `catalogContentHash`. Utility
derives generated source IDs, catalog IDs, magic, rarity, and curse metadata;
only editable names, quantities, values, stackability, capacities, and packing
assignments come from the draft.

Generated and edited rewards materialize into one internal Treasure model and
use one aggregate writer. `loot_item.catalog_entry_kind` distinguishes normal
and magic catalog identities; generated item and container source IDs are
unique within their Treasure. SQL constraints enforce the nullability, magic,
rarity, curse, stackability, and quantity combinations. New persistence IDs
are mapped from stable draft container IDs before item rows are inserted. The
command fingerprint includes the complete Treasure draft.

The handler then saves or updates the Scene group, reconciles Combat,
materializes the edited Treasure, advances the Loot projection, and records the
receipt in one campaign transaction. A failed validation or write rolls back
every participating owner.
