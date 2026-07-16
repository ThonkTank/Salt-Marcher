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
one optional World Planner location reference, ordered PC references, and
ordered World Planner NPC references.

## Invariants

- At least one scene always exists.
- Standardszene and focused scene always identify existing scenes.
- Standardszene cannot be deleted.
- A PC reference can occur in at most one running scene.
- A running scene has zero or one location and any number of NPC references.
- Imported planner data is copied once and never becomes a live link.

## Published Language

`SceneModel` publishes immutable scene cards, resolved foreign choices,
unassigned PCs, prepared-scene choices, synchronization status, and revision.
`SceneCommand` owns all scene mutations. Typed mutation results distinguish
invalid input, missing references, Standardszene protection, and storage error.

## Consistency

Scene persistence is authoritative for context membership. Encounter receives
an idempotent full-workspace synchronization carrying context keys and foreign
IDs. Foreign names, levels, lifecycle, and disposition are re-read from their
owning features.
