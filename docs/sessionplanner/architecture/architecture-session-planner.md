Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Session Planner feature ownership, public seams, and target
dependency direction.

# Session Planner Architecture

## Entity And Concerns

This specification serves maintainers of persisted sessions, planner UI, and
Party, Encounter, or World Planner integration. Session Planner owns session
records, ordered scenes, participant references, allocations, rests,
placeholders, selection, and the current-session pointer. It does not own party
characters, encounter rosters, creature truth, World Planner details, or
generated-run truth.

## Target Topology

```text
features/sessionplanner/api/
features/sessionplanner/domain/
features/sessionplanner/application/
features/sessionplanner/adapter/sqlite/
features/sessionplanner/adapter/javafx/
features/sessionplanner/SessionPlannerFeature
```

The application composition supplies `PartyApi`, `EncounterApi`,
`SessionGenerationApi`, and `WorldPlannerApi` explicitly. `SessionPlannerFeature` exposes
`SessionPlannerApi` plus constructed shell contributions.

## Boundaries

- `SessionPlannerApi` owns typed workflows, results, catalog queries, and one
  immutable revisioned session-planner state surface.
- Domain code owns session-record invariants without JavaFX, SQL, shell, or
  foreign-feature dependencies.
- Application code re-reads foreign facts through provider APIs and translates
  them into planner-owned values.
- Application code resolves session participants, creates the preview
  fingerprint and one request token, calls the UI-free
  `SessionGenerationApi`, discards results whose token is no longer current,
  and coordinates Apply through Encounter's generated-origin import API.
- The SQLite adapter persists only planner-owned truth and stable foreign IDs.
- The JavaFX adapter uses `SessionPlannerApi`, `shell.api`, and feature-neutral
  platform UI contracts only; it renders controls, timeline, and state without
  mutating feature state directly.
- Applied reward detail remains Session Generation truth. Session Planner
  persists only scene-to-generation-and-treasure references plus a last-known
  label.

Persistence-backed calls are non-blocking. Failed writes retain the last stable
state; late asynchronous results cannot replace a newer revision.

Apply has two explicit consistency boundaries. Encounter first resolves and
persists the complete generated encounter batch atomically. Only a complete
number-to-plan-id mapping may enter the Session Planner aggregate, whose scenes
and reward references are then written in one planner transaction. A planner
write failure leaves no partial planner mutation; generated Encounter plans
remain Encounter-owned and a retry uses their persisted generated origin.
Encounter-channel rewards reference their generated encounter scene. Quest and
environment rewards are represented by encounter-free Session scenes, keeping
every generated reward reference within the Session Planner aggregate.

## Shell Surface

Session Planner remains one left-bar contribution using cockpit controls, main,
and state slots. Explicit composition changes construction, not accepted
observable behavior.

## Verification

Target dependency direction is mechanically enforced by `architectureTest`.
JUnit production routes own persisted-session, integration, and UI proof.

## References

- [Session Planner Persistence Contract](../contract/contract-session-planner-persistence.md)
- [Session Planner Requirements](../requirements/requirements-session-planner.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
- [Session Generation Architecture](../../sessiongeneration/architecture/architecture-session-generation.md)
- [Encounter Generated Import](../../encounter/contract/contract-encounter-generated-import.md)
