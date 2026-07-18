Status: Active Target
Owner: Session Generation Feature
Last Reviewed: 2026-07-18
Source of Truth: Generation language, deterministic policies, immutable runs,
and invariants.

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
- session summary, encounter target, encounter intent, and CR-and-role block
- treasure plan, loot item line, packing row, and reward summary
- warning and audit outcome
- engine version, catalog version, and catalog content hash

Closed vocabulary crosses the boundary as enums or value types. Versions are
audit metadata, not user-selectable ruleset labels.

## Write Model And Derived State

`GeneratedRun` is the immutable Session Generation write model. It owns:

- stable run identity and normalized input
- catalog and engine identity
- ordered encounter targets and encounter intents
- ordered treasures, item lines, packing rows, and reward summary
- optional formatted output, typed warnings, and audits

There is no update command. A changed request produces a different run.

`GeneratedRunDraft` is transient derived state containing the same semantic
generation result before it becomes durable. It is complete and immutable but
is not stored truth and cannot be observed as a partial `GeneratedRun`.

Encounter intents describe CR, role, XP, and quantity requirements. They do not
contain selected creature identity and never claim to be a concrete Encounter.
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
7. reward aggregation and formatting
8. warnings and hard audits

The same normalized input, engine version, and catalog content hash produce the
same domain values. Wall-clock time, locale defaults, database order, hash
iteration, and volatile randomness cannot influence output.

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

The complete encounter candidate search space is transient stage state. Only
selected intents and candidate-coverage audits become run truth.

## Consistency Boundary

One `GeneratedRun` and all of its owned values form one immutable consistency
boundary. A run pins engine version, catalog version, and catalog content hash
and remains self-contained after creation.

## Sources

- Readable behavioral evidence:
  `/home/aaron/Schreibtisch/projects/references/saltmarcher/session-generation/encounter-loot-generation-design.md`
- Preserved original:
  `/home/aaron/Schreibtisch/projects/references/.tools/markdown/saltmarcher-encounter-loot-generation-design-2026-07-16.md`
- [Requirements](../requirements/requirements-session-generation.md)
- [Contract](../contract/contract-session-generation.md)
