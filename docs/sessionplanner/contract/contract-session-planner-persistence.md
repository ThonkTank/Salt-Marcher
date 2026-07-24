Status: Active Target
Owner: Session Planner Feature
Last Reviewed: 2026-07-21
Source of Truth: Session Planner stored truth, reference semantics, writes, and
error behavior.

# Session Planner Persistence Contract

## Owner And Boundary

The Session Planner SQLite adapter is the only writer of planner-owned session
records. It implements a feature-owned application port and remains private to
`SessionPlannerFeature`. SQL records, schema carriers, repositories, and
adapter failures never cross `SessionPlannerApi`.

## Final Prepared-Session Commit Operation

The application port exposes one final replacement operation:

```text
commitPreparedSession(CommitPreparedSessionCommand)
  -> CommitPreparedSessionResult
```

`CommitPreparedSessionCommand` contains:

- target `SessionPlanId` and `expectedRevision`
- stable preparation identity and normalized prepared-content fingerprint
- the complete replacement scene order, rests, selection, manual loot notes,
  and materialized treasure snapshots
- already-committed generation-run identity and the complete ordered mapping of
  generated Encounter numbers to Encounter-plan identities

It contains no foreign domain object, repository carrier, progress state, or
partially prepared content.

`CommitPreparedSessionResult` is exactly one of:

- `SUCCESS(previousRevision, committedRevision, committedSession)`
- `INVALID(validationErrors)`
- `STALE(expectedRevision, currentRevision)`
- `NOT_FOUND(sessionPlanId)`
- `STORAGE_FAILURE(displaySafeMessage)`

`SUCCESS` advances the revision exactly once. Every non-success result writes
nothing. In particular, `STALE` is the optimistic-revision outcome and never
silently retries against `currentRevision`.

## Stored Truth

The normalized session record stores:

- stable session identity, display name, and revision
- the current-session pointer
- session-local participant references
- exact adventure-day fraction
- ordered scenes with title, notes, optional World Planner location ID, and
  optional Encounter-plan ID
- allocation data for encounter-linked scenes
- selected scene identity
- rests between scenes
- manual loot notes
- ordered treasures with scene ID, title, note, channel, stock, theme, magic
  type, target value, slots, independently ordered item lines, and independently
  ordered packing rows

It MUST NOT store party membership or character detail, Encounter rosters,
creature facts, copied World Planner detail, generation-run or source-treasure
identity, audits, catalog rows, generation drafts, preparation fingerprints, or
progress state.

Saved-plan query text, request epochs, result identities, overflow state, and
search failures are runtime publication state and are not persisted. The
Session Planner store contains only the attached Encounter-plan reference; it
does not cache or mirror the Encounter saved-plan catalog.

## Reference Rules

- foreign identities are stored as typed stable references, not cross-feature
  SQLite foreign keys
- every treasure names an existing scene in the same session
- Encounter-channel rewards reference their generated encounter scene
- quest and environment rewards reference encounter-free scenes
- materialized treasure display and editing require no Session Generation read
- deleting or editing a scene removes or changes only planner-owned references
- attaching and replacing clone the selected Encounter template; only deletion
  of a treasure's owning scene prunes that treasure
- Session Planner never cascades deletion into Party, Encounter, World Planner,
  or Session Generation storage

## Writes And Revisions

Every authored command uses optimistic revision validation. A successful write
replaces the root and affected child collections in one Session Planner
transaction, advances the revision once, and returns the committed snapshot.
A stale revision or invalid payload writes nothing.

Every authored command carries one authored target consisting of Session
identity and expected revision. This includes `PrepareSessionCommand`: it loads
and validates that exact root before any foreign preparation, preserves the
target through replacement confirmation, and applies the final compare-and-swap
only to that target. Reference-bearing commands additionally carry and validate
their scene, note, participant, rest-gap, or foreign-plan identity. The adapter
never substitutes the current-session pointer as a read or write target.

Delete is one guarded Session Planner transaction. It deletes only with
`session_id` plus expected revision, updates the current pointer only when that
exact current root was deleted, and creates and selects a seeded replacement in
the same transaction when no Session remains. Stale and missing outcomes write
nothing. After success the application reads Current authoritatively before it
publishes.

A catalog switch with a dirty scene draft is one authored-lane operation. It
prevalidates the target Session, compare-and-swap saves the source draft, then
switches the pointer and publishes only the target workspace. Any source
validation or save failure leaves the pointer unchanged. If pointer switching
fails after the source save, the source edit remains durable and the source
workspace remains visible with a display-safe failure.

`commitPreparedSession` is one replacement write. It preserves session
identity, display name, participants, and adventure-day fraction while
atomically replacing generated scenes, rests, manual loot notes, treasure
snapshots, selection, and revision. The command accepts already-persisted
Encounter-plan identities plus fully materialized treasure snapshots.

Before any write, the adapter validates target identity and revision, the
prepared-content fingerprint, exact decimals, contiguous ordering, positive
foreign identities, unique scene and treasure keys, valid rest gaps,
scene-local treasures, a complete Encounter-number mapping, and all
optional reference shapes. Partial child replacement is forbidden.

## Cross-Feature Retry

Session Generation and Encounter commits precede the Session Planner write and
are idempotent by deterministic origin plus content fingerprint. If the planner
write fails, their immutable artifacts remain valid foreign truth. Retrying the
same preparation reuses them; it does not create duplicates or delete them as
compensation.

This contract deliberately does not create a cross-feature transaction or a
workflow journal in Session Planner persistence. In-flight preparation state is
runtime state. A process restart may require the user to request preparation
again; idempotency makes that retry safe.

## Migration And Compatibility

Feature migrations remain contiguous under the existing Session Planner owner
key. New columns or child tables are added by a new migration and never by
rewriting an applied migration.

Migration 6 intentionally resets only Session Planner-owned tables before
creating the editable treasure schema. This is an owner-authorized
pre-production cutover; every other feature store remains untouched.
No generation-run or source-treasure identity survives materialization.

A fresh store reaches schema version 6 without creating the retired loot-
placeholder table or index. Opening version 2 copies every legacy row into the
canonical manual-note table in the same transaction that retires the legacy
table; a zero encounter anchor resolves to the first scene by stored scene
order. Opening version 3 does not copy or reconcile legacy rows again because
canonical manual notes may have been edited or deleted since version 3; it only
retires the stale legacy table. Migration 6 supersedes that compatibility path
with the scoped reset and creates the treasure and treasure-item tables.

Future real user data is never deleted or rewritten destructively without the
owner-approved backup boundary.

## Error Contract

Owner startup readiness validates the feature-declared target schema signature; semantic row validation remains on typed provider read/write paths and fails closed through the feature contract.
The current owner target is v6. V6 validates the scoped reset plus the editable
treasure schema; no legacy generated-reward table remains in the target.

Validation errors identify the invalid command field or invariant without
echoing authored content. Failure messages are display-safe and contain no SQL,
exception text, paths, generated item payloads, or authored notes. A failure
leaves the last stable workspace revision visible.

## References

- [Domain](../domain/domain-session-planner.md)
- [Architecture](../architecture/architecture-session-planner.md)
- [Shared Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Session Generation Contract](../../sessiongeneration/contract/contract-session-generation.md)
- [Encounter Generated Preparation](../../encounter/contract/contract-encounter-generated-import.md)
