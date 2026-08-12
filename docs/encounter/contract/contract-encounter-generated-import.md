# Encounter Generated Preparation Contract

## Purpose And Ownership

Encounter owns the conversion of one ordered Session Generation intent batch
into concrete saved Encounter rosters. Session Planner is the consumer. The
boundary contains no rewards, packing, audits, session scenes, repository
types, or persistence rows.

## Internal Import Ports And Public Read

```text
selectGeneratedRosters(GeneratedRosterSelectionCommand)
  -> PreparedGeneratedEncounterBatchResult

commitGeneratedBatch(CommitGeneratedEncounterBatchCommand)
  -> CommittedGeneratedEncounterBatchResult

loadGeneratedPlanSummaries(GeneratedEncounterPlanSummaryBatchQuery)
  -> GeneratedEncounterPlanSummaryBatchResult
```

Roster selection, canonical CR parsing, prepared-batch validation, and commit
persistence are separate Encounter-owned components. Selection and commit are
Utility-internal Session Planner worker ports, not Renderer capabilities. The
saved-plan search and summary reads remain public for interactive Planner use.

All ports are asynchronous. The summary query accepts unique Encounter
plan identities and returns existing structured summaries in request order,
with missing identities reported explicitly rather than omitted.

Summary hydration captures the current active Party composition once and
loads one complete current Creature facts snapshot for the union of referenced
creature IDs. It derives base XP, adjusted XP, and difficulty from those two
current inputs. Stored display names are last-known fallbacks only; resolvable
current Creature names take precedence. A missing plan and a plan whose current
creature facts cannot be resolved remain distinct ordered result states.

The selection command contains generation-run identity, declared engine and
catalog/preset meaning, and an ordered non-empty list of intents. Each intent
has one unique positive Encounter ordinal, target XP, difficulty, and non-empty
ordered CR-and-role blocks with positive quantity and XP. Generated display
labels are renderer-derived from the ordinal.

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
- concrete stable creature identities and quantities
- total creature count, adjusted XP, and difficulty

Prepare performs no persistence write. If any intent is invalid or
unresolvable, it returns no roster draft.

## Atomic Commit And Retry

Commit accepts the stable semantic batch origin and complete prepared batch. It
revalidates batch identity, roster fingerprints, and saved-plan invariants,
then inserts every plan, roster row, and generated-origin row in one Encounter
transaction.

Generated batch identity is the canonical fingerprint of run origin,
Encounter-engine version, catalog/preset meaning, and normalized roster
content. Operation and preparation IDs are excluded. An identical completed
retry or a new workflow with the same semantic origin returns the existing
ordered mapping without duplicate plans. A subset, superset, reordered batch,
partial stored origin, or mismatched fingerprint returns `CONFLICT` and writes
nothing.

Success returns exactly one Encounter plan ID and structured saved-plan summary
per Encounter number. No partial mapping is returned.

## Status And Errors

Statuses are `SUCCESS`, `INVALID_REQUEST`, `UNRESOLVABLE`, `CONFLICT`, and
`STORAGE_FAILURE`. Failures contain stable codes and structured parameters,
not localized messages, SQL, exception text, paths, catalog payloads, or
creature detail. Non-success returns no applicable draft or committed mapping.

## Persistence And Current Format

Saved plans retain optional generated origin, normalized roster fingerprint,
declared batch cardinality, and order. Manual plans have no generated origin.
Deleting or changing a Session Generation run does not cascade into Encounter.

Generated commits and reads use one canonical origin representation containing
batch-origin fingerprint, engine/catalog/preset meaning, generation-run
identity, Encounter ordinal, and concrete roster fingerprint. Missing
canonical identity fields make an internal pre-completion record invalid; no
historical origin derivation, second writer, dual write, or compatibility
carrier is part of this contract.

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
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md)
