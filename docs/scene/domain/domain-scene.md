Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Runtime-scene ownership, write model, and invariants.

# Runtime Scene Domain Model

## Context Role

Context Name: Scene

Scene owns running-scene composition and focus. It does not own Party
characters, World Planner NPC/location details, prepared session records,
creature statblocks, or Encounter workflow state.

## Write Model

`SceneWorkspace` is the aggregate root. It owns a monotonically increasing
revision, the Standardszene ID, the focused-scene ID, scene identity allocation,
and the collection of `RunningScene` records.

Each `RunningScene` owns its title, notes, optional Session Planner provenance,
an optional initial Encounter-plan reference, one optional World Planner
location reference, ordered PC references, and ordered World Planner NPC
references. Foreign IDs are references, not copied foreign entities.

## Invariants

- At least one scene always exists.
- Standardszene and focused scene always identify existing scenes.
- Standardszene cannot be deleted.
- A PC reference can occur in at most one running scene.
- An NPC reference can occur in at most one running scene.
- A running scene has zero or one location and any number of NPC references.
- Multiple running scenes may reference the same location.
- Every prepared-scene import creates a new independent copy with provenance;
  importing the same prepared source again is valid and creates another copy.

## Published Language

`SceneModel` publishes immutable scene cards, resolved foreign choices,
prepared-scene choices, synchronization status, and workspace revision.
`SceneCommand` owns initialization, refresh, and all mutations. Typed mutation
results distinguish invalid input, missing references, Standardszene
protection, and storage error.

The application boundary translates active Party summaries, World Planner
NPC/location summaries, and prepared Session Planner sources into Scene
commands and projections. These translations are derived facts and do not
become Scene-owned entities.

## Consistency

One `SceneWorkspace` mutation and its SQLite save form the Scene consistency
boundary. Scene persistence is authoritative for context membership. Encounter
receives an idempotent full-workspace synchronization carrying opaque context
IDs and foreign IDs after the Scene save. The persisted synchronization marker
is derived operational state and does not transfer Encounter ownership.
Foreign names, levels, lifecycle, and disposition are re-read from their owning
features. Refresh removes Party IDs that are no longer active.

## References

- [Scene Requirements](../requirements/requirements-scene.md)
- [Scene Architecture](../architecture/architecture-scene.md)
- [Scene Persistence Contract](../contract/contract-scene-persistence.md)
