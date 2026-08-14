# Loot Domain Model

## Ownership

`Loot` owns mutable `Treasure`, `TreasureItem`, `TreasureContainer`, and
`LootAllocation` truth. `CharacterLoot` separately owns the recipient ledger.
Session Generation owns immutable `GeneratedRun` proposals and the public item
catalog owns reusable reference facts.

## Treasure

A Treasure has a stable ID, aggregate revision, label, source, exactly one
anchor, ordered containers, and ordered item lines. Its total and allocated
values are derived from item quantities and copper-piece unit values. An item
retains its stable identity after partial allocation. Allocated quantity cannot
exceed total quantity or be removed by an edit.

Anchors are logical references rather than foreign keys. A location anchor
stores `locationId`; a group anchor stores `sceneId` and `groupId`. Both retain
a last-known label so unresolved external references remain repairable.

## Editable Group Reward Draft

An immutable group-reward `GeneratedRun` is the proposal and provenance root;
it is not an editable Treasure. Renderer projects its one generated Treasure
into a local draft whose label, item fields, containers, and packing links may
change. Stable draft IDs make edits and container references independent of
array positions. Every item and container origin is a closed union:

- a generated origin references exactly one source line or source container in
  the immutable proposal
- a catalog origin references an ordinary item, magic item, or visible
  container in the immutable registry artifact pinned by `catalogVersion` and
  `catalogContentHash`

The catalog read is a bounded projection rather than mutable domain state.
Search and type/category/rarity filters operate over active normal and magic
items and non-hidden containers. Normal catalog value is rounded to copper at
this boundary; magic value is excluded from the copper budget and represented
by a separate count.

On confirmation, Utility materializes a new mutable Treasure from the draft.
Editable fields come from the draft, while magic, rarity, curse, catalog IDs,
and generated source IDs are derived from authoritative origins. A generated
line may occur at most once; catalog entries may create independent instances.
Removing generated lines is valid, but at least one item must remain. Removing
a container first detaches its items.

## Consistency

Treasure edits are optimistic aggregate commands. Distribution spans the Loot
and CharacterLoot owners through one application-level campaign transaction.
The command receipt is the idempotency boundary. SQL remains in the owning
stores; the application service coordinates without introducing cross-owner
tables or an ORM.

Group reward confirmation spans Scene, Combat reconciliation, immutable
Generation lookup, and Loot materialization in one campaign transaction. Its
idempotency fingerprint covers the complete normalized draft so the same
command ID cannot silently accept different edits.
