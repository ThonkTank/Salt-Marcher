Status: Active Target
Owner: Encounter Feature
Last Reviewed: 2026-07-18
Source of Truth: Batched preparation and atomic commit of generated Encounter
rosters.

# Encounter Generated Preparation Contract

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

All operations are asynchronous. The summary query accepts unique Encounter
plan identities and returns existing structured summaries in request order,
with missing identities reported explicitly rather than omitted.

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
generated-origin row in one Encounter transaction.

Generated batch identity is unique by `(engineVersion, preparationIdentity)`
and stores the normalized batch fingerprint and cardinality. An identical
completed retry returns the existing ordered mapping without duplicate plans.
A subset, superset, reordered batch, partial stored origin, or mismatched
fingerprint returns `CONFLICT` and writes nothing.

Success returns exactly one Encounter plan ID and structured saved-plan summary
per Encounter number. No partial mapping is returned.

## Status And Errors

Statuses are `SUCCESS`, `INVALID_REQUEST`, `UNRESOLVABLE`, `CONFLICT`, and
`STORAGE_FAILURE`. Display-safe messages contain no SQL, exception text, paths,
catalog payloads, or creature detail. Non-success returns no applicable draft
or committed mapping.

## Persistence And Compatibility

Saved plans retain optional generated origin, normalized roster fingerprint,
declared batch cardinality, and order. Manual plans have no generated origin.
Deleting or changing a Session Generation run does not cascade into Encounter.

Existing canonical generated origins remain readable. Preparation commits
retain preparation identity, engine version, generation-run identity, and a
concrete roster fingerprint. When a canonical historical origin lacks the
canonical identity fields, the owning adapter derives their stable compatibility
meaning from the validated historical fields on read.

Writes always use only the canonical generated-origin representation. Historical
origin columns or carriers are never written alongside it, and read
compatibility never authorizes a second writer, dual writes, or reinterpretation
of an existing origin.

## Performance Contract

- one candidate snapshot read serves the complete prepared batch
- persistence uses one transaction and set-based row writes
- `loadGeneratedPlanSummaries` hydrates the complete requested identity set as
  one batch operation
- read query count is bounded by data family, not Encounter, block, or roster
  member count

## References

- [Encounter Domain](../domain/domain-encounter.md)
- [Encounter Persistence](contract-encounter-persistence.md)
- [Session Generation Contract](../../sessiongeneration/contract/contract-session-generation.md)
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md)
