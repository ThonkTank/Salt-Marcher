# Encounter Generated Preparation Contract

Status: Active Godot contract
Owner: Encounter
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Ownership

Encounter owns the conversion of one ordered Session Generation intent batch
into concrete saved Encounter rosters. Session Planner is the consumer. The
boundary contains no rewards, packing, audits, session scenes, repository
types, or persistence rows.

## Public Operations

```text
prepareGeneratedBatch(PrepareGeneratedEncounterBatchCommand)
  -> PreparedGeneratedEncounterBatchResult

commitGeneratedBatch(CommitGeneratedEncounterBatchCommand)
  -> CommittedGeneratedEncounterBatchResult

loadGeneratedPlanSummaries(GeneratedEncounterPlanSummaryBatchQuery)
  -> GeneratedEncounterPlanSummaryBatchResult
```

All operations are asynchronous in the production Godot controller. The
summary query accepts unique Encounter
plan identities and returns existing structured summaries in request order,
with missing identities reported explicitly rather than omitted.

Summary hydration captures the current active Party composition once and
loads one complete current Creature facts snapshot for the union of referenced
creature IDs. It derives base XP, adjusted XP, and difficulty from those two
current inputs. Stored display names are last-known fallbacks only; resolvable
current Creature names take precedence. A missing plan and a plan whose current
creature facts cannot be resolved remain distinct ordered result states.

The prepare command contains a stable preparation identity, generation-run
identity, declared engine version, and an ordered non-empty list of intents.
Each intent has one unique positive Encounter number, display label, target XP,
difficulty, and non-empty ordered CR-and-role blocks with positive quantity and
XP.

## Batch Resolution

Encounter validates the whole command, then obtains one immutable creature
candidate snapshot containing all fields needed to resolve the batch. It does
not query exact XP once per block or load creature detail once per selected
member.

Encounter-owned deterministic policy resolves the intents jointly. It may
reuse candidates across Encounters unless a declared source constraint forbids
that, but it avoids accidental identical rosters when equivalent alternatives
exist. Role and CR are selection inputs, not persisted creature truth.

Success returns one `PreparedEncounterRoster` per intent in request order. Each
contains:

- Encounter number and normalized roster fingerprint
- concrete stable creature identities, quantities, and display names
- total creature count, adjusted XP, difficulty, and display summary

Prepare performs no persistence write. If any intent is invalid or
unresolvable, it returns no roster draft.

## Atomic Commit And Retry

Commit accepts the stable preparation and generation-run identities plus the
complete prepared batch. It revalidates batch identity, roster fingerprints,
and saved-plan invariants, then inserts every plan, roster row, and
generated-origin value in one Encounter owner-partition publication.

Generated batch identity is unique by `(engineVersion, preparationIdentity)`
and stores the normalized batch fingerprint and cardinality. An identical
completed retry returns the existing ordered mapping without duplicate plans.
A subset, superset, reordered batch, partial stored origin, or mismatched
fingerprint returns `CONFLICT` and writes nothing.

Success returns exactly one Encounter plan ID and structured saved-plan summary
per Encounter number. No partial mapping is returned.

## Status And Errors

Domain statuses are `SUCCESS`, `INVALID_REQUEST`, `UNRESOLVABLE`, `CONFLICT`,
and `STORAGE_FAILURE`. Superseded or explicitly cancelled read work publishes
no result; a generation race may publish `STALE` for a still-current request.
Display-safe messages contain no SQL, exception text, paths, catalog payloads,
or creature detail. Non-success returns no applicable draft or committed
mapping.

## Persistence And Current Format

Saved plans retain optional generated origin, normalized roster fingerprint,
declared batch cardinality, and order. Manual plans have no generated origin.
Deleting or changing a Session Generation run does not cascade into Encounter.

Preparation commits and reads use one canonical generated-origin
representation containing preparation identity, engine version,
generation-run identity, and a concrete roster fingerprint. Missing canonical
identity fields make an internal pre-completion record invalid; no historical
origin derivation, second writer, dual write, or compatibility carrier is part
of this contract.

## Performance Contract

- one candidate snapshot read serves the complete prepared batch
- persistence uses one complete owner-partition batch publication
- `loadGeneratedPlanSummaries` hydrates the complete requested identity set as
  one batch operation
- read query count is bounded by data family, not Encounter, block, or roster
  member count

## Current Godot Route

`EncounterGeneratedBatchReadController` owns one active plus one latest pending
prepare/summary request. `EncounterGenerationPolicy` validates and resolves the
complete batch without UI or storage dependencies.
`EncounterGeneratedBatchCommandController` revalidates the prepared batch and
submits one complete `encounter` partition through the admitted serial Campaign
writer. An identical completed retry returns the existing ordered mapping
without submitting a redundant Campaign generation. Partial stored origin,
trash involvement, changed run meaning, reordered or changed fingerprints, and
stable-ID collision fail closed as `CONFLICT`.

## References

- [Encounter Domain](../domain/domain-encounter.md)
- [Encounter Persistence](contract-encounter-persistence.md)
- [Session Generation Contract](../../sessiongeneration/contract/contract-session-generation.md)
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md)
