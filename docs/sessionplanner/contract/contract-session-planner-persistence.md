Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Persistence path, reference rules, and error behavior for the
`sessionplanner` session record.

# Session Planner Persistence Contract

## Purpose

This contract defines the persisted storage boundary for the `sessionplanner`
feature.

Current state persists multiple session records with stable
  session identity, user-visible display names, and a current-session pointer
and exposes create/open/rename/delete operations through a planner-owned
boundary.

Target state:

- `sessionplanner` keeps persisting its own session record without storing
  foreign domain internals

## Adapter Boundary

- The session-planner SQLite adapter satisfies planner-owned application ports
  and remains private to the session-planner composition entry point.
- The application composition supplies `SessionPlannerApi` explicitly;
  registry, discovery, mutable published models, repositories, gateways,
  mappers, and schema types are not public boundaries.
- SQL records and adapter failures MUST NOT cross `SessionPlannerApi`.

## Stored Truth

The persisted session record stores only sessionplanner-owned truth:

- stable session identity
- user-visible session display name
- session-local participant references to party characters
- exact `encounterDays` planning input
- ordered session-owned scenes
- optional references from a scene to an encounter-owned saved plan
- session-owned scene title and scene notes per scene
- optional stable World Planner location reference per scene
- per-scene budget percentages or equivalent planner-owned allocation data
  when an encounter plan is linked
- selected scene context
- session-local rests, placeholders, and planner status or selection truth
- ordered generated reward references containing session scene identity, typed
  Session Generation run identity, treasure identity, and a last-known display
  label

The session record does not persist:

- party membership truth
- party character details beyond stable references
- encounter rosters or copied encounter creature rows
- creature statblocks or creature lifecycle truth
- copied World Planner location details
- loot-object internals or fake gold-budget fields
- generation previews, preview fingerprints, engine or catalog metadata,
  encounter-generation specifications, generated reward contents, packing, or
  audit rows

## Reference Rules

- party characters are stored only as stable session participant references
- scene entries are session-owned truth; their encounter reference is optional
  and, when present, is stored only as a stable reference to an
  encounter-owned saved plan
- World Planner locations are stored only as stable references; location
  display/detail truth remains World Planner-owned
- foreign truth must be re-read through the owning public boundary when a
  session is opened
- session-owned scene ordering, allocations, rests, placeholders, and selection
  state remain in sessionplanner persistence even when foreign source data is
  reloaded
- every generated reward reference MUST name an existing session-owned scene.
  Quest and environment rewards use encounter-free scenes; encounter-channel
  rewards use their generated encounter scene. Run and treasure identities
  remain foreign stable references and are not SQLite foreign keys into another
  feature's tables
- `lastKnownLabel` is a planner-owned display fallback and MUST NOT be treated
  as generated reward truth

## Validation And Error Behavior

- session-plan writes MUST reject malformed session identity, participant
  reference, encounter reference, or allocation payloads instead of silently
  persisting partial planner truth
- `encounterDays` MUST be stored as an exact decimal value, not a lossy
  floating-point approximation
- persistence payloads MUST reject copied foreign rosters, character detail,
  creature detail, and loot internals
- generated reward writes MUST reject non-positive scene or treasure
  identities, blank generation-run identities, orphaned session-scene
  references, duplicate ordered references, and malformed labels
- storage and schema failures MUST surface through Session Planner API result
  statuses instead of leaking adapter exceptions to consumers
- failed writes MUST keep the last stable planner-owned current session state
  visible instead of publishing a half-persisted mutation
- applying one generation MUST persist all new scene and generated reward
  references in the same Session Planner transaction

## Stability Rules

- session-plan persistence remains behind a feature-owned application port
  implemented by the Session Planner SQLite adapter and wired by the feature
  composition entry point
- sessionplanner persistence stays the canonical home for session-owned
  allocations and selection state even when later workflows trigger encounter
  or loot mutations through foreign boundaries
- the current pointer model identifies the active persisted session and does
  not collapse the persisted catalog back to a single-session domain limit
- the canonical normalized generated-reward child table is introduced by a
  contiguous Session Planner feature migration and is replaced atomically with
  the other child collections for one session

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject persisted fields that duplicate encounter rosters, party
  character internals, creature detail, or loot internals.
- Review must reject persisted preview fingerprints or copied Session
  Generation result rows.
- Review must reject persistence types or internal collaborators crossing
  `SessionPlannerApi`.

## References

- [Session Planner Domain Model](../domain/domain-session-planner.md) (line 1)
- [Session Planner Architecture](../architecture/architecture-session-planner.md) (line 1)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
- [Session Generation Contract](../../sessiongeneration/contract/contract-session-generation.md)
