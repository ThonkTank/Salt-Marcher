Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Session Planner feature ownership, public seams, and target
dependency direction.

# Session Planner Architecture

## Entity And Concerns

This specification serves maintainers of persisted sessions, planner UI, and
Party, Encounter, or World Planner integration. Session Planner owns session
records, ordered scenes, participant references, allocations, rests,
placeholders, selection, and the current-session pointer. It does not own party
characters, encounter rosters, creature truth, World Planner details, or loot.

## Target Topology

```text
features/sessionplanner/api/
features/sessionplanner/domain/
features/sessionplanner/application/
features/sessionplanner/adapter/sqlite/
features/sessionplanner/adapter/javafx/
features/sessionplanner/SessionPlannerFeature
```

The application composition supplies `PartyApi`, `EncounterApi`, and
`WorldPlannerApi` explicitly. `SessionPlannerFeature` exposes
`SessionPlannerApi` plus constructed shell contributions.

## Boundaries

- `SessionPlannerApi` owns typed workflows, results, catalog queries, and one
  immutable revisioned session-planner state surface.
- Domain code owns session-record invariants without JavaFX, SQL, shell, or
  foreign-feature dependencies.
- Application code re-reads foreign facts through provider APIs and translates
  them into planner-owned values.
- The SQLite adapter persists only planner-owned truth and stable foreign IDs.
- The JavaFX adapter uses `SessionPlannerApi`, `shell.api`, and feature-neutral
  platform UI contracts only; it renders controls, timeline, and state without
  mutating feature state directly.
- Gold remains explicit placeholder state until a loot owner publishes a real
  API and contract.

Persistence-backed calls are non-blocking. Failed writes retain the last stable
state; late asynchronous results cannot replace a newer revision.

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
