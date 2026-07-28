# Session Planner Persistence Contract

Status: Active target with implemented Godot version-1 owner format
Owner: Session Planner
Last Reviewed: 2026-07-28
Source of Truth: This document owns Session Planner persistence and write semantics

## Owner And Boundary

The Godot `session_planner` Campaign partition is the only writer-owned durable
truth for planner records. `SessionPlanCommandController` prepares one complete
candidate off-thread and submits it through the admitted serial Campaign writer;
`SessionPlanKnowledge` owns format and domain validation. Partition documents,
file paths, checksums, and storage failures never become foreign feature truth.

The Java/JavaFX/SQLite implementation remains migration-only legacy until the
prepared-session workflow and visible owner acceptance complete. New Godot
writes do not read, repair, dual-write, or mirror that legacy store.

## Remaining Final Prepared-Session Commit Operation

The native manual planning commands are implemented. The following replacement
operation remains the target for the later Session Generation cutover:

The application port exposes one final replacement operation:

```text
commitPreparedSession(CommitPreparedSessionCommand)
  -> CommitPreparedSessionResult
```

`CommitPreparedSessionCommand` contains:

- target `SessionPlanId` and `expectedRevision`
- stable preparation identity and normalized prepared-content fingerprint
- the complete replacement scene order, rests, selection, manual loot notes,
  and generated reward references
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

The version-1 Godot session record stores:

- stable session identity, display name, and revision
- the current-session pointer
- session-local participant references
- exact adventure-day fraction as fixed-point units (`10_000` units per day)
- ordered scenes with title, notes, optional World Planner location ID, and
  optional Encounter-plan ID
- exact allocation units for every scene (`1_000_000` units across a non-empty
  ordered scene list)
- selected scene identity
- rests between scenes
- manual loot notes
- ordered generated reward references with scene ID, typed generation-run ID,
  treasure ID, and last-known display label

It MUST NOT store party membership or character detail, Encounter rosters,
creature facts, copied World Planner detail, generated item lines, reward
values, packing rows, audits, catalog rows, generation drafts, preparation
fingerprints, or progress state.

Saved-plan query text, request epochs, result identities, overflow state, and
search failures are runtime publication state and are not persisted. The
Session Planner store contains only the attached Encounter-plan reference; it
does not cache or mirror the Encounter saved-plan catalog.

`lastKnownLabel` is a display fallback for an unavailable foreign reward. It is
not reward truth and MUST NOT replace a successful typed reward projection.

## Reference Rules

- foreign identities are stored as typed stable references, not cross-feature
  storage links
- every reward reference names an existing scene in the same session
- Encounter-channel rewards reference their generated encounter scene
- quest and environment rewards reference encounter-free scenes
- a missing foreign object remains visibly unavailable; Session Planner does
  not recreate it from copied data
- deleting or editing a scene removes or changes only planner-owned references
- attaching, replacing, and detaching an Encounter reference preserve generated
  reward references; only deletion of their owning scene prunes them
- Session Planner never cascades deletion into Party, Encounter, World Planner,
  or Session Generation storage

## Writes And Revisions

Every implemented authored command uses optimistic revision validation. A
successful write publishes one immutable Campaign generation containing the
complete replacement owner partition, advances the Session revision once, and
returns the committed snapshot.
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

A catalog switch with a dirty scene draft is one implemented authored-lane
operation. It
prevalidates the target Session, compare-and-swap saves the source draft, then
switches the pointer and publishes only the target workspace. Any source
validation or save failure leaves the pointer unchanged. If pointer switching
fails after the source save, the source edit remains durable and the source
workspace remains visible with a display-safe failure.

`commitPreparedSession` is one replacement write. It preserves session
identity, display name, participants, and adventure-day fraction while
atomically replacing generated scenes, rests, manual loot notes, reward
references, selection, and revision. The command accepts only already-persisted
generation-run and Encounter-plan identities returned by their owning APIs.

Before any write, the adapter validates target identity and revision, the
prepared-content fingerprint, exact decimals, contiguous ordering, positive
foreign identities, unique scene and reward keys, valid rest gaps,
scene-local reward references, a complete Encounter-number mapping, and all
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

Compatibility obligations begin with the first released file format. Before
that release, `saltmarcher.session-plans.v1` is the only supported native owner
shape. An absent partition reads as the exact empty payload. Its first mutation
publishes the whole validated format through one immutable Campaign generation.
Unknown or incomplete shapes fail closed; no reader repairs, converts, or
destructively cleans them. Current-format sessions, notes, and reward references
remain readable across ordinary restart and the platform-owned backup/recovery
lifecycle.

After activation, subsequent owner versions become immutable predecessor
contracts. A future migration must then preserve every supported shape through
the shared backup, validation, rollback, and recovery boundary; it must not
rewrite version 1.

Real user data is never deleted or rewritten destructively without the
owner-approved backup boundary.

## Error Contract

Owner reads validate the complete version-1 document and checksum-backed
Campaign partition without mutation. They do not repair a mismatched structure.
Semantic validation remains on typed read/write paths and fails closed through
the feature contract.

Validation errors identify the invalid command field or invariant without
echoing authored content. Failure messages are display-safe and contain no
exception text, paths, generated item payloads, or authored notes. A failure
leaves the last stable workspace revision visible.

## References

- [Domain](../domain/domain-session-planner.md)
- [Architecture](../architecture/architecture-session-planner.md)
- [Shared Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Session Generation Contract](../../sessiongeneration/contract/contract-session-generation.md)
- [Encounter Generated Preparation](../../encounter/contract/contract-encounter-generated-import.md)
