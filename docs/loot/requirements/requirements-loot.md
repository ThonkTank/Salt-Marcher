# Loot Requirements

## Goal And Scope

Loot owns mutable, campaign-local treasures after explicit GM acceptance or
manual creation. One treasure has exactly one current anchor: a World Planner
location, a Scene group, or `unplaced`. Several treasures may share one owner.
Moving the anchor changes the same treasure; repeated physical occurrences are
independent treasures.

Session Generation owns immutable generated proposals. Accepting a generated
treasure materializes referenced catalog definitions and structured packing
facts into Loot exactly once and records the run and generated-treasure
provenance. The source run and catalog definitions remain unchanged.

## Live Session

- the left group list shows a collapsible Loot section per group
- location Loot appears in its own section below active groups
- unplaced and unresolved Loot live in a separate paginated Inbox that is
  loaded only when opened and can be reassigned
- manual treasures, containers, item lines, and item-container assignments can
  be created or edited; already allocated quantities remain protected
- Encounter Resolution references typed treasure identities, never a free-text
  Loot summary
- the Session reads Loot through a dedicated revisioned projection and
  `loot.changed` event; Loot is not embedded in `LiveSessionSnapshot`

`loot.scene` contains only treasures anchored to the focused scene's groups or
location plus the monotone Loot revision. `loot.inbox` owns cursor pagination
for unplaced and unresolved treasures. Both projections batch-load their
treasures, items, and containers. Anchor diagnosis reads narrow anchor rows
before hydrating only actual unresolved results.

## Group Reward Generation

The Group manager may generate Loot for a new, changed, or unchanged
non-archived group draft with an assigned leveled Party. The request captures
the complete normalized roster, Scene, optional Group, Party, and campaign-rule
revisions plus an internal seed. It produces exactly one immutable group-reward run and
zero or one normal Encounter-channel treasure proposal; it does not generate a
whole adventuring day, quest reward, environment reward, or overstock.

`Auffüllen` and `Neu generieren` immediately turn the generated proposal into
an inline, renderer-local Treasure draft after the roster draft succeeds. Its
label, quantities, containers, capacities, and item-container assignments are
editable. Generated and catalog item names, unit values, stackability, magic,
rarity, and curse facts are immutable and re-derived by Utility during
confirmation. Items and containers
have stable draft IDs and retain a discriminated origin pointing either to one
immutable generated source line or to one catalog entry. The immutable run is
never rewritten.

The Group manager's left catalog switches between `Kreaturen` and `Loot`.
`loot.catalog` is a Zod-validated, paginated read addressed by `runId`. Utility
derives that immutable run's `catalogVersion` and `catalogContentHash`; a
mismatching expected hash is stale and a missing registered artifact is
`catalog_unavailable`. Published catalog artifacts are immutable and remain
addressable through a validated registry after another catalog becomes active.
The registry and every manifest/table hash are verified before use; full
catalogs and their prepared Loot indexes are loaded lazily and cached by content
hash. It searches active ordinary
and magic items plus non-hidden containers and filters by type, category, and
rarity. Results contain authoritative identity, default name, copper value
rounded at the catalog boundary, stackability, magic/rarity, or container
capacity. New Group-reward lines must come from this catalog; the ordinary
Treasure editor continues to support free rows.

Adding an unchanged stackable catalog item increments its existing quantity.
Changed stackable items, non-stackable items, magic items, and containers are
added as separate instances. Removing a container clears every assignment to
it, and at least one item line is required. Draft edits support bounded
semantic undo/redo and are cached per Group draft. Text editing from focus to
blur forms one history entry; selections, toggles, additions, removal, and the
atomic removal-and-detachment of a container each form one entry. A manual
roster change, roster
undo/redo, fill, replacement generation, or Loot reroll replaces its draft;
when the draft contains Loot edits, the GM must first confirm discarding them.
The seed remains hidden and every reroll draws an independent seed.

One `GroupManagerState` reducer owns every Group session, both histories,
request tokens, the paired Group/Creature and Treasure/Loot views, pending
discard intents, and external revision conflicts. Late asynchronous results are
ignored by token. Switching groups preserves the per-Group cache; external
snapshots replace clean sessions and mark dirty sessions as conflicted.

The inline budget header shows the positive post-fight ledger deficit, current
draft non-magic copper,
difference, a progress bar, and target/current magic count. The existing
plus/minus 15 percent generator tolerance only classifies the draft; it never
blocks confirmation. Existing groups use the same inline editor instead of a
separate modal.

`Gruppe & Loot übernehmen` submits the complete Treasure draft in one atomic,
idempotent command. Utility revalidates generated origins against the immutable
run and catalog origins against the run-pinned catalog. It derives immutable
magic, rarity, curse, and provenance facts rather than trusting Renderer input,
saves or updates the group, reconciles active Combat state, materializes the
edited Treasure, and advances the Loot projection in one transaction. An empty
deficit saves the Group without creating an empty Treasure. The
canonical fingerprint includes the complete draft. Any failure writes neither
the group nor the treasure. The ordinary `Speichern` action remains a
group-only command.

The campaign-wide reward rule selects base or adjusted Encounter XP. The same
current rule and revision are used by Combat XP awards and group Loot budgets.
Changing the rule makes an older confirmation stale rather than silently
awarding or generating with another basis.

## Distribution

The shared distribution dialog uses the current active Party as its recipient
set. Stackable quantities can be split between recipients. Non-stackable items
cannot allocate more than one unit. Closing or cancelling the dialog persists
nothing.

`Verteilung abschließen` is one atomic, idempotent command. It validates the
expected Party and Treasure revisions, active recipients, unique item and
recipient rows, and remaining quantities. Success creates Treasure allocations
and awarded character-ledger entries in the same transaction and advances the
Treasure revision once. Any failure writes neither side.

## Current Boundary

The current slice reads awarded ledger entries with Treasure and generated
reward provenance. A correction appends a linked replacement row, marks the
original as superseded, and may correct its received/given-away/sold status;
the original row is never rewritten. Cumulative-loot compensation uses the
source-backed Config-V4 progression described by Session Generation.
Independent sale/give-away workflows, Shop purchases, and Quest authoring
remain later commands.

## Acceptance

- multiple treasures at the same location or group survive restart
- deleting or hiding an anchor does not delete its treasure; last-known labels
  preserve repair context
- accepting the same generated treasure twice does not duplicate it
- a group-and-reward retry returns its original group patch and treasure
- catalog search/filter/pagination is deterministic and rejects a catalog hash
  other than the generated run's hash
- edited, removed, and catalog-added lines retain authoritative provenance and
  derived magic metadata after restart
- a stale or mismatching group draft writes neither group nor treasure
- replaying one completed distribution returns its original outcome
- reusing any Loot command ID with different semantic input is rejected
- stale revisions or inactive recipients roll back allocations and ledger rows
- character ledgers retain quantity, value, award time, and provenance
- ledger corrections retain both the original and linked correction rows
- generated budgeting counts effective cumulative grants through referenced
  Treasure items and never rewards disposal a second time
