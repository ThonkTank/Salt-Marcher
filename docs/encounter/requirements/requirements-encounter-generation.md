# Encounter Generation Requirements

## Purpose And Terminology

This document is the canonical product source for generator-preset ownership,
Generator Config V3, encounter composition, candidate ranking, and the
generator settings surface. Campaign, Scene, Session Generation, and Combat
requirements define only how they consume this behavior.

- A `CR-Block` is one abstract generated composition block: one role, one CR,
  a quantity, and a positive number of statblock slots.
- A `Gruppe` is a persisted, concrete Scene roster. Generator UI and contracts
  MUST NOT call an abstract CR-Block a group. Scene UI continues to call its
  persisted rosters `Gruppe`.
- A preset is an installation-owned composition policy. Its assignment to a
  Campaign is explicit and independent of saving or copying the preset.

## Preset Ownership And Config V3

The installation owns one revisioned preset registry and a protected system
preset. A Campaign may point to one custom preset; no assignment means that the
system preset is effective. A custom preset may be shared by several
Campaigns.

`GeneratorPresetConfigV3` contains exactly these policy areas:

- `composition`: a 20-by-34 role matrix, per-role integer quantity ranges,
  unique allowed role combinations, CR-Block and statblock ranges, scaled
  monster and initiative-slot ranges, and the mixing mode
- `generationDefaults`: difficulty, amount, balance, and diversity defaults
- `scene.difficultyWeights`: non-negative integer weights for trivial, easy,
  medium, hard, and deadly which total 100
- `combat.mobThreshold`: a non-negative integer; zero disables mobs

The CR columns, in order, are `0`, `1/8`, `1/4`, `1/2`, and `1` through `30`.
The matrix has exactly 20 rows for Party levels 1 through 20. Indexing and
updates use the shared `roleAt` and `updateRoleCell` semantics rather than
duplicated arithmetic.

Scaled ranges MUST remain ordered for every positive Party size. Equal scaling
requires `min.value <= max.value`; a fixed minimum with a per-player maximum
has the same requirement; a per-player minimum with a fixed maximum is valid
only when the minimum is zero.

The system preset is a checked-in generated artifact derived from the pinned
`DB_EncounterRoleBands` and `DB_EncounterPatterns` TSV sources. Runtime code
does not read those source tables. The artifact check pins the source hashes
and compares the exact 20-by-34 matrix and role combinations.

For every Party level, validation calculates the complete Cartesian candidate
count for active combinations. No level may exceed 250,000 candidates. The
checked-in system preset currently has a maximum of 97,985.

Config equality uses one canonical, key-ordered JSON representation. Audit
hashes are the SHA-256 fingerprint of that representation; Scene, Session, and
Combat do not define local hash variants.

## Registry Commands And Recovery

Registry reads include an explicit Campaign context. Every create, update,
delete, and assign command carries a UUID command ID and expected registry
revision. The mutation and its exact receipt are atomic. The journal retains
the newest 512 receipts.

- create/update receipts contain the stored preset and new registry
- delete receipts contain the deleted preset ID, affected Campaign IDs, and
  new registry
- assign receipts contain the concrete assignment, effective preset, and new
  registry

An `outcome_unknown` response is recovered only by reading that command ID's
receipt. The client never speculatively sends the mutation again. Reusing a
command ID for another operation is rejected.

The system preset cannot be updated or deleted. Copying it creates an
unassigned custom preset. Deleting an assigned custom preset removes all of its
assignments and leaves affected Campaigns on the system fallback. Permanent
Campaign deletion cascades its assignment; a referenced preset is delete
restricted until its assignments are removed by the owning preset command.

## Shared Encounter Composition

Scene and Session Generation call one pure selector over a narrow catalog.
Each catalog row contains CR, XP, available quantity or unbounded quantity,
maximum usable quantity for one statblock, and available distinct statblock
capacity. Role-band and pattern import rows are not selector inputs.

The selector returns an immutable `EncounterComposition` containing ordered
blocks, aggregate metrics, structured soft diagnostics, total enumerated
candidate count, and hard-fit candidate count. Each block has role, CR,
quantity, and positive statblock-slot count.

Enumeration recursively streams every candidate, up to the validated 250,000
limit. It keeps counters and the best candidate only; it does not retain or
sort the candidate set.

Candidates that violate the matrix, per-role quantities, allowed combination,
CR-Block range, mixing rule, quantity, or source stock are excluded before
ranking. Remaining candidates are ranked strictly and lexicographically by:

1. membership in the target XP band of plus or minus five percent
2. normalized distance from statblock, monster, and initiative-slot ranges
3. normalized amount, balance, and diversity preference distance
4. absolute XP distance
5. named seeded entropy, only at complete domain equality above
6. stable candidate ID

Soft diagnostics report the normalized distance to the actual range, not a
count of missed ranges. Entropy cannot compensate for a worse domain rank.

`Auffüllen` supplies the current Scene roster as a fixed additive part. XP
multipliers and soft targets evaluate existing plus generated members, while
composition hard rules apply to the generated addition. Scene validates
concrete stock and distinct statblock capacity before selection and MUST fail
if exact materialization later becomes impossible; it never weakens a selected
block. Session keeps the same composition abstract. With equivalent catalog
capacity, both publish equal blocks and the same preset ID, revision, and
config hash.

## Settings And Burger Acceptance

The top-left trigger is a labeled 66-by-66-pixel button. Its anchored popup is
176 pixels wide and contains exactly two ordinary navigation buttons:
`Kampagnen` and `Einstellungen`. Escape, outside click, focus restoration, and
overlay stacking come from the shared anchored-popup/modal layer, not local
document listeners.

Campaign management opens a dedicated modal of `min(31rem, 100%)` width.
Generator settings are a separately lazy-loaded modal of
`min(74rem, 100%)` width with fixed header/footer and a scrolling body. The
generator stylesheet and German message dictionary belong to this lazy leaf.
All visual values use the existing tokens and square-corner design language.

The settings surface provides:

- six role brushes and all 680 semantic matrix-cell buttons in the DOM
- sticky CR header and level column; 15-pixel matrix cells
- pointer painting, right-click clearing, arrow/Home/End navigation, and
  Enter/Space painting; pointer changes are dispatched at most once per
  animation frame
- four difficulty separators supporting pointer dragging, Left/Right by one
  percent, and Shift+Left/Right by five percent while preserving a total of 100
- coherent min/max editing, independently scaled range boundaries, mixing,
  mob threshold, and editable unique role combinations
- explicit copy, save, assign, delete, reset, and close actions

At 200 percent scaling and at the minimum application viewport the dialog
remains within the viewport, its body scrolls, the three rule columns collapse
to one, and no semantic matrix cell is removed.

Dirty close or preset switching requires confirmation. A stale save reloads
the latest registry without discarding the draft and offers exactly `Neueste
Version laden` and `Als Kopie speichern`. A stale assignment or delete updates
the registry and requires another deliberate click; it is not retried.

## Combat Consumption

Combat records the effective preset ID, preset revision, config hash, and mob
threshold at prepare time. A threshold of zero always produces individual
sources. Otherwise an alive quantity at or above the threshold creates one mob
source, and a lower quantity creates individual sources.

Every monster source persists `sourceEntryId` and `partitionKind`. Row IDs are
stable technical identities and are never parsed to infer mode or display
name. A retained mob absorbs reinforcements; retained individual sources stay
individual and new members are appended individually. Only when no source for
an entry survives is it repartitioned using the currently effective threshold.
Restart loads the explicit partition and reproduces it exactly.

## Acceptance Evidence

Required evidence covers Config V3 contracts and artifact equality, registry
foreign keys/receipts/recovery, exhaustive selector ranking and property tests,
Scene/Session parity, a separate under-100-ms p95 profile, Combat threshold and
restart edges, renderer dirty/conflict/pointer/keyboard/200-percent behavior,
and built-Electron light/dark Golden checks. The canonical handoff is
`pnpm check`.
