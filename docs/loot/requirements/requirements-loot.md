# Loot Requirements

## Goal And Scope

Loot owns mutable, campaign-local Treasure instances after explicit GM
acceptance or manual creation. Every item fact belongs to one canonical
`ItemDefinition`; Generated Runs, Treasures, and Character Loot refer to it by
`ItemReference`. Their context owns only quantity, container assignment,
distribution, and ledger status. Name, copper value, capacity, stackability,
magic, rarity, curse, and structured components are never copied into those
owners.

A Treasure has exactly one current anchor: a World Planner location, a Scene
group, or `unplaced`. Several Treasures may share one anchor. Moving the anchor
changes the same Treasure; repeated physical occurrences are independent
instances.

Session Generation owns immutable proposals. A generated definition records
its base item, modifier, component, magic item and variant, spell, enspelled
rule, curse, and coin denominations once in the immutable run. Accepting the
proposal stores only its reference and instance facts in Loot.

## Live Session And Manual Editing

- Group and location sections show all Treasures at that anchor.
- Unplaced and unresolved Loot is paginated in a separately loaded Inbox.
- Manual Treasure creation selects ordinary or magic definitions from the
  versioned catalog. It may create instances, adjust quantities and packing,
  and remove unallocated instances; it cannot author free item definitions.
- Historical free-form rows are migrated to immutable read-only legacy
  definitions. They do not create a general item CRUD surface.
- Allocated quantities remain protected.
- Encounter Resolution references typed Treasure identities, never a text
  summary.
- `loot.scene` and `loot.inbox` hydrate item definitions through the central
  resolver and are invalidated by the monotone Loot revision and
  `loot.changed`; Loot is not embedded in `LiveSessionSnapshot`.

Published catalog artifacts remain addressable by version and content hash.
The registry, manifest, table shapes, and hashes are verified before use. A new
active catalog affects only new selections and generation; historical
references keep resolving against their pinned artifact.

## Group Reward Generation

The Group manager may generate Loot for a new, changed, or unchanged
non-archived group draft with an assigned leveled Party. The request pins the
normalized living/dead roster, Scene and optional Group revisions, Party and
campaign-rule revisions, selected XP policy, generator preset, catalog, and
the participating Character Loot basis.

Generation produces exactly one immutable group-reward run. That run has zero
or one normal Encounter-channel Treasure.

It does not generate a whole adventuring day.

Group rewards never create overstock. Combat Resolution and Loot use the same
current rule and revision from the campaign to select base or adjusted
Encounter XP. Changing that policy makes an older draft stale.

The post-fight projection assigns each participating character
`floor(effectiveRewardXp / partySize)`. For every character the generator:

1. adds projected XP to current XP;
2. interpolates the configured gold target across the progression anchors,
   capped at the 355,000-XP anchor;
3. integrates each configured rarity rate across every crossed XP band and
   probabilistically rounds the remainder;
4. sums the Party targets;
5. subtracts effective Character Loot balances and clamps each deficit to
   zero.

All effective non-magic definitions contribute their full copper value. Magic
definitions contribute by rarity and not to gold. Received, sold, and
given-away entries remain counted; a superseded row is replaced by its linked
effective correction. Accepted but undistributed Treasure is not Character
Loot and therefore does not count.

The Group editor owns one compact Monster / Loot workspace, with manual catalog
selection available without generation or assigned Party. Loot search, type,
category and rarity narrow actual catalog entries. Add, quantity and remove actions
match the Monster view. Existing Treasures load into a compact selector; `Neuer Loot`
creates another local draft. All changed Treasures of the group can be included in
one save. Container assignments and facts are instance edits; item definitions and
provenance remain immutable. Nonstackable items stay individual instances. Distributed
quantities cannot be removed or reduced. Coins use canonical denomination definitions.

Monster mutations and history do not invalidate Loot. An automatic initial proposal
is allowed only with no existing Loot. Explicit `Loot generieren` replaces the selected
proposal after discard confirmation. Generated references survive subsequent roster
changes, with their original definitions and source lines validated against saved runs.

Loot balance is a read-only Utility capability: actual / target / difference for
nonmagical copper value and magical count remain visible. Details include coin and
item values and actual/target counts by rarity. It evaluates all undistributed group
Loot, replacing persisted treasures with submitted drafts, without double counting
allocations. Targets reuse the cumulative ledger budget, current roster, XP rule,
assigned active Party, configured Loot rules and tolerance. The draft budget seed is
stable. Recalculation neither changes items nor creates or persists generator runs.
Missing party, level, roster or creature facts yield an explicit status and null targets.
Over/under budget remains advisory.

`Übernehmen` calls `loot.commitGroupEditor`, an atomic idempotent command for the
Group and any included new or updated Treasures, independent of a Generator Run.
Utility checks group and Treasure revisions, anchors, immutable definitions/provenance,
container references and protected distributions inside one transaction. It reconciles
Combat, advances Loot once, and records the original result. `loot.groupEditorReceipt`
recovers an uncertain response without resubmitting. Any failure rolls back both owners.
Excluding Loot never deletes existing treasures; excluded unsaved changes require explicit
resolution before closing. Existing Generator Run formats and the legacy fixed-run
commit command remain compatible for historical callers.

## Session Reward Generation

The Session Planner computes the same cumulative deficit once for its selected
participants using their full projected Session XP, then distributes the
normal budget across its Treasure plan. Its configured overstock is a separate,
explicitly reported additional pool and is not subtracted from the normal
ledger deficit. Before prepared plans are saved, participant XP, projected XP,
Party/preset/catalog identity, and ledger basis are revalidated; a changed
basis makes the run stale.

## Distribution And Character Loot

The shared distribution dialog uses the current active Party as recipients.
Stackable quantities may be split; a non-stackable instance cannot allocate
more than one unit. Completion validates Party and Treasure revisions, active
recipients, unique shares, and remaining quantities, then writes allocations
and Character Loot entries in one transaction.

Character Loot entries retain their `itemReference`, quantity, award
provenance, time, status, and optional `treasureItemId`. Read projections resolve
the definition. Corrections append a linked replacement and supersede the
original without rewriting history.

## Acceptance

- generated, Treasure, and Character Loot records resolve the same definition
  without copied magic or rarity fields;
- generated combinations and coin denominations survive restart exactly as
  stored in the run;
- a Group draft cannot add, remove, replace, or redefine generated items;
- the manual editor creates items through catalog selection only;
- multiple Treasures per anchor and unresolved anchors survive restart;
- stale Party, rules, catalog, preset, or ledger bases write no partial state;
- retries return the original typed result and conflicting command reuse fails;
- distribution and correction preserve immutable item identity;
- effective cumulative grants include sold/given items, replace superseded
  rows with corrections, exclude undistributed Treasure, and clamp
  overprovisioned deficits to zero;
- an empty Group reward commits the Group without an empty Treasure.
