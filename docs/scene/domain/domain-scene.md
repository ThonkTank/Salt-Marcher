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
one optional World Planner location reference, ordered PC references, ordered
World Planner NPC references, and ordered named creature groups. A group owns
stable individual members referencing the Creature catalog plus their mutable
current HP and conditions, never copied statblocks.

## Invariants

- At least one scene always exists.
- Standardszene and focused scene always identify existing scenes.
- Standardszene cannot be deleted.
- A PC reference can occur in at most one running scene.
- An NPC reference can occur in at most one running scene.
- A running scene has zero or one location and any number of NPC references.
- A running scene may have any number of named creature groups. Living and dead
  members are counted independently; only living members are Encounter-ready.
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

Group editing and generation form one transient Scene application workflow. It
supplies the current draft plus Scene context to the pure Encounter evaluation
and generation rules and publishes one immutable full-roster result. Fill
generation treats existing draft entries as fixed input; replacement generation
starts from an empty roster. Only explicit save creates or updates Scene-owned
group truth; filters, tuning, diagnostics, and an unaccepted draft are not
persisted.

## References

- [Scene Requirements](../requirements/requirements-scene.md)
- [Scene Persistence Contract](../contract/contract-scene-persistence.md)
