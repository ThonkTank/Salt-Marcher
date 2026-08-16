# Loot Domain Model

## Ownership

The catalog owns reusable catalog `ItemDefinition` facts. Session Generation
owns immutable generated definitions and proposals. Loot owns mutable
`Treasure`, `TreasureItem`, `TreasureContainer`, and `LootAllocation` instance
truth. Character Loot owns the recipient ledger. All three runtime owners use
the same `ItemReference`; none duplicates definition facts.

This is the same boundary used for monster statblocks: contexts reference one
canonical definition instead of maintaining encounter-, group-, and
combat-specific copies.

## Item Definitions And References

A definition contains canonical presentation and rule facts: name, value,
capacity, stackability, magic, rarity, curse, and component references.
Generated definitions additionally preserve the selected basis/modifier/
component/magic variant/spell/enspelled rule/curse/coin structure in their
immutable run. Read models hydrate a reference through the central resolver.

A Treasure item adds only stable instance ID, quantity, container assignment,
order, and provenance. A Character Loot entry adds quantity, distribution
origin, time, status, and correction linkage. Moving, selling, or giving an
instance therefore cannot mutate or fork its definition.

## Treasure

A Treasure has a stable ID and revision, label, source, exactly one anchor,
ordered containers, and ordered item instances. Totals are derived from
resolved definitions and quantities. Allocated quantity cannot exceed total
quantity or be removed by an edit.

Anchors are logical references rather than foreign keys. Location anchors keep
`locationId`; Group anchors keep `sceneId` and `groupId`. Both retain a
last-known label so unresolved references remain repairable.

Manual Treasure editing selects definitions from the catalog and changes
instance state. Migrated legacy definitions are addressable and read-only but
are not a new authoring path.

## Group Reward Draft

An immutable group-reward run is the proposal and provenance root, not an
editable Treasure. Renderer assigns stable local draft IDs and maps generated
container IDs so item packing can be edited without relying on array position.
The generated item set, item references, and container set/facts are fixed.
Only item quantity and container assignment are editable; the Group catalog is
informational.

On confirmation, Utility rejects unknown, duplicate, replaced, or missing
generated lines and containers. The validated draft becomes a mutable Treasure
through the same aggregate writer used by other acceptance paths. A run with no
deficit has no draft and creates no Treasure.

## Consistency

Treasure edits use optimistic aggregate commands. Distribution spans Loot and
Character Loot through one campaign transaction. Group confirmation spans
Scene, Combat reconciliation, immutable Generation lookup, and Loot through
one campaign transaction. Typed receipts are the idempotency boundary.

The Group coordinator order is: exact receipt replay; Party, rule, ledger, and
source revision guards; existing-materialization conflict detection; immutable
draft materialization; Group mutation; optional Treasure write; one optional
projection increment; receipt. Session preparation performs an equivalent
reward-basis revalidation immediately before saving prepared plans.
