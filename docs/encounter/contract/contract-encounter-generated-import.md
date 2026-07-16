Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Typed atomic import of generated encounter specifications into
Encounter-owned saved plans.

# Encounter Generated Import Contract

## Purpose, Owner, And Consumer

Encounter owns the conversion of one Session Generation encounter batch into
saved Encounter plans. Session Planner is the consumer. The operation crosses
only `EncounterApi`; Session Planner and Session Generation never write
Encounter persistence.

This contract imports encounter specifications only. It does not import
generated rewards, packing, audits, session scenes, or Session Generation
catalog rows.

## Non-Blocking Operation

The public operation is:

```text
importGeneratedPlans(GeneratedEncounterPlanImportCommand)
  -> GeneratedEncounterPlanImportResult
```

It completes asynchronously and MUST NOT resolve creature detail or touch
SQLite on the JavaFX thread.

The command contains:

- one `GeneratedEncounterPlanSource` with non-blank engine version and stable
  generation-run identity
- an ordered non-empty list of `GeneratedEncounterPlanSpec`
- per spec, a unique positive encounter number, display label, and non-empty
  ordered list of typed slots
- per slot, positive XP and one typed requested encounter role

The engine version is persisted origin metadata for audit and idempotency. It
is not a UI ruleset label.

## Resolution And Result

Encounter resolves every slot against current creature facts through the
Creatures public boundary. Resolution uses Encounter-owned selection policy and
produces a non-empty saved roster for every spec. No foreign statblock or
generation catalog row is copied into Encounter storage.

Success returns exactly one `ImportedPlan` mapping for every requested
encounter number, in request order. Each mapping contains a positive
Encounter-owned saved-plan identity. No internal row, repository, or creature
detail crosses the API.

Typed statuses are:

- `SUCCESS`: the entire batch exists durably and the full mapping is returned
- `INVALID_REQUEST`: source, ordering, identity, role, XP, or slot validation
  failed
- `UNRESOLVABLE`: at least one slot could not produce a valid roster from
  current creature facts
- `STORAGE_FAILURE`: migration or atomic persistence failed

Non-success results contain no plan mapping. Display-safe messages contain no
SQL, exception text, paths, or creature payloads.

## Atomicity And Retry

The batch is one Encounter consistency boundary:

- resolve and validate every spec before persistence
- insert every saved plan, roster row, and generated-origin row in one SQLite
  transaction
- roll back the whole batch on any validation, resolution, or storage failure
- never return a partial mapping

Generated batch identity is unique by `(engine_version, generation_id)` and
stores one normalized batch fingerprint plus its encounter cardinality. Its
ordered origin rows remain unique by `(engine_version, generation_id,
encounter_number)`. Retrying an already completed identical batch returns the
existing complete mapping without creating duplicate plans. A subset,
superset, reordered batch, partial stored origin set, or retry whose normalized
spec differs from the stored origin is a closed failure and writes nothing.

The normalized identity includes encounter order, encounter number, slot
order, XP, and requested role. `displayLabel` is explicitly non-semantic for
retry identity: the first successful import owns the persisted saved-plan
label, and later identical retries do not rename it.

## Persistence And Migration

The saved-plan root retains optional generated origin: engine version,
generation-run identity, encounter number, deterministic normalized batch and
spec fingerprints, declared batch cardinality, and stable batch order. Manual
saved plans have no generated origin.

The origin columns and uniqueness rule are introduced by a new contiguous
Encounter feature migration under the existing feature owner key. The
migration does not rewrite manual plans and does not create a second saved-plan
table. Deleting or changing a Session Generation run does not cascade into
Encounter storage.

## Verification Notes

This boundary is review-owned until production-route tests cover invalid
commands, all-or-nothing resolution, transaction rollback, complete ordered
mapping, identical retry, mismatched retry, and non-blocking completion.

## References

- [Encounter Domain Model](../domain/domain-encounter.md)
- [Encounter Persistence](contract-encounter-persistence.md)
- [Session Generation Contract](../../sessiongeneration/contract/contract-session-generation.md)
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md)
