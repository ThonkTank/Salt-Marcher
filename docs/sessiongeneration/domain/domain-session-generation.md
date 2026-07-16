Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Session Generation domain language, immutable aggregate,
deterministic policies, and invariants.

# Session Generation Domain Model

## Context Role And Ownership

Context Name: SessionGeneration

Context Role: Generated Proposal Context

`sessiongeneration` owns generation requests translated into domain input,
deterministic generation policy, immutable generated runs, audits, and the
versioned reference catalog used by those runs. It does not own Session Planner
records, party-character identity, creature statblocks, or Encounter saved-plan
rosters.

The application boundary accepts public request carriers, translates them into
domain values, selects one complete catalog snapshot, invokes the engine, and
stores a completed aggregate. Session Planner and Encounter translation remains
outside this domain.

## Published Language

The public language uses typed values for:

- `GenerationRunId`, `GenerationRequest`, `GenerationResponse`, and
  `GenerationStatus`
- `PartyLevelCount`, `AdventureDayFraction`, `EncounterCount`, and `Seed`
- `SessionSummary`, `EncounterTarget`, `GeneratedEncounter`,
  `SelectedEncounterBlock`, `TreasurePlan`, `LootItemLine`, `PackingRow`,
  `RewardSummary`, and `GenerationAudit`
- `EncounterDifficulty`, `EncounterRole`, `StockClass`, `RewardChannel`,
  `LootRole`, `MagicRarity`, `DecisionType`, and `AuditStatus`
- `EngineVersion`, `CatalogVersion`, and `CatalogContentHash`

Closed vocabularies cross boundaries as enums or value types, not string
round-trips. Unknown imported catalog vocabulary is rejected or translated by
the catalog adapter before domain generation; it does not create a second
domain enum.

Engine and catalog versions are audit and reproducibility metadata. They are
not user-selectable ruleset labels.

## Immutable Aggregate

Aggregate Root: `GeneratedRun`

A successful run is immutable after creation and owns:

- stable generation identity, seed, engine version, catalog version, and
  catalog content hash
- normalized level counts and session context
- ordered encounter targets and selected encounters with their selected blocks
- ordered treasure plans, loot lines, packing rows, reward summary, and
  formatted output
- ordered audit outcomes and warnings

The aggregate stores generated facts, not foreign entities. Encounter entries
describe generation slots and roles; they do not become saved Encounter plans
until Encounter imports them. Reward entries remain Session Generation truth;
Session Planner stores only stable references to them.

There is no update command for a completed run. A changed request creates a new
run. Load is a read of the same immutable aggregate.

The complete encounter candidate search space is derived generation-stage
state. The engine constructs and ranks it deterministically, selects the
encounter and blocks needed by the result, records candidate coverage through
the audit vocabulary, and then discards the remaining candidates. Candidate
enumeration order and unselected candidates are not durable aggregate truth.

## Deterministic Engine And Catalog

`GenerationEngine` is a pure domain policy over `GenerationInput` and one
`ReferenceCatalogSnapshot`. The snapshot is immutable, has one stable ordered
row sequence per catalog family, and is identified by version plus content
hash.

Determinism means the same normalized input, engine version, and catalog
content hash produce the same domain values before run identity and storage
metadata are attached. Seeded choices use positive modulo semantics and stable
tie-breakers. Hash-map iteration, wall-clock time, locale defaults, database
row accidents, or volatile randomness MUST NOT affect a run.

The reference catalog owns progression, CR, role-band, encounter-pattern,
loot, modifier, relation, theme, magic, variant, decision-type, spell,
enspelling, curse, container, and source vocabulary. Catalog rows are reference
facts, not mutable members of a `GeneratedRun`.

## Commands And Invariants

Commands are:

- generate a new run from normalized inputs
- load an existing run by stable identity

Core invariants are:

- party levels are unique and from 1 through 20; counts are non-negative and
  their sum is positive
- explicit encounter count is from 1 through 10
- encounter numbers and targets are contiguous and ordered from 1
- encounter targets sum exactly to the session XP target
- every selected encounter refers to one target and retains the ordered blocks
  that form its generated composition
- treasure, loot-line, packing-row, and audit identities are unique within the
  run
- candidate coverage is at least one for every encounter target before the
  transient candidate set is discarded, and that outcome is retained as an
  audit fact
- at most one quest treasure and at most one treasure per encounter anchor
  exist; encounter anchors are unique
- non-magic slot totals and magic counts equal the session-context targets
- magic lines contribute zero gold value and remain additional to gold budget
- every loot line has one packing result and every packing result is valid
  before a run is applicable
- no hard audit is failed in a successful applicable run
- exact reference-catalog row selections are not cross-catalog invariants

Fallbacks that still produce a valid reference result add typed warnings.
Missing candidate coverage, invalid catalog references, or any failed hard
invariant prevents successful aggregate creation.

## Consistency Boundary

One generated run and all of its owned children are committed atomically. The
shipped catalog artifact is a separate read-only consistency boundary: a run
pins the catalog version and content hash it used, and its structured result is
self-contained, so a later artifact version cannot reinterpret historical
output.

## Sources

- Readable behavioral evidence:
  `/home/aaron/Schreibtisch/projects/references/saltmarcher/session-generation/encounter-loot-generation-design.md`
- Preserved original:
  `/home/aaron/Schreibtisch/projects/references/.tools/markdown/saltmarcher-encounter-loot-generation-design-2026-07-16.md`
- [Requirements](../requirements/requirements-session-generation.md)
- [Contract](../contract/contract-session-generation.md)
