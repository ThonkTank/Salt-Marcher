# Loot Persistence Contract

Campaign schema 35 and installation schema 34 are current. The migration
registry is version 7; Loot's canonical-item change remains the 30-to-31
migration in that forward chain.

## Canonical Item Identity

`ItemReference` is a closed union:

- `catalog`: catalog version/content hash, entry kind, and catalog ID;
- `generated`: immutable run ID and run-local definition ID;
- `legacy`: immutable campaign-local legacy definition ID.

`session_generation_item_definition` stores each generated `ItemDefinition`
once. `loot_legacy_item_definition` stores definitions created only while
migrating historical free rows. Catalog definitions remain in immutable
manifest-verified artifacts. The resolver accepts one reference and loads its
definition from exactly one of those sources.

Definitions own name, copper value, unit capacity, stackability, magic,
rarity, curse facts, and structured component identities for base item,
modifier, component, magic item/variant, spell, enspelled rule, curse, and coin
denominations.

`session_generation_item`, `loot_item`, and `character_loot_entry` store an
`item_reference_json` plus owner-specific facts. They do not store copied name,
value, stackability, magic, rarity, or curse columns. IPC read models hydrate
those facts after batched resolution.

## Owner Tables

- `loot_treasure`, `loot_container`, `loot_item`, and `loot_allocation` form
  the mutable Treasure aggregate.
- `character_loot_ledger_metadata` and `character_loot_entry` belong to
  Character Loot and store awards, statuses, and append-only linked
  corrections.
- `loot_metadata` revisions the separately loaded Loot projection.
- `loot_operation_receipt` binds each command ID to operation type, canonical
  request fingerprint, target, result schema, and its original typed result.
- `session_generation_run` and normalized source, reward-basis, definition,
  Treasure, item, container, warning, audit, and parameter tables form the
  immutable Generated Run owner. There is no aggregate `run_json` column.

Foreign keys are used only inside an owner. Location, Scene, Group, character,
catalog, and generated identities are logical references validated by
application commands so another owner cannot cascade away Loot history.

## Generated Runs And Reward Basis

Every run pins engine versions, catalog version/hash, generator preset
ID/revision/config hash, input, output, and the Character Loot reward basis.
The basis records participants, current/projected XP, ledger revisions, target
gold/rarity state, actual effective state, and clamped deficits. Immutable
children are ordered and Zod-validated on write and hydration.

Session runs permit zero or more Treasures. Group runs permit zero or one.
Generated item rows refer to run-owned definitions; accepting a proposal keeps
the same reference. Exact random selection is not reconstructed from the seed:
the persisted immutable result is the replay authority.

## Group Commit

`loot.commitGroupReward` accepts either a generated Treasure identity and a
complete draft, or both values as `null` for an empty result. For a non-empty
result, every generated source item and source container must occur exactly
once. Item references and container facts must match the immutable run; only
quantity and item-to-container assignment may differ.

The handler validates source and revision guards, saves the Scene Group,
reconciles Combat, writes the Treasure through the common aggregate writer,
increments the Loot projection once, and records the receipt in one campaign
transaction. A failed check or write rolls back all participating owners. The
request fingerprint includes the complete nullable Treasure draft.

## Schema 30 To 31 Migration

The tested migration preserves run, Treasure, ledger, source-line, allocation,
and correction identities. Existing generated rows become `generated`
references backed by one run-owned definition. Catalog-bound rows become
catalog references. Unmappable free rows become shared immutable `legacy`
definitions. Copied fact columns are removed after conversion.

Old Loot receipts are cleared because their serialized result envelopes contain
the retired copied-field shape; domain aggregates and provenance remain. Audit
and parameter tables are rebuilt with the then-current, now historical,
`reward-v2` audit vocabulary. Sparse
development Golden Masters are handled conditionally, while populated
migration fixtures verify reference sharing and restart hydration.
