# Session Generation Domain Model

## Context Role And Ownership

Context Name: `SessionGeneration`

Context Role: Generated Proposal Context

The context owns normalized generation input, deterministic generation policy,
encounter intents, rewards, packing, warnings, audits, immutable generated
runs, and the versioned reference-catalog meaning recorded by those runs. It
owns neither authored sessions nor concrete creatures, Encounter rosters, or
saved Encounter plans.

## Published Language

The public language contains typed values for:

- `GenerationRunId`, normalized generation input, and seed
- session summary, encounter target, encounter intent, and role-tagged CR-Block
  with an abstract statblock-slot count
- treasure plan, loot item line, packing row, and reward summary
- warning and audit outcome
- engine version, catalog version, catalog content hash, effective preset
  identity and revision, and generator-config hash

Closed vocabulary crosses the boundary as enums or value types. Versions are
audit metadata, not user-selectable ruleset labels.

## Write Model And Derived State

`GeneratedRun` is the immutable Session Generation write-model family. Its
discriminator defines two closed variants:

- `session` owns one complete generated day with encounters and rewards
- `group_reward` owns one reward proposal for one live-scene group draft

Every variant owns:

- stable run identity and normalized input
- catalog and engine identity
- ordered treasures, item lines, packing rows, and reward summary
- typed warnings and audits; localized formatting is renderer-derived and is
  not stored run truth

A `session` run additionally owns ordered encounter targets and encounter
intents, the effective generator preset, and the day-level reward allocation.
A `group_reward` run instead pins scene, prospective or persisted group
identity, nullable group revision, normalized living/dead roster, party and
campaign-rules revisions plus base, adjusted, and effective reward XP. Dead
members remain provenance but do not contribute Encounter XP. It has exactly
one normal Encounter-channel treasure and no encounter intents, quest reward,
environment reward, or overstock allocation.

There is no update command. A changed request produces a different run.

`GeneratedRunDraft` is transient derived state containing the same semantic
generation result before it becomes durable. It is complete and immutable but
is not stored truth and cannot be observed as a partial `GeneratedRun`.

The Electron slice publishes the complete day capability
`sessionGeneration.generate` and the group-bound reward capability
`loot.generateForGroupDraft`. Each constructs its complete applicable result,
passes all hard audits, fingerprints the semantic origin, and persists one immutable
`GeneratedRun`. The earlier encounter-only public compatibility endpoint has
been removed. Planner rewards retain the separate explicit generated-accept
command. A group reward is confirmed through `loot.commitGroupReward`, which
atomically persists its group draft and Treasure; an unconfirmed run mutates
neither owner.

Encounter intents describe CR, role, XP, quantity, and abstract statblock-slot
requirements per CR-Block. They do not contain selected creature identity and
never claim to be a concrete Encounter. The encounter-level statblock count is
derived as the sum of its per-block slot counts.
Reward detail remains Session Generation truth; consumers retain stable
references and resolve detail through Session Generation.

## Deterministic Engine

`GenerationEngine` is a pure policy over normalized `GenerationInput` and one
immutable `ReferenceCatalogSnapshot`. Its named stages are:

1. session context
2. encounter target allocation
3. encounter intent construction and selection
4. treasure planning
5. non-magic and magic item resolution
6. packing
7. reward aggregation
8. warnings and hard audits

The same normalized input, engine version, catalog content hash, effective
generator config, and seed produce the same domain values. Wall-clock time,
locale defaults, database order, hash iteration, and volatile randomness cannot
influence output.

The bundled catalog is a registry of immutable, versioned offline snapshots.
Generation uses the explicitly active artifact while reads and pending commits
resolve their run's artifact by version and content hash. The utility process owns
its file access and verifies all 16 manifest-listed tables before the pure
engine receives immutable encounter and loot projections. Runtime code never
reads the source Google Sheet.

## Invariants

- party levels are unique and from 1 through 20; counts are non-negative and
  total count is positive
- explicit encounter count is 1 through 10
- encounter numbers and targets are contiguous and ordered from 1
- encounter targets sum exactly to the session XP target
- every encounter target has one non-empty structured intent
- treasure, item-line, packing-row, and audit identities are unique within a
  run or draft
- at most one quest treasure and at most one treasure per Encounter anchor
  exist
- non-magic slot totals and magic counts equal the calculated targets
- every item line has one valid packing result
- hard audit failure prevents an applicable draft or run
- one run identity denotes exactly one normalized semantic result
- exact catalog-row selection is not a cross-version invariant

The shared selector supplies one immutable composition and candidate-coverage
audit. Its bounded streaming traversal and canonical ranking are owned by the
[Encounter Generation Requirements](../../encounter/requirements/requirements-encounter-generation.md),
not redefined by this consumer domain.

## Consistency Boundary

One `GeneratedRun` and all of its owned values form one immutable consistency
boundary. Every run pins its applicable component engine versions, catalog
version, and catalog content hash and remains self-contained after creation.

## Sources

- [Requirements](../requirements/requirements-session-generation.md)
